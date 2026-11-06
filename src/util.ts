const SNOWFLAKE = /^\d{17,20}$/;
const enc = new TextEncoder();

export const isSnowflake = (s: unknown): s is string =>
  typeof s === "string" && SNOWFLAKE.test(s);

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array | null {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signHex(secret: string, message: string): Promise<string> {
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(message));
  return toHex(new Uint8Array(sig));
}

// crypto.subtle.verify karşılaştırmayı sabit süreli yapar, elle string karşılaştırması yapmayın.
export async function verifyHex(secret: string, message: string, hex: string): Promise<boolean> {
  const sigBytes = fromHex(hex);
  if (!sigBytes) return false;
  return crypto.subtle.verify("HMAC", await hmacKey(secret), sigBytes, enc.encode(message));
}

export function b64urlEncode(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=");
  return atob(b64);
}

export function htmlPage(message: string, status: number): Response {
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Verification</title><style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#fafafa;color:#111}main{text-align:center;padding:24px;max-width:480px}</style></head><body><main><p>${message}</p></main></body></html>`;
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
      "Referrer-Policy": "no-referrer",
    },
  });
}