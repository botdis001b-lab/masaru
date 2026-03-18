const { Client, GatewayIntentBits, ActivityType, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');

// เชื่อมต่อ MongoDB
mongoose.connect(process.env.MONGO_URL)
    .then(() => console.log('MongoDB Connected! 📦'))
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
        GatewayIntentBits.GuildMembers, // *** เพิ่มอันนี้เพื่อให้บอทตรวจจับคนเข้า-ออกได้ ***
    ],
});

const PREFIX = '!';
const LOG_CHANNEL_ID = '1483551045711040605'; 
const WELCOME_CHANNEL_ID = '1204742409347534900'; // ห้อง LOG คนเข้า-ออกที่คุณกำหนด

client.once('ready', () => {
    console.log(`Log in as: ${client.user.tag} ✅`);
});

// --- ระบบ LOG คนเข้าเซิร์ฟเวอร์ ---
client.on('guildMemberAdd', async (member) => {
    try {
        const channel = await client.channels.fetch(WELCOME_CHANNEL_ID);
        if (channel) {
            const welcomeEmbed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setTitle('📥 สมาชิกใหม่เข้าร่วม!')
                .setThumbnail(member.user.displayAvatarURL())
                .setDescription(`ยินดีต้อนรับคุณ ${member} เข้าสู่เซิร์ฟเวอร์!\nขณะนี้มีสมาชิกทั้งหมด **${member.guild.memberCount}** คน`)
                .setTimestamp();
            channel.send({ embeds: [welcomeEmbed] });
        }
    } catch (err) {
        console.error('Error sending welcome message:', err);
    }
});

// --- ระบบ LOG คนออกจากเซิร์ฟเวอร์ ---
client.on('guildMemberRemove', async (member) => {
    try {
        const channel = await client.channels.fetch(WELCOME_CHANNEL_ID);
        if (channel) {
            const leaveEmbed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setTitle('📤 มีคนจากเราไปแล้ว')
                .setThumbnail(member.user.displayAvatarURL())
                .setDescription(`คุณ **${member.user.username}** ได้ออกจากเซิร์ฟเวอร์ไปแล้ว\nเหลือสมาชิกทั้งหมด **${member.guild.memberCount}** คน`)
                .setTimestamp();
            channel.send({ embeds: [leaveEmbed] });
        }
    } catch (err) {
        console.error('Error sending leave message:', err);
    }
});

// --- ระบบเลเวลและคำสั่งต่างๆ ---
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    let userData = await User.findOne({ userId: message.author.id });
    if (!userData) userData = new User({ userId: message.author.id });

    const addXp = Math.floor(Math.random() * 11) + 15;
    userData.xp += addXp;

    const nextLevelXP = userData.level * 100;

    if (userData.xp >= nextLevelXP) {
        userData.level++;
        
        try {
            const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
            if (logChannel) {
                const newName = `🏆┃level-${userData.level}`;
                await logChannel.setName(newName);

                const levelEmbed = new EmbedBuilder()
                    .setColor('#00FF7F')
                    .setAuthor({ name: 'LEVEL UP! 🎊', iconURL: message.author.displayAvatarURL() })
                    .setDescription(`ยินดีด้วย <@${message.author.id}>! เลเวลอัปเป็น **${userData.level}**`)
                    .setFooter({ text: 'ระบบเลเวลอัตโนมัติ' })
                    .setTimestamp();

                await logChannel.send({ embeds: [levelEmbed] });
            }
        } catch (err) {
            console.error('❌ เปลี่ยนชื่อห้องไม่สำเร็จ:', err.message);
        }
    }
    await userData.save();

    if (!message.content.startsWith(PREFIX)) return;
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'level' || command === 'lv') {
        message.reply(`📊 **${message.author.username}** | Level: **${userData.level}** | XP: **${userData.xp}/${userData.level * 100}**`);
    }
});

client.login(process.env.TOKEN);