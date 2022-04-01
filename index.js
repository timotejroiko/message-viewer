"use strict";

const Discord = require("discord.js-light");

/* @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ CLIENT @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@*/

Discord.Structures.extend("Message", M => class Message extends M {
	async send(content, options) {
		let sent;
		if(this.editedTimestamp && this.client.responses.has(this.id)) {
			const previous = this.client.responses.get(this.id);
			const m = this.channel.messages.forge(previous.id);
			if(previous.attachments) {
				m.delete().catch(() => {});
				sent = await this.channel.send(content, options);
			} else {
				if(previous.embeds && !options.embed && !(content instanceof Discord.MessageEmbed)) {
					options.embed = null;
				}
				sent = await m.edit(content, options);
			}
		} else {
			sent = await this.channel.send(content, options);
		}
		this.client.responses.set(this.id, {
			id: sent.id,
			attachments: Boolean(sent.attachments.size),
			embeds: Boolean(sent.embeds.length),
			timestamp: Date.now()
		});
		return sent;
	}
});

const client = new Discord.Client({ ws: { intents: 1 + 512 } });

client.responses = new Discord.Collection();

client.login(process.env.DISCORD_TOKEN).catch(console.log);

/* @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ EVENTS @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@*/

client.on("ready", () => {
	console.log("Client Ready");
});

client.on("rateLimit", e => {
	console.log("Rate Limited", e);
});

client.on("warn", e => {
	console.log("Warning", e);
});

client.on("error", e => {
	console.log("Error", e);
});

client.on("shardDisconnect", (e, id) => {
	console.log(`[Shard ${id}] Died and will not reconnect. Reason:`, e);
});

client.on("shardError", (e, id) => {
	console.log(`[Shard ${id}] Error`, e);
});

client.on("shardReconnecting", id => {
	console.log(`[Shard ${id}] Reconnecting`);
});

client.on("shardResume", (id) => {
	console.log(`[Shard ${id}] Resumed`);
});

client.on("shardConnect", (shard, guilds) => {
	console.log(`[Shard ${shard}] Connected! Awaiting ${guilds.size} Guilds`);
});

client.on("message", message => {
	msg(message);
});

client.on("messageUpdate", (old, message) => {
	msg(message);
});

/* @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ MESSAGE @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@*/

function msg(message) {
	if(!message.content) { return; }
	if(message.content.indexOf("discord.com/channels/") > -1) {
		extract(message, message.content, "discord.com");
	} else if(message.content.indexOf("discordapp.com/channels/") > -1) {
		extract(message, message.content, "discordapp.com");
	}
}

function extract(message, content, domain, seen = []) {
	const split = content.split(`${domain}/channels/`)[1].split("/");
	const g = (split[0] || "").replace(/\D+/g, "");
	const c = (split[1] || "").replace(/\D+/g, "");
	const m = ((split[2] || "").split(" ")[0] || "").replace(/\D+/g, "");
	const s = message.guild ? message.guild.shardID : 0;
	console.log(`[Shard ${s}] Processing ${g} ${c} ${m}`);
	if(g && c && m) {
		if(!client.guilds.cache.has(g)) {
			console.log(`[Shard ${s}] Failed (not in guild)`);
			return;
		}
		if(seen.includes(g + c + m)) {
			const a = content.replace(`${domain}/channels/`, "");
			if(a.indexOf(`${domain}/channels/`) > -1) {
				extract(message, a, domain, seen);
			}
			return;
		}
		seen.push(g + c + m);
		client.channels.forge(c, "text").messages.fetch(m, false).then(tm => {
			const x = tm.content && !tm.content.startsWith(">>>") && tm.content.length < 1995 ? `>>> ${tm.content}` : tm.content;
			const opts = {};
			if(tm.embeds.length) { opts.embed = tm.embeds[0]; }
			if(tm.attachments.size) { opts.files = tm.attachments.map(t => ({
				attachment: t.attachment,
				name: t.name
			})); }
			message.send(x, opts).then(() => {
				console.log(`[Shard ${s}] Success`);
				const a = content.replace(`${domain}/channels/`, "");
				if(a.indexOf(`${domain}/channels/`) > -1) {
					extract(message, a, domain, seen);
				}
			}).catch(() => {
				console.log(`[Shard ${s}] Failed (no permissions)`);
			});
		}).catch(() => {
			console.log(`[Shard ${s}] Failed (not found)`);
		});
	}
}
