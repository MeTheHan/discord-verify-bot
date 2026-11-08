import type { Env } from "./index";
import { isSnowflake, signHex, verifyHex, b64urlEncode } from "./util";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

async function validLinkParams(
  env: Env,
  g: unknown,
  v: unknown,
  u: unknown,
  sig: unknown,
): Promise<boolean> {
  if (!isSnowflake(g) || !isSnowflake(v)) return false;
  if (!(u === "" || isSnowflake(u))) return false;
  if (typeof sig !== "string") return false;
  // setup komutu aynı formatla imzalıyor: `${guildId}.${verifiedRole}.${unverifiedRole}`
  return verifyHex(env.HMAC_KEY, `${g}.${v}.${u}`, sig);
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

// GET /verify: linki doğrula, Turnstile sayfasını göster
export async function handleVerifyPage(url: URL, env: Env): Promise<Response> {
  const g = url.searchParams.get("g") ?? "";
  const v = url.searchParams.get("v") ?? "";
  const u = url.searchParams.get("u") ?? "";
  const sig = url.searchParams.get("sig") ?? "";

  if (!(await validLinkParams(env, g, v, u, sig))) {
    return new Response("This link is invalid or has been modified.", { status: 400 });
  }

  const nonce = crypto.randomUUID().replace(/-/g, "");
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Human verification</title>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" nonce="${nonce}" async defer></script>
<style>
body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#fafafa;color:#111}
main{text-align:center;padding:24px;max-width:480px}
#status{margin-top:16px;min-height:1.5em}
</style>
</head>
<body>
<main>
<h1>Human verification</h1>
<p>Complete the check below to continue to Discord.</p>
<div class="cf-turnstile" data-sitekey="${env.TURNSTILE_SITE_KEY}" data-action="verify" data-callback="onTurnstile"></div>
<p id="status"></p>
</main>
<script nonce="${nonce}">
async function onTurnstile(token) {
  const status = document.getElementById("status");
  status.textContent = "Checking...";
  const p = new URLSearchParams(location.search);
  const res = await fetch("/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, g: p.get("g"), v: p.get("v"), u: p.get("u") ?? "", sig: p.get("sig") }),
  });
  const data = await res.json().catch(() => null);
  if (res.ok && data && data.redirect) {
    location.href = data.redirect;
  } else {
    status.textContent = (data && data.error) || "Verification failed. Please reload and try again.";
    if (window.turnstile) window.turnstile.reset();
  }
}
</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy":
        `default-src 'none'; script-src 'nonce-${nonce}' https://challenges.cloudflare.com; ` +
        `style-src 'unsafe-inline'; frame-src https://challenges.cloudflare.com; ` +
        `connect-src 'self' https://challenges.cloudflare.com; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
      "Referrer-Policy": "no-referrer",
      "X-Frame-Options": "DENY",
      "Cache-Control": "no-store",
    },
  });
}

// POST /verify: Turnstile token'ını sunucuda doğrula, Discord OAuth state'i üret
export async function handleVerifySubmit(request: Request, env: Env, url: URL): Promise<Response> {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return json({ error: "Bad request." }, 400);
  }

  const { token, g, v, sig } = body;
  const u = typeof body.u === "string" ? body.u : "";

  if (typeof token !== "string" || token.length === 0 || token.length > 2048) {
    return json({ error: "Missing verification token." }, 400);
  }
  if (!(await validLinkParams(env, g, v, u, sig))) {
    return json({ error: "This link is invalid or has been modified." }, 400);
  }

  // Turnstile'ı sunucuda doğrula. remoteip göndermiyoruz, IP'yi hiçbir yerde kullanmıyoruz.
  const form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET);
  form.append("response", token);

  const vr = await fetch(SITEVERIFY_URL, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);

  const result = vr
    ? ((await vr.json().catch(() => null)) as { success?: boolean; hostname?: string; action?: string } | null)
    : null;

  // Hostname ve action kontrolü: başka bir siteden alınmış token'ları reddeder
  if (!result || !result.success || result.hostname !== url.hostname || result.action !== "verify") {
    return json({ error: "Verification failed. Please try again." }, 403);
  }

  // State: kısa ömürlü, HMAC imzalı. Sunucuda hiçbir şey saklanmaz.
  const payload = {
    g,
    v,
    u,
    exp: Math.floor(Date.now() / 1000) + 300,
    n: crypto.randomUUID(),
  };
  const payloadB64 = b64urlEncode(JSON.stringify(payload));
  const stateSig = await signHex(env.HMAC_KEY, `state.${payloadB64}`);
  const state = `${payloadB64}.${stateSig}`;

  const authorize = new URL("https://discord.com/oauth2/authorize");
  authorize.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  authorize.searchParams.set("redirect_uri", `${url.origin}/callback`);
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("scope", "identify");
  authorize.searchParams.set("state", state);

  return json({ redirect: authorize.toString() });
}