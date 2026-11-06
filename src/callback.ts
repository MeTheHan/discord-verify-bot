import type { Env } from "./index";
import { isSnowflake, verifyHex, b64urlDecode, htmlPage } from "./util";

// GET /callback: Discord OAuth dönüşü. Rolü ver, token'ı sakla.
export async function handleCallback(url: URL, env: Env): Promise<Response> {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || code.length > 512 || state.length > 2048) {
    return htmlPage("Invalid request.", 400);
  }

  const [payloadB64, sig] = state.split(".");
  if (!payloadB64 || !sig || !(await verifyHex(env.HMAC_KEY, `state.${payloadB64}`, sig))) {
    return htmlPage("This link has expired or was modified. Please start again from the verify button in the server.", 400);
  }

  let payload: any;
  try {
    payload = JSON.parse(b64urlDecode(payloadB64));
  } catch {
    return htmlPage("Invalid request.", 400);
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp < now || payload.exp > now + 300) {
    return htmlPage("This link has expired. Please start again from the verify button in the server.", 400);
  }
  if (!isSnowflake(payload.g) || !isSnowflake(payload.v) || !(payload.u === "" || isSnowflake(payload.u))) {
    return htmlPage("Invalid request.", 400);
  }

  const redirectUri = `${url.origin}/callback`;

  // Code'u access token'a çevir
  const tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!tokenRes.ok) {
    return htmlPage("Discord authorization failed. Please try again.", 400);
  }
  const { access_token } = (await tokenRes.json()) as { access_token: string };

  // Kullanıcı ID'sini al. Token burada kullanılır, saklanmaz.
  const userRes = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!userRes.ok) {
    return htmlPage("Could not read your Discord account. Please try again.", 400);
  }
  const user = (await userRes.json()) as { id: string };
  if (!isSnowflake(user.id)) {
    return htmlPage("Could not read your Discord account. Please try again.", 400);
  }

  const memberRoles = `https://discord.com/api/v10/guilds/${payload.g}/members/${user.id}/roles`;
  const headers = {
    Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
    "X-Audit-Log-Reason": "Human verification",
  };

  // Doğrulanmış rolü ver
  const add = await fetch(`${memberRoles}/${payload.v}`, { method: "PUT", headers });
  if (!add.ok) {
    return htmlPage(
      "Could not grant the role. Make sure you are a member of this server, and that the bot's role is above the verified role.",
      403,
    );
  }

  // Varsa doğrulanmamış rolü kaldır. Başarısız olursa kullanıcıyı engellemiyoruz.
  if (payload.u) {
    await fetch(`${memberRoles}/${payload.u}`, { method: "DELETE", headers });
  }

  return htmlPage("You are verified. You can return to Discord.", 200);
}