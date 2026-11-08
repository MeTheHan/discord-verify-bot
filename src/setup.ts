import type { Env } from "./index";
import { isSnowflake, signHex } from "./util";

const MANAGE_GUILD = 0x20n;
const ADMINISTRATOR = 0x8n;
const DISCORD_API = "https://discord.com/api/v10";
const TIMEOUT_MS = 5000;

export function hasManageGuild(perms: unknown): boolean {
  if (typeof perms !== "string" || !/^\d+$/.test(perms)) return false;
  const p = BigInt(perms);
  return (p & MANAGE_GUILD) !== 0n || (p & ADMINISTRATOR) !== 0n;
}

function ephemeral(content: string): Response {
  return Response.json({ type: 4, data: { content, flags: 64 } });
}

export async function handleSetup(
  interaction: any,
  env: Env,
  origin: string,
): Promise<Response> {
  // Yetki kontrolü: Discord'un gönderdiği member.permissions değeri esas alınır.
  if (!hasManageGuild(interaction.member?.permissions)) {
    return ephemeral("You need the Manage Server permission to use this command.");
  }

  const options: unknown = interaction.data?.options;
  if (!Array.isArray(options)) {
    return ephemeral("Invalid command options.");
  }
  const get = (name: string): string | undefined => {
    const found = options.find((o: any) => o?.name === name);
    return typeof found?.value === "string" ? found.value : undefined;
  };

  const channelId = get("channel");
  const verifiedRole = get("verified_role");
  const unverifiedRole = get("unverified_role");

  if (!isSnowflake(channelId)) return ephemeral("Invalid channel.");
  if (!isSnowflake(verifiedRole)) return ephemeral("Invalid verified role.");
  if (unverifiedRole !== undefined && !isSnowflake(unverifiedRole)) {
    return ephemeral("Invalid unverified role.");
  }

  const guildId = interaction.guild_id;
  if (!isSnowflake(guildId)) {
    return ephemeral("This command only works in a server.");
  }

  // Link parametrelerini HMAC ile imzala. Kullanıcı bunları değiştirirse imza tutmaz.
  const u = unverifiedRole ?? "";
  const sig = await signHex(env.HMAC_KEY, `${guildId}.${verifiedRole}.${u}`);
  const params = new URLSearchParams({ g: guildId, v: verifiedRole, sig });
  if (u) params.set("u", u);
  const verifyUrl = `${origin}/verify?${params.toString()}`;

  const message = {
    content:
      "**Human verification**\nClick the button below to verify that you are a human and get access to the server.",
    components: [
      {
        type: 1,
        components: [{ type: 2, style: 5, label: "Verify", url: verifyUrl }],
      },
    ],
  };

  const res = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => null);

  if (!res || !res.ok) {
    // Ayrıntıyı kullanıcıya göstermiyoruz, sadece ipucu veriyoruz.
    return ephemeral(
      "Could not post the message. Check that the bot can view and send messages in that channel.",
    );
  }

  return ephemeral("Verification message posted.");
}