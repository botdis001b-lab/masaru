const { Client, GatewayIntentBits, ActivityType, Events, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');

// เชื่อมต่อ Database
if (mongoose.connection.readyState === 0) {
    mongoose.connect(process.env.MONGO_URL)
        .then(() => console.log('Bot DB Connected! ✅'))
        .catch(err => console.error('DB Error:', err));
}

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
        GatewayIntentBits.GuildVoiceStates
    ]
});

// ตั้งค่า ID ห้องต้อนรับตามที่พี่แจ้งมา
const WELCOME_CHANNEL_ID = '1205000338382524416'; 

// --- [ระบบเสริม 1: Welcome Message] ---
client.on(Events.GuildMemberAdd, async (member) => {
    try {
        const channel = await client.channels.fetch(WELCOME_CHANNEL_ID);
        if (channel) {
            // สร้างข้อความต้อนรับแบบ Embed ให้ดูสวยงาม
            const welcomeEmbed = new EmbedBuilder()
                .setColor('#5865f2')
                .setTitle('👋 ยินดีต้อนรับสมาชิกใหม่!')
                .setDescription(`สวัสดีคุณ ${member} ยินดีต้อนรับเข้าสู่เซิร์ฟเวอร์ของเราครับ!\nขอให้สนุกกับการพูดคุยและใช้งานบอทนะครับ`)
                .setThumbnail(member.user.displayAvatarURL())
                .addFields({ name: 'สมาชิกคนที่:', value: `${member.guild.memberCount}`, inline: true })
                .setTimestamp();

            await channel.send({ content: `ยินดีต้อนรับครับ ${member}!`, embeds: [welcomeEmbed] });
        }
    } catch (e) {
        console.error("Welcome Message Error:", e);
    }
});

// --- [ระบบนาฬิกา ASCII เดิม] ---
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

client.once(Events.ClientReady, c => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
    client.user.setActivity('Masaru Dashboard', { type: ActivityType.Watching });
});

// --- [ระบบ XP & Level + คำสั่งเสริม] ---
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;

    // ระบบเช็กสถานะตัวเอง (Stat)
    if (message.content === '!stat') {
        const data = await User.findOne({ userId: message.author.id });
        if (data) {
            return message.reply(`📊 **ข้อมูลของคุณ ${message.author.username}**\n⭐ เลเวล: ${data.level}\n✨ XP: ${data.xp}/${data.level * 100}`);
        }
    }

    // ระบบเพิ่ม XP ปกติ
    try {
        let data = await User.findOne({ userId: message.author.id });
        if (!data) data = new User({ userId: message.author.id });
        
        data.xp += 20;
        if (data.xp >= (data.level * 100)) {
            data.level += 1;
            message.reply(`🎉 ยินดีด้วย! คุณเลเวลอัปเป็นระดับ **${data.level}** แล้ว!`);
        }
        await data.save();
    } catch (e) {}
});

client.login(process.env.TOKEN);