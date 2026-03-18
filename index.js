const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');
const keepAlive = require('./server.js');

// --- 1. เชื่อมต่อ MongoDB ---
mongoose.connect(process.env.MONGO_URL);

// --- 2. Schema (เพิ่มเก็บชื่อและรูปโปรไฟล์ไว้โชว์หน้าเว็บ) ---
const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    username: { type: String },
    avatar: { type: String },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 }
});
const User = mongoose.model('User', userSchema);

// --- 3. เริ่มหน้าเว็บ (ส่ง Model User ไปให้ server.js) ---
keepAlive(User);

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

// --- ฟังก์ชันนาฬิกา ---
const asciiDigits = { '0': [" ╔══╗ ", " ║  ║ ", " ╚══╝ "], '1': ["  ║   ", "  ║   ", "  ║   "], '2': [" ═══╗ ", " ╔══╝ ", " ╚═══ "], '3': [" ═══╗ ", "  ══╣ ", " ═══╝ "], '4': [" ║  ║ ", " ╚══╣ ", "    ║ "], '5': [" ╔═══ ", " ╚══╗ ", " ═══╝ "], '6': [" ╔═══ ", " ╠══╗ ", " ╚══╝ "], '7': [" ═══╗ ", "    ║ ", "    ║ "], '8': [" ╔══╗ ", " ╠══╣ ", " ╚══╝ "], '9': [" ╔══╗ ", " ╚══╣ ", " ═══╝ "], ':': ["   ", " ═ ", " ═ "] };
function getNewClock() {
    const now = new Date();
    const timeStr = now.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    let lines = ["", "", ""];
    timeStr.split('').forEach(char => {
        const digit = asciiDigits[char] || ["   ", "   ", "   "];
        for (let i = 0; i < 3; i++) lines[i] += digit[i];
    });
    return `### 🕒 DIGITAL CLOCK\n\`\`\`fix\n${lines.join('\n')}\n\`\`\``;
}

client.once('ready', async () => {
    console.log(`Bot ${client.user.tag} is Ready! ✅`);
    // รันนาฬิกา
    const channel = await client.channels.fetch(CLOCK_CHANNEL_ID);
    if (channel) {
        let clockMsg = (await channel.messages.fetch({ limit: 5 })).find(m => m.author.id === client.user.id);
        if (!clockMsg) clockMsg = await channel.send(getNewClock());
        setInterval(() => clockMsg.edit(getNewClock()), 10000);
    }
});

// --- ระบบ LOG ห้องเสียง ---
client.on('voiceStateUpdate', async (oldState, newState) => {
    const logChannel = await client.channels.fetch(VOICE_LOG_ID);
    if (!logChannel) return;
    const member = newState.member || oldState.member;
    if (member.user.bot) return;

    if (!oldState.channelId && newState.channelId) {
        await logChannel.send({ embeds: [new EmbedBuilder().setColor('#2ECC71').setDescription(`\`\`\`diff\n+ [เข้าห้อง]: ${newState.channel.name}\n- โดย: ${member.user.tag}\n\`\`\``)] });
    } else if (oldState.channelId && !newState.channelId) {
        await logChannel.send({ embeds: [new EmbedBuilder().setColor('#E74C3C').setDescription(`\`\`\`diff\n- [ออกห้อง]: ${oldState.channel.name}\n- โดย: ${member.user.tag}\n\`\`\``)] });
    }
});

// --- ระบบเลเวล ---
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    try {
        let userData = await User.findOne({ userId: message.author.id });
        if (!userData) {
            userData = new User({ 
                userId: message.author.id, 
                username: message.author.username, 
                avatar: message.author.displayAvatarURL() 
            });
        } else {
            userData.username = message.author.username;
            userData.avatar = message.author.displayAvatarURL();
        }

        userData.xp += Math.floor(Math.random() * 11) + 15;
        if (userData.xp >= userData.level * 100) {
            userData.level++;
            const logChannel = await client.channels.fetch(LEVEL_LOG_ID);
            if (logChannel) {
                await logChannel.setName(`🏆┃level-${userData.level}`).catch(() => {});
                await logChannel.send({ embeds: [new EmbedBuilder().setColor('#00FF7F').setDescription(`\`\`\`fix\n🎊 เลเวลอัป: ${userData.level}\nผู้ใช้: ${message.author.username}\n\`\`\``)] });
            }
        }
        await userData.save();
    } catch (err) { console.error(err); }
});

client.login(process.env.TOKEN);