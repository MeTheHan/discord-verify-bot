import { handleSetup } from "./setup";

export interface Env {
  DISCORD_PUBLIC_KEY: string;
  DISCORD_BOT_TOKEN: string;
  HMAC_KEY: string;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function verifyDiscordRequest(
  request: Request,
  publicKeyHex: string,
): Promise<{ valid: boolean; body: string }> {
  const signature = request.headers.get("X-Signature-Ed25519");
  const timestamp = request.headers.get("X-Signature-Timestamp");
  if (!signature || !timestamp) {
    return { valid: false, body: "" };
  }

  const body = await request.text();

  const key = await crypto.subtle.importKey(
    "raw",
    hexToBytes(publicKeyHex),
    { name: "Ed25519" },
    false,
    ["verify"],
  );

  const valid = await crypto.subtle.verify(
    "Ed25519",
    key,
    hexToBytes(signature),
    new TextEncoder().encode(timestamp + body),
  );

  return { valid, body };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/interactions") {
      return new Response("Not found", { status: 404 });
    }

    const { valid, body } = await verifyDiscordRequest(request, env.DISCORD_PUBLIC_KEY);
    if (!valid) {
      return new Response("Invalid request signature", { status: 401 });
    }

    const interaction = JSON.parse(body);

    // PING (type 1), endpoint kaydı için
    if (interaction.type === 1) {
      return Response.json({ type: 1 });
    }

    // Slash komutu (type 2)
    if (interaction.type === 2 && interaction.data?.name === "setup") {
      return handleSetup(interaction, env, url.origin);
    }

    return Response.json({ type: 4, data: { content: "Unknown command.", flags: 64 } });
  },
} satisfies ExportedHandler<Env>;