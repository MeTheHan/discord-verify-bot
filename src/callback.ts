import type { Env } from "./index";
import { isSnowflake, verifyHex, b64urlDecode, htmlPage } from "./util";

const DISCORD_API = "https://discord.com/api/v10";
const TIMEOUT_MS = 5000;

// GET /callback: Discord OAuth dönüşü. Rol verme, token'ı saklamadan yapılır.
export async function handleCallback(url: URL, env: Env): Promise<Response> {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || code.length > 512 || state.length > 2048) {
    return htmlPage("Invalid request.", 400);
  }

  const parts = state.split(".");
  if (parts.length !== 2) {
    return htmlPage("Invalid request.", 400);
  }
  const [payloadB64, sig] = parts;
  if (!payloadB64 || !sig || !(await verifyHex(env.HMAC_KEY, `state.${payloadB64}`, sig))) {
    return htmlPage("This link has expired or was modified. Please start again from the verify button in the server.", 400);
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(b64urlDecode(payloadB64));
  } catch {
    return htmlPage("Invalid request.", 400);
  }
  if (!decoded || typeof decoded !== "object") {
    return htmlPage("Invalid request.", 400);
  }
  const payload = decoded as { g?: unknown; v?: unknown; u?: unknown; exp?: unknown };

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp < now || payload.exp > now + 300) {
    return htmlPage("This link has expired. Please start again from the verify button in the server.", 400);
  }
  if (!isSnowflake(payload.g) || !isSnowflake(payload.v) || !(payload.u === "" || isSnowflake(payload.u))) {
    return htmlPage("Invalid request.", 400);
  }
  const guildId = payload.g as string;
  const verifiedRole = payload.v as string;
  const unverifiedRole = typeof payload.u === "string" ? payload.u : "";

  // Limit, Discord'a maliyet veren ilk adımdan önce uygulanır.
  const limit = await env.RATE_LIMITER.limit({ key: guildId });
  if (!limit.success) {
    return htmlPage("Too many verifications in this server right now. Please wait a minute and try again.", 429);
  }

  // OAuth code'unu access token'a çevir
  const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: `${url.origin}/callback`,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => null);

  if (!tokenRes) {
    return htmlPage("Could not reach Discord. Please try again.", 503);
  }
  if (!tokenRes.ok) {
    return htmlPage("Discord authorization failed. Please try again.", 400);
  }
  const tokenData = (await tokenRes.json().catch(() => null)) as { access_token?: unknown } | null;
  if (!tokenData || typeof tokenData.access_token !== "string") {
    return htmlPage("Discord authorization failed. Please try again.", 400);
  }
  const accessToken: string = tokenData.access_token;

  // Kullanıcı ID'sini al. Access token burada kullanılır, saklanmaz.
  const userRes = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => null);

  const user = userRes?.ok
    ? ((await userRes.json().catch(() => null)) as { id?: unknown } | null)
    : null;
  if (!user || !isSnowflake(user.id)) {
    return htmlPage("Could not read your Discord account. Please try again.", 400);
  }
  const userId: string = user.id;

  const memberRoles = `${DISCORD_API}/guilds/${guildId}/members/${userId}/roles`;
  const botHeaders = {
    Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
    "X-Audit-Log-Reason": "Human verification",
  };

  // Kullanıcı zaten doğrulanmış mı? Üye bilgisi alınamazsa normal akışa devam ederiz.
  const memberRes = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${userId}`, {
    headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => null);

  let alreadyVerified = false;
  if (memberRes?.ok) {
    const member = (await memberRes.json().catch(() => null)) as { roles?: unknown } | null;
    alreadyVerified = Array.isArray(member?.roles) && (member.roles as unknown[]).includes(verifiedRole);
  }

  if (alreadyVerified) {
    // Doğrulanmış ama hâlâ doğrulanmamış rolü taşıyorsa onu kaldır.
    if (unverifiedRole) {
      await fetch(`${memberRoles}/${unverifiedRole}`, {
        method: "DELETE",
        headers: botHeaders,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }).catch(() => null);
    }
    return htmlPage("You are already verified in this server. You can return to Discord.", 200);
  }

  // Doğrulanmış rolü ver
  const add = await fetch(`${memberRoles}/${verifiedRole}`, {
    method: "PUT",
    headers: botHeaders,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => null);

  if (!add) {
    return htmlPage("Could not reach Discord. Please try again.", 503);
  }
  if (!add.ok) {
    return htmlPage(
      "Could not grant the role. Make sure you are a member of this server, and that the bot's role is above the verified role.",
      403,
    );
  }

  // Varsa doğrulanmamış rolü kaldır. Başarısız olursa kullanıcıyı engellemiyoruz.
  if (unverifiedRole) {
    await fetch(`${memberRoles}/${unverifiedRole}`, {
      method: "DELETE",
      headers: botHeaders,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }).catch(() => null);
  }

  return htmlPage("You are verified. You can return to Discord.", 200);
}