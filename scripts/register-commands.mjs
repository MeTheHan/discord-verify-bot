import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".dev.vars", "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("="))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
);

const url = `https://discord.com/api/v10/applications/${env.DISCORD_CLIENT_ID}/commands`;

const command = {
  name: "setup",
  description: "Post the human verification message to a channel",
  default_member_permissions: "32",
  dm_permission: false,
  options: [
    {
      type: 7,
      name: "channel",
      description: "Channel where the verification message will be posted",
      required: true,
      channel_types: [0],
    },
    {
      type: 8,
      name: "verified_role",
      description: "Role granted after successful verification",
      required: true,
    },
    {
      type: 8,
      name: "unverified_role",
      description: "Optional role removed after verification",
      required: false,
    },
  ],
};

const res = await fetch(url, {
  method: "POST",
  headers: {
    Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(command),
});

console.log("HTTP", res.status);
console.log(await res.text());