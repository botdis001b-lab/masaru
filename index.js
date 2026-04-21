const { Client, GatewayIntentBits, ActivityType, Events, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');

// --- [1. เชื่อมต่อ Database] ---
if (mongoose.connection.readyState === 0) {
    mongoose.connect(process.env.MONGO_URL, { serverSelectionTimeoutMS: 5000 })
    .then(() => console.log('Bot DB Connected! ✅'))
    .catch(err => console.error('❌ DB Error (เช็ค MONGO_URL ใน Railway):', err.message));
}

// Schema สำหรับเก็บเลเวล (User XP)
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

// --- [2. โหลดระบบแยก] ---
require('./media-tracker.js'); 
const { initSystemLogs } = require('./system-logs.js');
const { initMemberManagement } = require('./member-management.js');

initSystemLogs(client); // ระบบ Log ใหม่ (ข้อความ)
initMemberManagement(client); // ระบบจัดการสมาชิกและยศ

const OLD_LOG_CHANNEL_ID = '1204742409347534900'; 

// 🔊 ระบบ Log ห้องเสียง (รูปแบบ diff สีเขียว/แดง ตามรูปที่ต้องการ)
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    try {
        const channel = await client.channels.fetch(OLD_LOG_CHANNEL_ID).catch(() => null);
        if (!channel) return;
        const user = newState.member.user;
        const time = new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour12: false });

        if (!oldState.channelId && newState.channelId) {
            await channel.send(`\`\`\`diff\n+ [เข้าห้อง] ${user.username} -> 🔊 ${newState.channel.name} (${time})\n\`\`\``);
        } else if (oldState.channelId && !newState.channelId) {
            await channel.send(`\`\`\`diff\n- [ออกห้อง] ${user.username} -> 🔊 ${oldState.channel.name} (${time})\n\`\`\``);
        } else if (oldState.channelId !== newState.channelId) {
            await channel.send(`\`\`\`diff\n! [ย้ายห้อง] ${user.username} : ${oldState.channel.name} -> ${newState.channel.name} (${time})\n\`\`\``);
        }
    } catch (e) {}
});

// 📥 ระบบคนเข้า-ออกเซิร์ฟเวอร์
client.on(Events.GuildMemberAdd, async (m) => {
    const ch = await client.channels.fetch(OLD_LOG_CHANNEL_ID).catch(() => null);
    if (ch) await ch.send(`\`\`\`diff\n+ [สมาชิกใหม่] ${m.user.username} เข้าร่วมเซิร์ฟเวอร์\n\`\`\``);
});

client.on(Events.GuildMemberRemove, async (m) => {
    const ch = await client.channels.fetch(OLD_LOG_CHANNEL_ID).catch(() => null);
    if (ch) await ch.send(`\`\`\`diff\n- [สมาชิกออก] ${m.user.username} ออกจากเซิร์ฟเวอร์\n\`\`\``);
});

// ⭐ [3. ระบบเลเวล และ XP] ⭐
const cooldowns = new Set();
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;

    if (message.content === '!level') {
        const data = await User.findOne({ userId: message.author.id });
        if (!data) return message.reply("ยังไม่มีข้อมูล ลองพิมพ์คุยกันก่อนนะ!");
        return message.reply(`📊 **${message.author.username}** | เลเวล: ${data.level} | XP: ${data.xp}/${data.level * 100}`);
    }

    if (cooldowns.has(message.author.id)) return;
    try {
        if (mongoose.connection.readyState === 1) {
            let data = await User.findOne({ userId: message.author.id });
            if (!data) data = new User({ userId: message.author.id });
            data.xp += Math.floor(Math.random() * 11) + 15;
            if (data.xp >= data.level * 100) {
                data.xp = 0; data.level += 1;
                message.reply(`🎊 ยินดีด้วยคุณ **${message.author.username}**! เลเวลอัปเป็น **${data.level}**!`);
            }
            await data.save();
            cooldowns.add(message.author.id);
            setTimeout(() => cooldowns.delete(message.author.id), 60000);
        }
    } catch (e) { console.error("XP Error:", e.message); }
});

client.once(Events.ClientReady, (c) => {
    console.log(`✅ บอท Masaru พร้อมทำงานทุกระบบ!`);
    client.user.setActivity('ระบบ Log & XP (Full)', { type: ActivityType.Watching });
});

client.login(process.env.TOKEN);