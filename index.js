const { Client, GatewayIntentBits, ActivityType, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');

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
        GatewayIntentBits.GuildMembers, // สำคัญ: ต้องเปิดใน Developer Portal ด้วย
    ],
});

const PREFIX = '!';
const LOG_CHANNEL_ID = '1483551045711040605'; 
const WELCOME_CHANNEL_ID = '1204742409347534900'; 

client.once('ready', async () => {
    console.log(`Log in as: ${client.user.tag} ✅`);

    // --- ระบบตัวทดสอบส่งข้อความ (Self-Test System) ---
    try {
        const testChannel = await client.channels.fetch(WELCOME_CHANNEL_ID);
        if (testChannel) {
            console.log(`[Test] ตรวจพบห้อง LOG: ${testChannel.name} (ID: ${testChannel.id})`);
            await testChannel.send('⚙️ **ระบบ LOG เริ่มทำงาน:** ตรวจสอบการเชื่อมต่อสำเร็จ!');
            console.log(`[Test] ส่งข้อความทดสอบสำเร็จ! ✅`);
        } else {
            console.error(`[Test] ❌ ไม่สามารถหาห้อง LOG ได้จาก ID ที่ระบุ`);
        }
    } catch (err) {
        console.error(`[Test] ❌ บอทเข้าไม่ถึงห้อง LOG: ${err.message}`);
        console.error(`คำแนะนำ: เช็คว่าบอทอยู่ในห้องนั้น และมีสิทธิ์ Send Messages หรือไม่`);
    }
});

// --- ระบบ LOG คนเข้า (ป้องกันบัคด้วย try-catch) ---
client.on('guildMemberAdd', async (member) => {
    try {
        const channel = await client.channels.fetch(WELCOME_CHANNEL_ID);
        if (!channel) return;

        const welcomeEmbed = new EmbedBuilder()
            .setColor('#2ECC71')
            .setTitle('📥 ยินดีต้อนรับสมาชิกใหม่!')
            .setThumbnail(member.user.displayAvatarURL())
            .setDescription(`สวัสดีคุณ ${member}! ยินดีต้อนรับเข้าสู่ครอบครัวของเรา\nขณะนี้มีสมาชิกทั้งหมด: **${member.guild.memberCount}** คน`)
            .setTimestamp();

        await channel.send({ embeds: [welcomeEmbed] });
    } catch (err) {
        console.error(`[Error] ไม่สามารถส่ง LOG คนเข้าได้: ${err.message}`);
    }
});

// --- ระบบ LOG คนออก (ป้องกันบัคด้วย try-catch) ---
client.on('guildMemberRemove', async (member) => {
    try {
        const channel = await client.channels.fetch(WELCOME_CHANNEL_ID);
        if (!channel) return;

        const leaveEmbed = new EmbedBuilder()
            .setColor('#E74C3C')
            .setTitle('📤 สมาชิกออกจากเซิร์ฟเวอร์')
            .setThumbnail(member.user.displayAvatarURL())
            .setDescription(`คุณ **${member.user.username}** ได้ออกจากเราไปแล้ว\nเหลือสมาชิกทั้งหมด: **${member.guild.memberCount}** คน`)
            .setTimestamp();

        await channel.send({ embeds: [leaveEmbed] });
    } catch (err) {
        console.error(`[Error] ไม่สามารถส่ง LOG คนออกได้: ${err.message}`);
    }
});

// --- ระบบเลเวล ---
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    try {
        let userData = await User.findOne({ userId: message.author.id });
        if (!userData) userData = new User({ userId: message.author.id });

        const addXp = Math.floor(Math.random() * 11) + 15;
        userData.xp += addXp;
        const nextLevelXP = userData.level * 100;

        if (userData.xp >= nextLevelXP) {
            userData.level++;
            const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
            if (logChannel) {
                await logChannel.setName(`🏆┃level-${userData.level}`).catch(() => {});
                const levelEmbed = new EmbedBuilder()
                    .setColor('#00FF7F')
                    .setDescription(`🎊 <@${message.author.id}> เลเวลอัปเป็น **${userData.level}**!`)
                    .setTimestamp();
                await logChannel.send({ embeds: [levelEmbed] });
            }
        }
        await userData.save();
    } catch (err) {
        console.error(`[Error] ระบบเลเวลขัดข้อง: ${err.message}`);
    }

    if (!message.content.startsWith(PREFIX)) return;
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'level' || command === 'lv') {
        message.reply(`📊 **${message.author.username}** | Level: **${userData.level}** | XP: **${userData.xp}/${userData.level * 100}**`);
    }
});

client.login(process.env.TOKEN);