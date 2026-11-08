import { handleSetup } from "./setup";
import { handleSource } from "./source";
import { handleStatistics } from "./statistics";
import { handleVerifyPage, handleVerifySubmit } from "./verify";
import { handleCallback } from "./callback";
import { verifyDiscordRequest } from "./discord";

export interface Env {
  DISCORD_PUBLIC_KEY: string;
  DISCORD_BOT_TOKEN: string;
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
  TURNSTILE_SECRET: string;
  TURNSTILE_SITE_KEY: string;
  HMAC_KEY: string;
  RATE_LIMITER: { limit(opts: { key: string }): Promise<{ success: boolean }> };
  STATS_LIMITER: { limit(opts: { key: string }): Promise<{ success: boolean }> };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/verify") {
      return handleVerifyPage(url, env);
    }
    if (request.method === "POST" && url.pathname === "/verify") {
      return handleVerifySubmit(request, env, url);
    }
    if (request.method === "GET" && url.pathname === "/callback") {
      return handleCallback(url, env);
    }

    if (request.method === "POST" && url.pathname === "/interactions") {
      const { valid, body } = await verifyDiscordRequest(request, env.DISCORD_PUBLIC_KEY);
      if (!valid) {
        return new Response("Invalid request signature", { status: 401 });
      }

      const interaction = JSON.parse(body);

      if (interaction.type === 1) {
        return Response.json({ type: 1 });
      }
      if (interaction.type === 2) {
        const name = interaction.data?.name;
        if (name === "setup") return handleSetup(interaction, env, url.origin);
        if (name === "source") return handleSource();
        if (name === "statistics") return handleStatistics(interaction, env, ctx);
      }
      return Response.json({ type: 4, data: { content: "Unknown command.", flags: 64 } });
    }

    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;