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
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates, // *** เพิ่มอันนี้เพื่อให้บอทเห็นการเข้า-ออกห้องเสียง ***
    ],
});

const PREFIX = '!';
const LOG_CHANNEL_ID = '1483551045711040605'; 
const VOICE_LOG_ID = '1204742409347534900'; // ห้อง #เข้า-ออกดิส

client.once('ready', () => {
    console.log(`Log in as: ${client.user.tag} ✅`);
});

// --- ระบบ LOG การเข้า-ออกห้องเสียง (Voice Log) ---
client.on('voiceStateUpdate', async (oldState, newState) => {
    const logChannel = await client.channels.fetch(VOICE_LOG_ID);
    if (!logChannel) return;

    const member = newState.member || oldState.member;

    // กรณีที่ 1: เข้าห้องเสียง (เดิมไม่ได้อยู่ในห้องไหนเลย)
    if (!oldState.channelId && newState.channelId) {
        const embed = new EmbedBuilder()
            .setColor('#2ECC71')
            .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() })
            .setDescription(`🎤 <@${member.id}> **เข้าห้องเสียง:** \`${newState.channel.name}\``)
            .setTimestamp();
        logChannel.send({ embeds: [embed] });
    }

    // กรณีที่ 2: ออกจากห้องเสียง (เดิมอยู่แต่ตอนนี้ออกไปแล้ว)
    else if (oldState.channelId && !newState.channelId) {
        const embed = new EmbedBuilder()
            .setColor('#E74C3C')
            .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() })
            .setDescription(`🚫 <@${member.id}> **ออกจากห้องเสียง:** \`${oldState.channel.name}\``)
            .setTimestamp();
        logChannel.send({ embeds: [embed] });
    }

    // กรณีที่ 3: ย้ายห้องเสียง
    else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
        const embed = new EmbedBuilder()
            .setColor('#F1C40F')
            .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() })
            .setDescription(`🔄 <@${member.id}> **ย้ายห้อง:** \`${oldState.channel.name}\` ➡️ \`${newState.channel.name}\``)
            .setTimestamp();
        logChannel.send({ embeds: [embed] });
    }
});

// --- ระบบเลเวล (เหมือนเดิม) ---
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
                await logChannel.setName(`🏆┃level-${userData.level}`).catch(() => {});
                const levelEmbed = new EmbedBuilder()
                    .setColor('#00FF7F')
                    .setDescription(`🎊 <@${message.author.id}> เลเวลอัปเป็น **${userData.level}**!`)
                    .setTimestamp();
                await logChannel.send({ embeds: [levelEmbed] });
            }
        } catch (err) { console.error(err); }
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