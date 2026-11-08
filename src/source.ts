const REPO_URL = "https://github.com/MeTheHan/discord-verify-bot";

// Bağış adresi isteğe bağlı. Boş bırakırsanız bağış satırı gösterilmez.
// Yalnızca ortak (public) adresi yazın. Asla cüzdan anahtarı veya seed phrase yazmayın.
// Ağ (network) bilgisi mutlaka yazılmalı, yanlış ağa gönderilen varlık kurtarılamayabilir.
const DONATION = {
  network: "Bitcoin (BTC)", // örnek: "Solana (SOL)" ya da "USDT (TRC20)"
  address: "bc1qdk6yeryfgautz8dpsys3s6r4pqrlxdvh9q68sn", // ortak cüzdan adresi
};

export function handleSource(): Response {
  const lines = [
    "**Authify is open source (MIT).**",
    `Source code: ${REPO_URL}`,
    "Found a security issue? Please follow SECURITY.md in the repository and do not post it publicly.",
  ];

  if (DONATION.address && DONATION.network) {
    lines.push("", `Support the project (${DONATION.network}): \`${DONATION.address}\``);
  }

  // Herkesin görmesi için ephemeral değil. Link önizlemesini kapatıyoruz.
  return Response.json({ type: 4, data: { content: lines.join("\n"), flags: 4 } });
}