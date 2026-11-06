# Privacy Policy

This bot verifies that a Discord user is a human and then grants a role on the server where the verification was started.

## What we collect

We do not store personal data.

During verification the bot receives your Discord user ID through Discord's OAuth2 "identify" permission. The ID is used once to grant or remove a role and is then discarded. We do not store your Discord access token, email address, IP address, username or any other profile data.

The verification page uses Cloudflare Turnstile to check that you are a human. Turnstile is provided by Cloudflare and processes the request under Cloudflare's own privacy policy.

## What is stored

Only short-lived, non-personal counters are kept to limit how many verification attempts a server can make per minute. These are keyed by server (guild) ID, not by user or IP address, and expire automatically after one minute.

Request logging is disabled, so request URLs (including OAuth parameters) are not written to logs.

## Your rights

Because we do not store your personal data, there is nothing to export or delete on our side. You can remove the bot's role at any time through Discord, and you can revoke the bot's access in Discord under Settings → Authorized Apps.

## Contact

For privacy questions, open a GitHub issue or use the private contact described in SECURITY.md.
