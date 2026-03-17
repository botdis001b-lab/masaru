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
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const PREFIX = '!';
const LOG_CHANNEL_ID = '1483551045711040605'; // ID ห้องที่คุณตั้งชื่อไว้ว่า "1"

client.once('ready', () => {
    console.log(`Log in as: ${client.user.tag}`);
    client.user.setActivity('Leveling System', { type: ActivityType.Competing });
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    let userData = await User.findOne({ userId: message.author.id });
    if (!userData) userData = new User({ userId: message.author.id });

    const addXp = Math.floor(Math.random() * 10) + 15;
    userData.xp += addXp;

    const nextLevelXP = userData.level * 100;

    if (userData.xp >= nextLevelXP) {
        userData.level++;
        
        const logChannel = client.channels.cache.get(LOG_CHANNEL_ID);
        if (logChannel) {
            // 1. ตกแต่งชื่อห้องใหม่ (จาก #1 เป็นชื่อที่ดูเท่ขึ้น)
            // ใส่ Emoji และขีดกลางเพื่อให้ดูเป็นระเบียบตามสไตล์ Discord
            logChannel.setName(`🏆┃level-up-${userData.level}`).catch(() => {});

            // 2. สร้าง Embed แบบตกแต่งจัดเต็ม
            const levelEmbed = new EmbedBuilder()
                .setColor('#00FF7F') // สีเขียวนีออน
                .setAuthor({ name: 'LEVEL UP! เก่งเกินคุณน้า', iconURL: message.author.displayAvatarURL() })
                .setDescription(`✨ วาสนาผู้ใดหนอ... ยินดีด้วยกับ **${message.author.username}**!\nตอนนี้คุณอัปเกรดเป็นเลเวล **${userData.level}** เรียบร้อยแล้ว`)
                .addFields(
                    { name: '🔥 เลเวลปัจจุบัน', value: `\` ${userData.level} \``, inline: true },
                    { name: '⭐ XP สะสม', value: `\` ${userData.xp} \``, inline: true }
                )
                .setThumbnail('https://i.imgur.com/8S9X9pX.gif') // ใส่ GIF ตกแต่ง (ถ้ามี)
                .setFooter({ text: 'MasaruBot • ระบบจัดเก็บข้อมูลถาวร MongoDB', iconURL: client.user.displayAvatarURL() })
                .setTimestamp();

            logChannel.send({ content: `<@${message.author.id}> ตัวตึงเลเวลอัป!`, embeds: [levelEmbed] });
        }
    }
    await userData.save();

    // --- Commands ---
    if (!message.content.startsWith(PREFIX)) return;
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'level' || command === 'lv') {
        message.reply(`📊 **${message.author.username}**\nLevel: \`${userData.level}\` | XP: \`${userData.xp}/${userData.level * 100}\``);
    }
});

client.login(process.env.TOKEN);