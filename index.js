const { Client, GatewayIntentBits, EmbedBuilder, ActivityType } = require('discord.js');
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URL).then(() => console.log('Bot DB Connected! ✅'));

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

const CLOCK_CHANNEL_ID = '1483918700976410694';
const LOG_CHANNEL_ID = '1204742409347534900';

// --- ระบบนาฬิกา ASCII (คงเดิม) ---
const asciiDigits = { '0': ["  ████  ", " ██  ██ ", " ██  ██ ", " ██  ██ ", "  ████  "], '1': ["   ██   ", "  ███   ", "   ██   ", "   ██   ", "  ████  "], '2': [" █████  ", "     ██ ", "  █████ ", " ██     ", " ██████ "], '3': [" █████  ", "     ██ ", "  █████ ", "     ██ ", " █████  "], '4': [" ██  ██ ", " ██  ██ ", " ██████ ", "     ██ ", "     ██ "], '5': [" ██████ ", " ██     ", " █████  ", "     ██ ", " █████  "], '6': ["  ████  ", " ██     ", " █████  ", " ██  ██ ", "  ████  "], '7': [" ██████ ", "     ██ ", "    ██  ", "   ██   ", "   ██   "], '8': ["  ████  ", " ██  ██ ", "  ████  ", " ██  ██ ", "  ████  "], '9': ["  ████  ", " ██  ██ ", "  █████ ", "     ██ ", "  ████  "], ':': ["        ", "   ██   ", "        ", "   ██   ", "        "] };

function getNewDigitalClock() {
    const now = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Bangkok"}));
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}:${seconds}`;
    let lines = ["", "", "", "", ""];
    for (const char of timeStr) {
        const digit = asciiDigits[char];
        for (let i = 0; i < 5; i++) lines[i] += digit[i] + " ";
    }
    return "```\n" + lines.join("\n") + "\n```";
}

client.once('ready', async () => {
    console.log(`Bot Online as: ${client.user.tag} 🤖`);
    client.user.setActivity('Masaru Dashboard', { type: ActivityType.Watching });

    setInterval(async () => {
        try {
            const channel = await client.channels.fetch(CLOCK_CHANNEL_ID);
            if (channel) {
                const messages = await channel.messages.fetch({ limit: 1 });
                const lastMessage = messages.first();
                const clockContent = `🕘 **ระนาฬิกาดิจิทัล (Real-time)**\n${getNewDigitalClock()}\n📅 วันที่: ${new Date().toLocaleDateString('th-TH', {timeZone: 'Asia/Bangkok'})} | อัปเดตล่าสุด: ${new Date().toLocaleTimeString('th-TH', {timeZone: 'Asia/Bangkok'})} น.`;
                if (lastMessage && lastMessage.author.id === client.user.id) await lastMessage.edit(clockContent);
                else await channel.send(clockContent);
            }
        } catch (err) { console.error("Clock Error:", err); }
    }, 10000);
});

// --- ระบบ LOG ห้องเสียง (ปรับแก้จุด fetch เพื่อความชัวร์) ---
client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
        const logChannel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        if (!logChannel) return;
        const user = newState.member.user;
        const time = new Date().toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok' });

        if (!oldState.channelId && newState.channelId) {
            logChannel.send(`\`\`\`diff\n+ [เข้าห้อง] ${user.username} เข้าห้อง: ${newState.channel.name} (${time} น.)\n\`\`\``);
        } else if (oldState.channelId && !newState.channelId) {
            logChannel.send(`\`\`\`diff\n- [ออกห้อง] ${user.username} ออกจากห้อง: ${oldState.channel.name} (${time} น.)\n\`\`\``);
        } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            logChannel.send(`\`\`\`\n[ย้ายห้อง] ${user.username} ย้ายจาก ${oldState.channel.name} -> ${newState.channel.name} (${time} น.)\n\`\`\``);
        }
    } catch (err) { console.error("Voice Log Error:", err); }
});

// --- ระบบเลเวล ---
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    let userData = await User.findOne({ userId: message.author.id });
    if (!userData) userData = new User({ userId: message.author.id });
    userData.xp += Math.floor(Math.random() * 11) + 15;
    if (userData.xp >= (userData.level * 100)) {
        userData.level += 1;
        message.reply(`🎉 เลเวลอัปเป็นระดับ **${userData.level}**!`);
    }
    await userData.save();
});

client.login(process.env.TOKEN);