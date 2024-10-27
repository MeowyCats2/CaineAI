import { Client, Events, GatewayIntentBits } from "discord.js";
export const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ]
});
client.once(Events.ClientReady, (readyClient: Client) => {
	console.log(`Ready! Logged in as ${readyClient.user!.tag}`);
});
await client.login(process.env.token);