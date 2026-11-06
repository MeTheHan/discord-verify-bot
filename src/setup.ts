import type { Env } from "./index";

const SNOWFLAKE = /^\d{17,20}$/;
const MANAGE_GUILD = 0x20n;
const ADMINISTRATOR = 0x8n;

export function hasManageGuild(perms: string | undefined): boolean {
  if (!perms) return false;
  const p = BigInt(perms);
  return (p & MANAGE_GUILD) !== 0n || (p & ADMINISTRATOR) !== 0n;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function ephemeral(content: string): Response {
  return Response.json({ type: 4, data: { content, flags: 64 } });
}

export async function handleSetup(
  interaction: any,
  env: Env,
  origin: string,
): Promise<Response> {
  // Yetkiyi Discord'un gönderdiği member.permissions alanından kontrol et.
  // Komut tarafındaki default_member_permissions yalnızca ilk filtredir.
  if (!hasManageGuild(interaction.member?.permissions)) {
    return ephemeral("You need the Manage Server permission to use this command.");
  }

  const options: { name: string; value: string }[] = interaction.data?.options ?? [];
  const get = (name: string) => options.find((o) => o.name === name)?.value;

  const channelId = get("channel");
  const verifiedRole = get("verified_role");
  const unverifiedRole = get("unverified_role");

  if (!channelId || !SNOWFLAKE.test(channelId)) {
    return ephemeral("Invalid channel.");
  }
  if (!verifiedRole || !SNOWFLAKE.test(verifiedRole)) {
    return ephemeral("Invalid verified role.");
  }
  if (unverifiedRole !== undefined && !SNOWFLAKE.test(unverifiedRole)) {
    return ephemeral("Invalid unverified role.");
  }

  const guildId = interaction.guild_id;
  if (!guildId || !SNOWFLAKE.test(guildId)) {
    return ephemeral("This command only works in a server.");
  }

  // Link parametrelerini HMAC ile imzala. Kullanıcı bunları değiştirirse imza tutmaz.
  const u = unverifiedRole ?? "";
  const sig = await hmacHex(env.HMAC_KEY, `${guildId}.${verifiedRole}.${u}`);
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

  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });

  if (!res.ok) {
    // Hata ayrıntısını kullanıcıya göstermiyoruz, sadece ipucu veriyoruz.
    return ephemeral(
      "Could not post the message. Check that the bot can view and send messages in that channel.",
    );
  }

  return ephemeral("Verification message posted.");
}