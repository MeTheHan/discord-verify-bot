import type { Env } from "./index";
import { isSnowflake } from "./util";
import { hasManageGuild } from "./setup";

const DISCORD_API = "https://discord.com/api/v10";
const PAGE_SIZE = 1000;
// Ücretsiz planda istek başına 10 ms CPU sınırı var. Çok büyük sunucularda
// tarama bu sınıra takılmasın diye taranan sayfa sayısını sınırlıyoruz.
const MAX_PAGES = 5;
const TIMEOUT_MS = 5000;

type Member = { roles?: unknown; user?: { id?: unknown } };

function ephemeral(content: string): Response {
  return Response.json({ type: 4, data: { content, flags: 64 } });
}

// Veri saklanmaz. Sayım, üye listesi sayfa sayfa okunarak anlık yapılır.
async function countRoleHolders(
  env: Env,
  guildId: string,
  roleId: string,
): Promise<{ count: number; capped: boolean }> {
  let count = 0;
  let after = "0";

  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetch(
      `${DISCORD_API}/guilds/${guildId}/members?limit=${PAGE_SIZE}&after=${after}`,
      {
        headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    ).catch(() => null);

    if (res?.status === 429) throw new Error("rate limited");
    if (!res) throw new Error("network error");
    if (!res.ok) throw new Error(`member fetch failed: HTTP ${res.status}`);

    const members = (await res.json().catch(() => null)) as Member[] | null;
    if (!Array.isArray(members)) throw new Error("bad member response");

    for (const m of members) {
      if (Array.isArray(m.roles) && m.roles.includes(roleId)) count++;
    }

    if (members.length < PAGE_SIZE) return { count, capped: false };

    const lastId = members[members.length - 1]?.user?.id;
    if (!isSnowflake(lastId)) throw new Error("missing cursor");
    after = lastId;
  }

  return { count, capped: true };
}

async function sendFollowUp(env: Env, interactionToken: string, content: string): Promise<void> {
  // Ertelenmiş yanıtı (type 5) düzenleyerek sonucu gönderir.
  await fetch(
    `${DISCORD_API}/webhooks/${env.DISCORD_CLIENT_ID}/${interactionToken}/messages/@original`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    },
  ).catch(() => null);
}

export async function handleStatistics(interaction: any, env: Env, ctx: ExecutionContext): Promise<Response> {
  if (!hasManageGuild(interaction.member?.permissions)) {
    return ephemeral("You need the Manage Server permission to use this command.");
  }

  const options = Array.isArray(interaction.data?.options) ? interaction.data.options : [];
  const roleId = options.find((o: any) => o?.name === "verified_role")?.value;
  const guildId = interaction.guild_id;
  if (!isSnowflake(roleId) || !isSnowflake(guildId)) {
    return ephemeral("Invalid request.");
  }

  // Sunucu başına sıkı sınır. Ayrı binding olduğu için doğrulama akışını etkilemez.
  const stats = await env.STATS_LIMITER.limit({ key: guildId });
  if (!stats.success) {
    return ephemeral("Statistics can be checked once every minute per server. Please try again later.");
  }

  const token = interaction.token;
  if (typeof token !== "string") {
    return ephemeral("Invalid request.");
  }

  // Discord 3 saniye içinde yanıt bekler. Hesaplamayı arka planda yapıp sonucu sonra gönderiyoruz.
  ctx.waitUntil(
    (async () => {
      let text: string;
      try {
        const { count, capped } = await countRoleHolders(env, guildId, roleId);
        text = capped
          ? `Scanned the first ${PAGE_SIZE * MAX_PAGES} members. Verified members found: **${count}**`
          : `Members with the verified role: **${count}**`;
      } catch (err) {
        // Yalnızca hata türünü yazar. Kullanıcı ya da sunucu bilgisi içermez.
        console.log("statistics error:", err instanceof Error ? err.message : "unknown");
        text =
          err instanceof Error && err.message === "rate limited"
            ? "Discord is rate limiting this request. Please try again in a few minutes."
            : "Could not count members right now. Please try again later.";
      }
      await sendFollowUp(env, token, `${text}\nCounted live from Discord. Nothing is stored.`);
    })(),
  );

  return Response.json({ type: 5, data: { flags: 64 } });
}