const { Client, GatewayIntentBits, ActivityType, Events, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');

// --- [1. เชื่อมต่อ Database] ---
if (mongoose.connection.readyState === 0) {
    mongoose.connect(process.env.MONGO_URL)
        .then(() => console.log('Bot DB Connected! ✅'))
        .catch(err => console.error('DB Error:', err));
}

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
        GatewayIntentBits.GuildVoiceStates // จำเป็นสำหรับ Voice Log และเช็กคนหาย
    ]
});

// ส่งออก client เพื่อให้ member-management.js นำไปใช้งานได้
module.exports = { client };

// --- [2. โหลดระบบแยก] ---
require('./media-tracker.js'); // ระบบแจ้งเตือนหนัง/อนิเมะ
const { initMemberManagement } = require('./member-management.js');
initMemberManagement(client); // รันระบบรับยศและเช็กคนหาย

// --- [3. ระบบ Welcome & Voice Log] ---
const WELCOME_CHANNEL_ID = '1205000338382524416'; 
const LOG_CHANNEL_ID = '1204742409347534900';     

client.on(Events.GuildMemberAdd, async (member) => {
    try {
        const channel = await client.channels.fetch(WELCOME_CHANNEL_ID);
        if (channel) {
            const welcomeEmbed = new EmbedBuilder()
                .setColor('#5865f2')
                .setTitle('👋 ยินดีต้อนรับสมาชิกใหม่!')
                .setDescription(`สวัสดีคุณ ${member} ยินดีต้อนรับเข้าสู่เซิร์ฟเวอร์!\nสมาชิกคนที่: **${member.guild.memberCount}**`)
                .setThumbnail(member.user.displayAvatarURL())
                .setTimestamp();
            await channel.send({ embeds: [welcomeEmbed] });
        }
    } catch (e) { console.error("Welcome Error:", e); }
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    try {
        const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (!logChannel) return;
        const user = newState.member.user;
        const time = new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' });
        if (!oldState.channelId && newState.channelId) {
            await logChannel.send(`\`\`\`diff\n+ [เข้าห้อง] ${user.username} -> ${newState.channel.name} (${time})\n\`\`\``);
        } else if (oldState.channelId && !newState.channelId) {
            await logChannel.send(`\`\`\`diff\n- [ออกห้อง] ${user.username} -> ${oldState.channel.name} (${time})\n\`\`\``);
        }
    } catch (e) { console.error("Voice Log Error:", e); }
});

client.once(Events.ClientReady, c => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
    client.user.setActivity('Masaru Dashboard', { type: ActivityType.Watching });
});

// --- [4. ระบบ XP & Level] ---
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;
    if (message.content === '!stat') {
        const data = await User.findOne({ userId: message.author.id });
        if (data) return message.reply(`📊 **สถานะของคุณ ${message.author.username}**\n⭐ เลเวล: ${data.level}\n✨ XP: ${data.xp}/${data.level * 100}`);
    }
    try {
        let data = await User.findOne({ userId: message.author.id }) || new User({ userId: message.author.id });
        data.xp += 20;
        if (data.xp >= (data.level * 100)) {
            data.level += 1;
            message.reply(`🎉 ยินดีด้วย! เลเวลอัปเป็น **${data.level}**!`);
        }
        await data.save();
    } catch (e) {}
});

client.login(process.env.TOKEN);