require('./media-tracker.js'); // รันระบบติดตามอนิเมะ/หนัง
require('./member-management.js'); // รันระบบเช็กคนหาย 10 วัน และปุ่มรับยศ
const { Client, GatewayIntentBits, ActivityType, Events, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');

// --- [ส่วนที่ 1: เชื่อมต่อ Database] ---
if (mongoose.connection.readyState === 0) {
    mongoose.connect(process.env.MONGO_URL)
        .then(() => console.log('Bot DB Connected! ✅'))
        .catch(err => console.error('DB Error:', err));
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
        GatewayIntentBits.GuildVoiceStates // จำเป็นสำหรับ Voice Log และระบบเช็กคนหาย
    ]
});

// ส่งออก client เพื่อให้ไฟล์อื่น (เช่น member-management.js) เรียกใช้ได้
module.exports = { client }; 

// ตั้งค่า ID ห้องต่างๆ
const WELCOME_CHANNEL_ID = '1205000338382524416'; 
const LOG_CHANNEL_ID = '1204742409347534900';     

// --- [ระบบ 1: Welcome Message] ---
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

// --- [ระบบ 2: Voice Log (คนเข้า-ออกห้องเสียง)] ---
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

// --- [ระบบ 3: นาฬิกา ASCII] ---
const asciiDigits = { '0': ["  ████  ", " ██  ██ ", " ██  ██ ", " ██  ██ ", "  ████  "], '1': ["   ██   ", "  ███   ", "   ██   ", "   ██   ", "  ████  "], '2': [" █████  ", "     ██ ", "  █████ ", " ██     ", " ██████ "], '3': [" █████  ", "     ██ ", "  █████ ", "     ██ ", " █████  "], '4': [" ██  ██ ", " ██  ██ ", " ██████ ", "     ██ ", "     ██ "], '5': [" ██████ ", " ██     ", " █████  ", "     ██ ", " █████  "], '6': ["  ████  ", " ██     ", " █████  ", " ██  ██ ", "  ████  "], '7': [" ██████ ", "     ██ ", "    ██  ", "   ██   ", "   ██   "], '8': ["  ████  ", " ██  ██ ", "  ████  ", " ██  ██ ", "  ████  "], '9': ["  ████  ", " ██  ██ ", "  █████ ", "     ██ ", "  ████  "], ':': ["        ", "   ██   ", "        ", "   ██   ", "        "] };

client.once(Events.ClientReady, c => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
    client.user.setActivity('Masaru Dashboard', { type: ActivityType.Watching });
});

// --- [ระบบ 4: XP & Level + !stat] ---
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;

    if (message.content === '!stat') {
        const data = await User.findOne({ userId: message.author.id });
        if (data) return message.reply(`📊 **ข้อมูลของคุณ ${message.author.username}**\n⭐ เลเวล: ${data.level}\n✨ XP: ${data.xp}/${data.level * 100}`);
    }

    try {
        let data = await User.findOne({ userId: message.author.id });
        if (!data) data = new User({ userId: message.author.id });
        data.xp += 20;
        if (data.xp >= (data.level * 100)) {
            data.level += 1;
            message.reply(`🎉 ยินดีด้วย! เลเวลอัปเป็น **${data.level}**!`);
        }
        await data.save();
    } catch (e) {}
});

client.login(process.env.TOKEN);