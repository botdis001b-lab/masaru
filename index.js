const { Client, GatewayIntentBits, ActivityType, Events, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');

// --- [1. เชื่อมต่อ Database] ---
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
        GatewayIntentBits.GuildVoiceStates // จำเป็นสำหรับ Log เสียงและเช็กคนหาย
    ]
});

module.exports = { client }; // ส่งออก client ให้ไฟล์อื่นใช้งาน

// --- [2. โหลดระบบแยก] ---
require('./media-tracker.js'); // ระบบแจ้งเตือนหนัง/อนิเมะ
const { initMemberManagement } = require('./member-management.js');
initMemberManagement(client); // ระบบรับยศและเช็กคนหาย 10 วัน

// --- [3. ตั้งค่า ID ห้องและระบบเก่า] ---
const WELCOME_CHANNEL_ID = '1205000338382524416'; 
const LOG_CHANNEL_ID = '1204742409347534900';     
const CLOCK_CHANNEL_ID = '1483918700976410694'; // ID ห้อง #วัน-เวลา

// ระบบ Welcome
client.on(Events.GuildMemberAdd, async (member) => {
    try {
        const channel = await client.channels.fetch(WELCOME_CHANNEL_ID);
        if (channel) {
            const embed = new EmbedBuilder()
                .setColor('#5865f2')
                .setTitle('👋 ยินดีต้อนรับสมาชิกใหม่!')
                .setDescription(`สวัสดีคุณ ${member} เข้าสู่เซิร์ฟเวอร์!\nสมาชิกคนที่: **${member.guild.memberCount}**`)
                .setThumbnail(member.user.displayAvatarURL())
                .setTimestamp();
            await channel.send({ embeds: [embed] });
        }
    } catch (e) { console.error("Welcome Error:", e); }
});

// ระบบ Voice Log
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
    console.log(`Ready! Logged in as ${c.user.tag}`);
    client.user.setActivity('Masaru Dashboard', { type: ActivityType.Watching });

    // รันนาฬิกาทุก 1 นาที
    setInterval(async () => {
        const channel = await client.channels.fetch(CLOCK_CHANNEL_ID).catch(() => null);
        if (channel) {
            const messages = await channel.messages.fetch({ limit: 5 });
            const botMsg = messages.find(m => m.author.id === client.user.id);
            const content = `🕒 **นาฬิกาดิจิทัล**\n${getClockText()}\n📅 ${new Date().toLocaleDateString('th-TH', { dateStyle: 'long' })}`;
            if (botMsg) await botMsg.edit(content);
            else await channel.send(content);
        }
    }, 60000);
});

// ระบบ XP
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