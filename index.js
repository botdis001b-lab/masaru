const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');
const startWeb = require('./server.js'); // เปลี่ยนชื่อเพื่อให้สื่อความหมาย

// --- 1. เชื่อมต่อ MongoDB และสร้าง Model ก่อนเปิดเว็บ ---
mongoose.connect(process.env.MONGO_URL)
    .then(() => {
        console.log('MongoDB Connected! 📦');
        // รันหน้าเว็บหลังจาก DB พร้อม และส่ง User Model ไปให้ใช้
        startWeb(User);
    })
    .catch(err => console.error('MongoDB Error:', err));

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 }
});
const User = mongoose.model('User', userSchema);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
    ],
});

// --- 2. ตั้งค่า ID และระบบนาฬิกา (ดึงมาจากโค้ดเดิมของพี่ทั้งหมด) ---
const VOICE_LOG_ID = '1204742409347534900'; 
const CLOCK_CHANNEL_ID = '1483918700976410694'; 
const LEVEL_LOG_ID = '1483551045711040605';

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
        const messages = await channel.messages.fetch({ limit: 10 });
        let clockMsg = messages.find(m => m.author.id === client.user.id);
        if (!clockMsg) clockMsg = await channel.send(getNewDigitalClock());
        setInterval(async () => {
            try { if (clockMsg) await clockMsg.edit(getNewDigitalClock()); } 
            catch (err) { clockMsg = await channel.send(getNewDigitalClock()); }
        }, 10000); 
    }
});

// --- 3. ระบบ LOG และ เลเวล (เหมือนเดิม) ---
client.on('voiceStateUpdate', async (oldState, newState) => { /* โค้ดเดิมของพี่ */ });
client.on('messageCreate', async (message) => { /* โค้ดเดิมของพี่ */ });

client.login(process.env.TOKEN);