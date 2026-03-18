const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');
const startWeb = require('./server.js'); 

// 1. เชื่อมต่อ MongoDB (ต้องทำก่อนเปิดหน้าเว็บ)
mongoose.connect(process.env.MONGO_URL)
    .then(() => console.log('MongoDB Connected! 📦'))
    .catch(err => console.error('MongoDB Error:', err));

// 2. สร้าง Schema และ Model
const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 }
});
const User = mongoose.model('User', userSchema);

// 3. เริ่มระบบหน้าเว็บ (ส่ง User model ไปให้ server.js รัน)
startWeb(User);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
    ],
});

const VOICE_LOG_ID = '1204742409347534900'; 
const CLOCK_CHANNEL_ID = '1483918700976410694'; 
const LEVEL_LOG_ID = '1483551045711040605';

// --- [ระบบนาฬิกาดิจิทัล ASCII ของพี่] --- 
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
    let lines = ["", "", ""];
    timeStr.split('').forEach(char => {
        const digit = asciiDigits[char] || ["   ", "   ", "   "];
        for (let i = 0; i < 3; i++) lines[i] += digit[i];
    });
    return `### 🕒 ระบบนาฬิกาดิจิทัล (Real-time)\n\`\`\`fix\n${lines.join('\n')}\n\`\`\`\n> 📅 **วันที่:** ${dateStr}\n> ⏱️ **อัปเดตล่าสุด:** ${timeStr} น.`;
}

client.once('ready', async () => {
    console.log(`Log in as: ${client.user.tag} ✅`);
    const channel = await client.channels.fetch(CLOCK_CHANNEL_ID);
    if (channel) {
        let clockMsg = (await channel.messages.fetch({ limit: 10 })).find(m => m.author.id === client.user.id);
        if (!clockMsg) clockMsg = await channel.send(getNewDigitalClock());
        setInterval(async () => {
            try { if (clockMsg) await clockMsg.edit(getNewDigitalClock()); } 
            catch (err) { clockMsg = await channel.send(getNewDigitalClock()); }
        }, 10000); 
    }
});

// --- ระบบ LOG ห้องเสียง และระบบเลเวล (เหมือนเดิม) ---
client.on('voiceStateUpdate', async (oldState, newState) => { /* โค้ดแจ้งเตือนห้องเสียง */ });
client.on('messageCreate', async (message) => { /* โค้ดเก็บ XP เลเวล */ });

client.login(process.env.TOKEN);