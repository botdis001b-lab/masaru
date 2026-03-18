const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');
const keepAlive = require('./server.js'); // ดึงไฟล์หน้าเว็บมาเตรียมไว้

// --- 1. เชื่อมต่อ MongoDB ---
mongoose.connect(process.env.MONGO_URL)
    .then(() => console.log('MongoDB Connected! 📦'))
    .catch(err => console.error('MongoDB Error:', err));

// --- 2. สร้าง Schema และ Model (ต้องทำก่อนเปิดหน้าเว็บ) ---
const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 }
});
const User = mongoose.model('User', userSchema);

// --- 3. เริ่มระบบหน้าเว็บ (ย้ายมาตรงนี้เพื่อให้รู้จัก Model User แล้ว) ---
keepAlive();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
    ],
});

// --- 4. ตั้งค่า ID ต่างๆ ---
const VOICE_LOG_ID = '1204742409347534900'; 
const CLOCK_CHANNEL_ID = '1483918700976410694'; 
const LEVEL_LOG_ID = '1483551045711040605';

// ฟอนต์ Digital ASCII สำหรับนาฬิกา
const asciiDigits = {
    '0': [" ╔══╗ ", " ║  ║ ", " ╚══╝ "], '1': ["  ║   ", "  ║   ", "  ║   "],
    '2': [" ═══╗ ", " ╔══╝ ", " ╚═══ "], '3': [" ═══╗ ", "  ══╣ ", " ═══╝ "],
    '4': [" ║  ║ ", " ╚══╣ ", "    ║ "], '5': [" ╔═══ ", " ╚══╗ ", " ═══╝ "],
    '6': [" ╔═══ ", " ╠══╗ ", " ╚══╝ "], '7': [" ═══╗ ", "    ║ ", "    ║ "],
    '8': [" ╔══╗ ", " ╠══╣ ", " ╚══╝ "], '9': [" ╔══╗ ", " ╚══╣ ", " ═══╝ "],
    ':': ["   ", " ═ ", " ═ "]
};

function getNewDigitalClock() {
    const now = new Date();
    const timeStr = now.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    const dateStr = now.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'long', year: 'numeric' });
    const chars = timeStr.split('');
    let lines = ["", "", ""];
    chars.forEach(char => {
        const digit = asciiDigits[char] || ["   ", "   ", "   "];
        for (let i = 0; i < 3; i++) lines[i] += digit[i];
    });
    return `### 🕒 ระบบนาฬิกาดิจิทัล (Real-time)\n\`\`\`fix\n${lines.join('\n')}\n\`\`\`\n> 📅 **วันที่:** ${dateStr}\n> ⏱️ **อัปเดตล่าสุด:** ${timeStr} น.`;
}

let clockMsg = null;

// --- 5. การทำงานเมื่อบอท Online ---
client.once('ready', async () => {
    console.log(`Log in as: ${client.user.tag} ✅`);
    
    const channel = await client.channels.fetch(CLOCK_CHANNEL_ID);
    if (channel) {
        const messages = await channel.messages.fetch({ limit: 10 });
        clockMsg = messages.find(m => m.author.id === client.user.id);

        if (!clockMsg) {
            clockMsg = await channel.send(getNewDigitalClock());
        } else {
            await clockMsg.edit(getNewDigitalClock());
        }

        setInterval(async () => {
            try {
                if (clockMsg) await clockMsg.edit(getNewDigitalClock());
            } catch (err) {
                clockMsg = await channel.send(getNewDigitalClock());
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