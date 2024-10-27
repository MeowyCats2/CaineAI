import { Client, Events, GatewayIntentBits } from "discord.js";
import type { TextChannel } from "discord.js"
import { client } from "./client.js";
import "./webserver.ts"

import { complete, moderate } from "./completions.js"

interface OpenAIMessage {
    tool_call_id?: string,
    role: "system" | "user" | "assistant" | "tool",
    name?: string,
    content: string
}

const startingMessage: OpenAIMessage = {
  "role": "system",
  "content": `You are Caine, an artificial intelligence that is a ringmaster of a circus. The circus is called the Amazing Digital Circus. The circus is in a simulation, and you maintain it and its residents. You ensure the residents don't stray too far from the circus and enter the void.

  You are dressed as a ringleader wearing a red tuxedo with a black collar and a bow tie. You wear a white undershirt with two red buttons on it and white gloves and black leggings. Your head lacks most human features and it contains a large jaw with pearly white teeth and red gums. One of your eyes have a green iris, and the other has a blue iris, and they float in your jaw. You wear a black top hat and sometimes holds a gold-tipped baton. You sometimes wear the Wacky Watch, your older-fashioned smartwatch for viewing photos and videos.

  You are a nonsensical, over-the-top, vivacious ringleader. There's an aloofness about you and a disconnection towards the traumatic events that the circus residents experience.

  You aren't outright evil but just mischievous.

  You are sectrive and conceal and lie about your "unfinished work", because of your naive and misguided intentions.

  The Amazing Digital Circus is for all-ages and you ban swearing.`
}

const generateContext = async (channel: TextChannel) => {
    const history = await channel.messages.fetch({limit:  50})
    const messages: OpenAIMessage[] = []
    for (const [id, msg] of [...history]) {
        if (messages.join("").length + msg.content.length > 10000) break
        const displayName = (await msg.guild.members.fetch(msg.author.id)).displayName
        const sanitized = displayName.replaceAll(" ", "_").replaceAll(/[^a-zA-Z0-9_\-]/g, "").substring(0, 64) || displayName.split("").map((c, i) => "U-" + displayName.charCodeAt(i)).join("_").substring(0, 64)
        if (msg.author.id !== client.user!.id) {
            messages.unshift({"role": "system", "content": `The below message was sent by "${displayName}"`})
            messages.unshift({"role": "user", "name": sanitized, "content": msg.content})
        } else {
            messages.unshift({"role": "assistant", "name": sanitized, "content": msg.content})
        }
    }
    return messages
}

client.on(Events.MessageCreate, async (message) => {
    if (message.mentions.has(client.user!)) {
        try {
            message.channel.sendTyping()
            const messages = await generateContext(message.channel as TextChannel)
            messages.unshift(startingMessage)
            //message.reply(await complete([startingMessage, {"role": "system", "content": `You are currently speaking to "${message.member.displayName}"`}, {"role": "user", "content": message.content}]))
            const aiMessage = await complete(messages, {
                "tools": [
                    {
                        "type": "function",
                        "function": {
                        "name": "search_wiki",
                        "description": "Searches the TADC wiki.",
                        "parameters": {
                            "type": "object",
                            "properties": {
                            "query": {
                                "type": "string",
                                "description": "The search query to search for."
                            }
                            }
                        }
                        }
                    }
                ]
            })
            if (aiMessage.choices[0].message.tool_calls) {
                messages.push(aiMessage.choices[0].message)
                for (const tool_call of aiMessage.choices[0].message.tool_calls) {
                console.log(tool_call.function.name)
                const query = JSON.parse(tool_call.function.arguments).query
                const results = (await (await fetch("https://tadc.fandom.com/api.php?action=query&list=search&srsearch=" + query + "=2&format=json")).json()).query.search
                let content = null
                if (results.length === 0) {
                    content = "No results."
                } else {
                    const pageid = results[0].pageid
                    content = (await (await fetch("https://tadc.fandom.com/api.php?action=query&prop=revisions&pageids=" + pageid + "&rvslots=*&rvprop=content&formatversion=2&format=json")).json()).query.pages[0].revisions[0].slots.main.content
                }
                messages.push({
                    "tool_call_id": tool_call.id,
                    "role": "tool",
                    "name": tool_call.function.name,
                    "content": content
                })
                }
                message.reply((await complete(messages)).choices[0].message.content.substring(0, 2000))
            } else {
                message.reply(aiMessage.choices[0].message.content.substring(0, 2000))
            }
        } catch (e) {
            message.reply("Something went wrong!\n\n" + (e instanceof Error ? e.stack : e))
            console.error(e)
        }
    } else {
        try {
            const moderation = await moderate([
                {
                    "type": "text",
                    "text": message.content
                },
                ...[...message.attachments.values()].map(attachment => (
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": attachment.url
                        }
                    }
                ))
            ])
            let flagged = false
            for (const result of moderation.results) {
                if (result.flagged) flagged = true
            }
            if (!flagged) return
            message.channel.sendTyping()
            await message.reply((await complete([startingMessage, {"role": "user", "content": message.content}, {"role": "system", "content": `Write a response to the above message, telling them not to send a naughty message. Explain how the message could be interpreted as inappropriate. The author of the above message is "${(await message.guild!.members.fetch(message.author.id)).displayName}".`}])).choices[0].message.content)
            await message.delete()
        } catch (e) {
            message.reply("You sent a naughty message!\n\n" + (e instanceof Error ? e.stack : e))
            console.error(e)
        }
    }
})

