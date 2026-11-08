<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="logo.png">
    <source media="(prefers-color-scheme: light)" srcset="light_logo.png">
    <img src="light_logo.png" width="128" alt="Authify logo">
  </picture>
</p>

<h1 align="center">Authify</h1>

<p align="center">
  Open-source human verification for Discord.<br>
  Members click a button, pass a Cloudflare Turnstile check, and receive a role.
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <a href="SECURITY.md"><img alt="Security policy" src="https://img.shields.io/badge/security-policy-green.svg"></a>
</p>

---

## Why Authify

- **Open source.** The code that handles verification is in this repository.
- **No personal data stored.** No IP addresses, emails, or Discord tokens are kept. See [PRIVACY.md](PRIVACY.md).
- **Free to run.** Built on Cloudflare Workers and Turnstile free tiers.
- **Simple setup.** One slash command creates the verification message.

## Add the official bot to your server

1. Open this link and choose your server (you need the **Manage Server** permission):

   <https://discord.com/oauth2/authorize?client_id=1568336029264388186&scope=bot+applications.commands&permissions=268437504>

2. In **Server Settings → Roles**, drag the bot's role above the role it will grant.

## Commands

| Command | Who can use it | What it does |
| --- | --- | --- |
| `/setup` | Manage Server | Posts the verification message to a channel |
| `/statistics` | Manage Server | Counts members who currently hold the verified role |
| `/source` | Everyone | Shows the source code link and the security policy |

### `/setup`

Run this in any channel:

```
/setup channel:#verify verified_role:@Verified unverified_role:@Unverified
```

| Option | Required | Description |
| --- | --- | --- |
| `channel` | Yes | Where the verification message will be posted |
| `verified_role` | Yes | Role granted after successful verification |
| `unverified_role` | No | Role removed after verification |

**Recommended:** Deny *View Channel* for `@everyone` and allow it only for `@Verified`. New members will then see only the verification channel.

**Note:** Verification buttons are tied to the roles they were created with. If you change roles later, run `/setup` again and delete the old message.

### `/statistics`

Counts members who hold the verified role, live from Discord, each time it is run. The result is not stored. This command is limited to once per minute per server and checks at most 5,000 members.

This command uses the **Server Members** privileged intent, which Discord requires to read the member list. No other part of the bot uses privileged intents.

## How it works

1. A member clicks **Verify** on the message.
2. The verification page checks the member with Cloudflare Turnstile.
3. Discord asks the member to authorize the `identify` scope, which provides only the user ID.
4. The bot grants the verified role and removes the unverified role, if set.

## Run your own instance

You can run Authify on your own Cloudflare account and Discord application. This is useful if you do not want to rely on the official bot.

**Requirements:** Node.js LTS, a Cloudflare account (free plan), a Discord account, Git.

1. **Create a Discord application** at the [Developer Portal](https://discord.com/developers/applications). Note the Application ID, Public Key, Bot Token, and Client Secret. Under **Bot → Privileged Gateway Intents**, enable **Server Members Intent** if you want to use `/statistics`.
2. **Clone and install:**
   ```
   git clone https://github.com/MeTheHan/discord-verify-bot.git
   cd discord-verify-bot
   npm install
   ```
3. **Create a Turnstile widget** in the Cloudflare dashboard. Add your Worker's hostname to it. Note the site key and secret key.
4. **Set the Turnstile site key** in `wrangler.jsonc` under `vars` as `TURNSTILE_SITE_KEY`. The site key is public.
5. **Add secrets** with Wrangler. Each command prompts for the value. Never put these values in code or in the repository:
   ```
   npx wrangler secret put DISCORD_PUBLIC_KEY
   npx wrangler secret put DISCORD_BOT_TOKEN
   npx wrangler secret put DISCORD_CLIENT_ID
   npx wrangler secret put DISCORD_CLIENT_SECRET
   npx wrangler secret put TURNSTILE_SECRET
   npx wrangler secret put HMAC_KEY
   ```
   Generate `HMAC_KEY` with a long random value, at least 32 bytes. For example, `openssl rand -hex 32` or a password manager's generator.
6. **Deploy:**
   ```
   npx wrangler deploy
   ```
7. **Configure Discord:**
   - In **OAuth2 → Redirects**, add `https://<your-worker>/callback`.
   - In **Installation**, set the install link to Discord-provided with scopes `bot` and `applications.commands`, and permissions `268437504`.
   - In **Bot**, decide whether the bot should be public. A private bot can only be added by you.
8. **Register the commands.** Set `DISCORD_CLIENT_ID` and `DISCORD_BOT_TOKEN` in a local `.dev.vars` file, then run:
   ```
   node scripts/register-commands.mjs
   ```
   The script replaces the full command list with `/setup`, `/statistics`, and `/source`. Global commands can take up to an hour to appear.

Keep your `.dev.vars` file local. It is listed in `.gitignore` and must never be committed.

## Privacy and security

- [PRIVACY.md](PRIVACY.md): what is and is not stored.
- [SECURITY.md](SECURITY.md): how to report vulnerabilities privately.
- Releases are tagged. The code at a tag is the code that was reviewed for that version.

## Limits

Verification raises the cost of spam accounts but cannot guarantee that a user is a real person. Treat it as one layer of moderation, not a complete solution.

## Contributing

Issues and pull requests are welcome. For security problems, please follow [SECURITY.md](SECURITY.md) and do not open a public issue.

## License

[MIT](LICENSE)