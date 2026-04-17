const { Client, GatewayIntentBits, ActivityType, Events, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');

// --- [1. เชื่อมต่อ Database] ---
if (mongoose.connection.readyState === 0) {
    mongoose.connect(process.env.MONGO_URL).catch(err => console.error('DB Error:', err.message));
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.GuildVoiceStates 
    ]
});

// --- [2. โหลดระบบแยก] ---
require('./media-tracker.js'); 
const { initMemberManagement } = require('./member-management.js');
const { initSystemLogs } = require('./system-logs.js');

initMemberManagement(client); 
initSystemLogs(client); // รันระบบใหม่ (Message Log)

// --- [3. ตั้งค่า ID ห้อง Log ระบบเก่า] ---
const OLD_SYSTEM_LOG_CHANNEL_ID = '1204742409347534900'; 

async function sendOldLog(embed) {
    try {
        const channel = await client.channels.fetch(OLD_SYSTEM_LOG_CHANNEL_ID);
        if (channel) await channel.send({ embeds: [embed] });
    } catch (e) {}
}

// 🔊 ระบบ Log ห้องเสียง (ส่งเข้าห้องเก่า)
client.on(Events.VoiceStateUpdate, (oldState, newState) => {
    const member = newState.member || oldState.member;
    const embed = new EmbedBuilder().setTimestamp();

    if (!oldState.channelId && newState.channelId) {
        embed.setColor('#2ecc71').setDescription(`🔊 **${member.user.tag}** เข้าห้อง **${newState.channel.name}**`);
        sendOldLog(embed);
    } else if (oldState.channelId && !newState.channelId) {
        embed.setColor('#e74c3c').setDescription(`🔇 **${member.user.tag}** ออกจากห้อง **${oldState.channel.name}**`);
        sendOldLog(embed);
    } else if (oldState.channelId !== newState.channelId) {
        embed.setColor('#3498db').setDescription(`🔄 **${member.user.tag}** ย้ายห้องเสียงไปยัง **${newState.channel.name}**`);
        sendOldLog(embed);
    }
});

// 📥 ระบบ Log คนเข้า-ออกเซิร์ฟเวอร์ (ส่งเข้าห้องเก่า)
client.on(Events.GuildMemberAdd, (member) => {
    const embed = new EmbedBuilder().setColor('#2ecc71').setTitle('📥 สมาชิกเข้าใหม่').setDescription(`${member.user.tag} เข้าร่วมเซิร์ฟเวอร์`).setTimestamp();
    sendOldLog(embed);
});

client.on(Events.GuildMemberRemove, (member) => {
    const embed = new EmbedBuilder().setColor('#c0392b').setTitle('📤 สมาชิกออก').setDescription(`${member.user.tag} ออกจากเซิร์ฟเวอร์แล้ว`).setTimestamp();
    sendOldLog(embed);
});

client.once(Events.ClientReady, (c) => {
    console.log(`✅ Ready! ${c.user.tag}`);
    client.user.setActivity('ระบบ Log แยกห้อง', { type: ActivityType.Watching });
});

client.login(process.env.TOKEN);