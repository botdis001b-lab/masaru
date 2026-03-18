const { Client, GatewayIntentBits, EmbedBuilder, ActivityType } = require('discord.js');
const mongoose = require('mongoose');

// --- 1. การเชื่อมต่อฐานข้อมูล MongoDB ---
mongoose.connect(process.env.MONGO_URL)
    .then(() => console.log('MongoDB Connected! 📦'))
    .catch(err => console.error('MongoDB Error:', err));

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 }
});
const User = mongoose.model('User', userSchema);

// --- 2. ตั้งค่าบอทและ Intents ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
    ],
});

// --- 3. ตั้งค่า ID ต่างๆ (ตรวจสอบให้ตรงกับดิสของคุณ) ---
const PREFIX = '!';
const LEVEL_LOG_ID = '1483551045711040605'; // ห้องแจ้งเลเวลอัป
const VOICE_LOG_ID = '1204742409347534900'; // ห้อง LOG เข้า-ออกห้องเสียง
const CLOCK_CHANNEL_ID = '1483918700976410694'; // ห้องนาฬิกาเรียลไทม์

// --- 4. ฟังก์ชันสำหรับนาฬิกา ASCII ---
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

// --- 5. เมื่อบอทออนไลน์ ---
client.once('ready', async () => {
    console.log(`Log in as: ${client.user.tag} ✅`);
    
    // เริ่มระบบนาฬิกา
    const channel = await client.channels.fetch(CLOCK_CHANNEL_ID);
    if (channel) {
        clockMsg = await channel.send(getFullClockDisplay());
        setInterval(async () => {
            try {
                if (clockMsg) await clockMsg.edit(getFullClockDisplay());
            } catch (err) {
                clockMsg = await channel.send(getFullClockDisplay());
            }
        }, 10000); // อัปเดตทุก 10 วินาที (ปลอดภัยต่อ Rate Limit)
    }
});

// --- 6. ระบบ LOG เข้า-ออกห้องเสียง (Code Block) ---
client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
        const logChannel = await client.channels.fetch(VOICE_LOG_ID);
        if (!logChannel) return;

        const member = newState.member || oldState.member;
        if (member.user.bot) return;

        // เข้าห้อง
        if (!oldState.channelId && newState.channelId) {
            const embed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() })
                .setDescription(`\`\`\`diff\n+ [เข้าห้อง]: ${newState.channel.name}\n- ยูสเซอร์: ${member.user.tag}\n\`\`\``)
                .setTimestamp();
            await logChannel.send({ embeds: [embed] });
        }
        // ออกห้อง
        else if (oldState.channelId && !newState.channelId) {
            const embed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() })
                .setDescription(`\`\`\`diff\n- [ออกห้อง]: ${oldState.channel.name}\n- ยูสเซอร์: ${member.user.tag}\n\`\`\``)
                .setTimestamp();
            await logChannel.send({ embeds: [embed] });
        }
        // ย้ายห้อง
        else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            const embed = new EmbedBuilder()
                .setColor('#F1C40F')
                .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() })
                .setDescription(`\`\`\`yaml\n[ย้ายห้อง]\nจาก: ${oldState.channel.name}\nไปที่: ${newState.channel.name}\nโดย: ${member.user.tag}\n\`\`\``)
                .setTimestamp();
            await logChannel.send({ embeds: [embed] });
        }
    } catch (err) { console.error('Voice Log Error:', err); }
});

// --- 7. ระบบเลเวล และ คำสั่ง ---