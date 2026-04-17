const { Client, GatewayIntentBits, ActivityType, Events } = require('discord.js');
const mongoose = require('mongoose');

// --- [1. เชื่อมต่อ Database] ---
if (mongoose.connection.readyState === 0) {
    mongoose.connect(process.env.MONGO_URL, { serverSelectionTimeoutMS: 5000 })
    .then(() => console.log('Bot DB Connected! ✅'))
    .catch(err => console.error('❌ DB Error:', err.message));
}

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
initSystemLogs(client); // ระบบใหม่ส่งเข้าห้อง 928370

// --- [3. ตั้งค่า ID ห้อง Log ระบบเก่า (|-in-out)] ---
const OLD_LOG_CHANNEL_ID = '1204742409347534900'; 

// 🔊 ระบบ Log ห้องเสียง (รูปแบบ diff สีเขียว/แดง)
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
client.on(Events.GuildMemberAdd, async (member) => {
    const channel = await client.channels.fetch(OLD_LOG_CHANNEL_ID).catch(() => null);
    if (channel) await channel.send(`\`\`\`diff\n+ [สมาชิกใหม่] ${member.user.username} ได้เข้าร่วมกลุ่มแล้ว\n\`\`\``);
});

client.on(Events.GuildMemberRemove, async (member) => {
    const channel = await client.channels.fetch(OLD_LOG_CHANNEL_ID).catch(() => null);
    if (channel) await channel.send(`\`\`\`diff\n- [สมาชิกออก] ${member.user.username} ได้ออกจากกลุ่มไปแล้ว\n\`\`\``);
});

client.once(Events.ClientReady, (c) => {
    console.log(`✅ บอทออนไลน์แล้ว: ${c.user.tag}`);
    client.user.setActivity('ระบบ Log แยกห้อง', { type: ActivityType.Watching });
});

client.login(process.env.TOKEN);