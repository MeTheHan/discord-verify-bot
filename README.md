# Discord Verify Bot

An open-source human verification bot for Discord. Members click a button, complete a Cloudflare Turnstile check, and receive a role. The bot does not store personal data.

## Add the bot to your server

1. Open this link and choose your server (you need the "Manage Server" permission):
   `https://discord.com/oauth2/authorize?client_id=1568336029264388186&scope=bot+applications.commands&permissions=268437504`
2. Make sure the bot's role is above the role it will grant in **Server Settings → Roles**.

## Setup

In any channel, run:

    /setup channel:#verify verified_role:@Verified unverified_role:@Unverified

- `channel`: where the verification message will be posted
- `verified_role`: role granted after successful verification (required)
- `unverified_role`: role removed after verification (optional)

Recommended: deny "View Channel" for `@everyone` on your server, and allow it only for `@Verified`. Then only the verification channel is visible to new members.

## Privacy and security

- See [PRIVACY.md](PRIVACY.md) for what is and is not stored.
- See [SECURITY.md](SECURITY.md) for how to report vulnerabilities.
- The source code is public. Each release is tagged; compare the deployed behavior with the code at the matching tag.

## Limits

Verification makes spam accounts more expensive but cannot guarantee that a user is a real person. Please treat it as one layer of moderation.

## License

MIT (see LICENSE).
