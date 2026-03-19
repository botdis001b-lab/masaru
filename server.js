const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URL).then(() => console.log('Bot DB Connected! ✅'));

const User = mongoose.model('User', new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 }
}));

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildVoiceStates]
});

const CLOCK_CHANNEL_ID = '1483918700976410694';
const LOG_CHANNEL_ID = '1204742409347534900';

// ระบบนาฬิกา (ยุบรวมบรรทัดเพื่อความสะอาด)
const asciiDigits = { '0': ["  ████  ", " ██  ██ ", " ██  ██ ", " ██  ██ ", "  ████  "], '1': ["   ██   ", "  ███   ", "   ██   ", "   ██   ", "  ████  "], '2': [" █████  ", "     ██ ", "  █████ ", " ██     ", " ██████ "], '3': [" █████  ", "     ██ ", "  █████ ", "     ██ ", " █████  "], '4': [" ██  ██ ", " ██  ██ ", " ██████ ", "     ██ ", "     ██ "], '5': [" ██████ ", " ██     ", " █████  ", "     ██ ", " █████  "], '6': ["  ████  ", " ██     ", " █████  ", " ██  ██ ", "  ████  "], '7': [" ██████ ", "     ██ ", "    ██  ", "   ██   ", "   ██   "], '8': ["  ████  ", " ██  ██ ", "  ████  ", " ██  ██ ", "  ████  "], '9': ["  ████  ", " ██  ██ ", "  █████ ", "     ██ ", "  ████  "], ':': ["        ", "   ██   ", "        ", "   ██   ", "        "] };

function getClock() {
    const time = new Date().toLocaleTimeString('en-US', {timeZone: 'Asia/Bangkok', hour12: false});
    let lines = ["", "", "", "", ""];
    for (const char of time) {
        const digit = asciiDigits[char] || asciiDigits[':'];
        for (let i = 0; i < 5; i++) lines[i] += digit[i] + " ";
    }
    return "```\n" + lines.join("\n") + "\n```";
}

client.once('ready', () => {
    console.log(`Bot Online as: ${client.user.tag}`);
    client.user.setActivity('Masaru Dashboard', { type: ActivityType.Watching });
    
    setInterval(async () => {
        try {
            const channel = await client.channels.fetch(CLOCK_CHANNEL_ID);
            if (channel) {
                const clockMsg = `🕘 **นาฬิกาดิจิทัล**\n${getClock()}\n📅 ${new Date().toLocaleDateString('th-TH', {timeZone:'Asia/Bangkok'})}`;
                const messages = await channel.messages.fetch({ limit: 1 });
                if (messages.first()?.author.id === client.user.id) await messages.first().edit(clockMsg);
                else await channel.send(clockMsg);
            }
        } catch (e) {}
    }, 10000);
});

// --- แก้ไข Voice Log (ใช้ fetch แทน cache เพื่อความชัวร์) ---
client.on('voiceStateUpdate', async (oldState, newState) => {
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
    } catch (e) { console.error("Voice Log Error"); }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    let data = await User.findOne({ userId: message.author.id });
    if (!data) data = new User({ userId: message.author.id });
    data.xp += 20;
    if (data.xp >= (data.level * 100)) {
        data.level += 1;
        message.reply(`🎉 Level Up! **${data.level}**`);
    }
    await data.save();
});

client.login(process.env.TOKEN);