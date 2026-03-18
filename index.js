const { Client, GatewayIntentBits, EmbedBuilder, ActivityType } = require('discord.js');
const mongoose = require('mongoose');

// --- 1. เชื่อมต่อ MongoDB ---
mongoose.connect(process.env.MONGO_URL)
    .then(() => console.log('MongoDB Connected! 📦'))
    .catch(err => console.error('MongoDB Error:', err));

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 }
});
const User = mongoose.model('User', userSchema);

// --- 2. ตั้งค่าบอท ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
    ],
});

// --- 3. ตั้งค่า ID ห้อง (ตรวจสอบให้ตรง) ---
const PREFIX = '!';
const LEVEL_LOG_ID = '1483551045711040605'; 
const VOICE_LOG_ID = '1204742409347534900'; 
const CLOCK_CHANNEL_ID = '1483918700976410694'; // ห้อง #วัน-เวลา

// --- 4. ฟังก์ชันนาฬิกา ASCII ---
const asciiDigits = {
    '0': ["  ███  ", " ██ █  ", "  ███  "], '1': ["   █   ", "   █   ", "   █   "],
    '2': [" ███   ", "   █   ", " ███   "], '3': [" ███   ", "  ██   ", " ███   "],
    '4': [" █ █   ", " ███   ", "   █   "], '5': [" ███   ", " ██    ", " ███   "],
    '6': [" ███   ", " █     ", " ███   "], '7': [" ███   ", "   █   ", "   █   "],
    '8': [" ███   ", " ███   ", " ███   "], '9': [" ███   ", " █ ██  ", "  ███  "],
    ':': ["   ", " █ ", " █ "]
};

function getFullClockDisplay() {
    const now = new Date();
    const timeStr = now.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const dateStr = now.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'long', year: 'numeric' });
    
    const chars = timeStr.split('');
    let lines = ["", "", ""];
    chars.forEach(char => {
        const digit = asciiDigits[char] || ["   ", "   ", "   "];
        for (let i = 0; i < 3; i++) lines[i] += digit[i];
    });

    return `\`\`\`fix\n${lines.join('\n')}\n\n📅 วันที่: ${dateStr}\n⏱️ อัปเดตล่าสุด: ${timeStr} น.\n\`\`\``;
}

let clockMsg = null;

// --- 5. เมื่อบอทออนไลน์ (แก้ไขเป็น clientReady ตามคำแนะนำของระบบ) ---
client.once('ready', async () => {
    console.log(`Log in as: ${client.user.tag} ✅`);
    
    const channel = await client.channels.fetch(CLOCK_CHANNEL_ID);
    if (channel) {
        // ส่งข้อความใหม่ทันทีเมื่อบอท Start
        clockMsg = await channel.send(getFullClockDisplay());
        
        // ตั้งให้แก้ข้อความทุก 10 วินาที
        setInterval(async () => {
            try {
                if (clockMsg) await clockMsg.edit(getFullClockDisplay());
            } catch (err) {
                clockMsg = await channel.send(getFullClockDisplay());
            }
        }, 10000); 
    }
});

// --- 6. ระบบ LOG ห้องเสียง ---
client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
        const logChannel = await client.channels.fetch(VOICE_LOG_ID);
        if (!logChannel) return;
        const member = newState.member || oldState.member;
        if (member.user.bot) return;

        if (!oldState.channelId && newState.channelId) {
            await logChannel.send({ embeds: [new EmbedBuilder().setColor('#2ECC71').setDescription(`\`\`\`diff\n+ [เข้าห้อง]: ${newState.channel.name}\n- ยูสเซอร์: ${member.user.tag}\n\`\`\``)] });
        } else if (oldState.channelId && !newState.channelId) {
            await logChannel.send({ embeds: [new EmbedBuilder().setColor('#E74C3C').setDescription(`\`\`\`diff\n- [ออกห้อง]: ${oldState.channel.name}\n- ยูสเซอร์: ${member.user.tag}\n\`\`\``)] });
        } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            await logChannel.send({ embeds: [new EmbedBuilder().setColor('#F1C40F').setDescription(`\`\`\`yaml\n[ย้ายห้อง]\nจาก: ${oldState.channel.name}\nไป: ${newState.channel.name}\nโดย: ${member.user.tag}\n\`\`\``)] });
        }
    } catch (err) { console.error(err); }
});

// --- 7. ระบบเลเวล ---
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    try {
        let userData = await User.findOne({ userId: message.author.id });
        if (!userData) userData = new User({ userId: message.author.id });

        userData.xp += Math.floor(Math.random() * 11) + 15;
        const nextLevelXP = userData.level * 100;

        if (userData.xp >= nextLevelXP) {
            userData.level++;
            const logChannel = await client.channels.fetch(LEVEL_LOG_ID);
            if (logChannel) {
                await logChannel.setName(`🏆┃level-${userData.level}`).catch(() => {});
                await logChannel.send({ embeds: [new EmbedBuilder().setColor('#00FF7F').setDescription(`\`\`\`fix\n🎊 เลเวลอัป: ${userData.level}\nผู้ใช้: ${message.author.username}\n\`\`\``)] });
            }
        }
        await userData.save();
    } catch (err) { console.error(err); }

    if (message.content === '!level') {
        const data = await User.findOne({ userId: message.author.id });
        message.reply(`📊 Level: **${data ? data.level : 1}** | XP: **${data ? data.xp : 0}/${(data ? data.level : 1) * 100}**`);
    }
});

client.login(process.env.TOKEN);