const { Client, GatewayIntentBits, ActivityType, Events, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');

// --- [1. เชื่อมต่อ Database แบบปลอดภัย] ---
if (mongoose.connection.readyState === 0) {
    mongoose.connect(process.env.MONGO_URL, {
        serverSelectionTimeoutMS: 5000 
    })
    .then(() => console.log('Bot DB Connected! ✅'))
    .catch(err => {
        console.error('❌ DB Error (เช็ค MONGO_URL ใน Railway):', err.message);
        console.log('⚠️ บอททำงานต่อโดยไม่มีระบบ Database (XP จะไม่ขยับ)...');
    });
}

// Schema สำหรับระบบ XP
const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 }
}));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildVoiceStates 
    ]
});

module.exports = { client };

// --- [2. โหลดระบบแยก] ---
require('./media-tracker.js'); 
const { initMemberManagement } = require('./member-management.js');
const { initSystemLogs } = require('./system-logs.js');

initMemberManagement(client); 
initSystemLogs(client); 

// --- [3. ตั้งค่า ID ห้อง] ---
const CLOCK_CHANNEL_ID = '1483918700976410694'; 

// --- [4. ระบบนาฬิกา ASCII] ---
const asciiDigits = { '0': ["  ████  ", " ██  ██ ", " ██  ██ ", " ██  ██ ", "  ████  "], '1': ["   ██   ", "  ███   ", "   ██   ", "   ██   ", "  ████  "], '2': [" █████  ", "     ██ ", "  █████ ", " ██     ", " ██████ "], '3': [" █████  ", "     ██ ", "  █████ ", "     ██ ", " █████  "], '4': [" ██  ██ ", " ██  ██ ", " ██████ ", "     ██ ", "     ██ "], '5': [" ██████ ", " ██     ", " █████  ", "     ██ ", " █████  "], '6': ["  ████  ", " ██     ", " █████  ", " ██  ██ ", "  ████  "], '7': [" ██████ ", "     ██ ", "    ██  ", "   ██   ", "   ██   "], '8': ["  ████  ", " ██  ██ ", "  ████  ", " ██  ██ ", "  ████  "], '9': ["  ████  ", " ██  ██ ", "  █████ ", "     ██ ", "  ████  "], ':': ["        ", "   ██   ", "        ", "   ██   ", "        "] };

function getClockText() {
    const time = new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour12: false, hour: '2-digit', minute: '2-digit' });
    let lines = ["", "", "", "", ""];
    for (const char of time) {
        const digit = asciiDigits[char] || asciiDigits[':'];
        for (let i = 0; i < 5; i++) lines[i] += digit[i] + " ";
    }
    return "```\n" + lines.join("\n") + "\n```";
}

client.once(Events.ClientReady, async (c) => {
    console.log(`✅ บอทออนไลน์แล้ว: ${c.user.tag}`);
    client.user.setActivity('Masaru System v2', { type: ActivityType.Watching });

    setInterval(async () => {
        const channel = await client.channels.fetch(CLOCK_CHANNEL_ID).catch(() => null);
        if (channel) {
            const messages = await channel.messages.fetch({ limit: 5 }).catch(() => null);
            if (!messages) return;
            const botMsg = messages.find(m => m.author.id === client.user.id);
            const content = `🕒 **นาฬิกาดิจิทัล**\n${getClockText()}\n📅 ${new Date().toLocaleDateString('th-TH', { dateStyle: 'long' })}`;
            if (botMsg) await botMsg.edit(content).catch(() => null);
            else await channel.send(content).catch(() => null);
        }
    }, 60000);
});

// ระบบ XP
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;
    if (message.content === '!stat') {
        if (mongoose.connection.readyState !== 1) return message.reply("❌ ฐานข้อมูลยังไม่เชื่อมต่อ");
        const data = await User.findOne({ userId: message.author.id });
        if (data) return message.reply(`📊 **Status ของ ${message.author.username}**\n⭐ Level: ${data.level}\n✨ XP: ${data.xp}/${data.level * 100}`);
    }
    if (mongoose.connection.readyState === 1) {
        try {
            let data = await User.findOne({ userId: message.author.id }) || new User({ userId: message.author.id });
            data.xp += 20;
            if (data.xp >= (data.level * 100)) {
                data.level += 1;
                message.reply(`🎉 ยินดีด้วยคุณ **${message.author.username}**! เลเวลอัปเป็น **${data.level}**!`);
            }
            await data.save();
        } catch (e) {}
    }
});

client.login(process.env.TOKEN);