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
    ],
});

const PREFIX = '!';
const LOG_CHANNEL_ID = '1483551045711040605'; 

client.once('ready', () => {
    console.log(`Log in as: ${client.user.tag} ✅`);
});

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
            // --- ดึงข้อมูลห้องแบบสดๆ (Fetch) ---
            const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
            
            if (logChannel) {
                // 1. ลองเปลี่ยนชื่อห้อง
                const newName = `🏆┃level-${userData.level}`;
                console.log(`[System] พยายามเปลี่ยนชื่อห้องเป็น: ${newName}`);
                
                await logChannel.setName(newName);
                console.log(`[System] เปลี่ยนชื่อห้องสำเร็จ!`);

                // 2. ส่งข้อความประกาศแบบ Embed
                const levelEmbed = new EmbedBuilder()
                    .setColor('#00FF7F')
                    .setAuthor({ name: 'LEVEL UP! 🎊', iconURL: message.author.displayAvatarURL() })
                    .setDescription(`ยินดีด้วย <@${message.author.id}>! ตอนนี้เลเวลของคุณคือ **${userData.level}**`)
                    .setFooter({ text: 'ระบบเลเวลอัตโนมัติ' })
                    .setTimestamp();

                await logChannel.send({ embeds: [levelEmbed] });
            }
        } catch (err) {
            console.error('❌ ไม่สามารถเปลี่ยนชื่อห้องได้!');
            console.error(`สาเหตุ: ${err.message}`);
        }
    }
    await userData.save();

    // --- Commands ---
    if (!message.content.startsWith(PREFIX)) return;
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'level' || command === 'lv') {
        message.reply(`📊 **${message.author.username}** | Level: **${userData.level}** | XP: **${userData.xp}/${userData.level * 100}**`);
    }
});

client.login(process.env.TOKEN);