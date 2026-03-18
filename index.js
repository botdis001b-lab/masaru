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
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates, // *** สำคัญมากสำหรับการดูคนเข้า-ออกห้องเสียง ***
    ],
});

const PREFIX = '!';
const LEVEL_LOG_ID = '1483551045711040605'; // ห้องแจ้งเลเวลอัป
const VOICE_LOG_ID = '1204742409347534900'; // ห้องแจ้งเข้า-ออกห้องเสียง (#เข้า-ออกดิส)

client.once('ready', async () => {
    console.log(`Log in as: ${client.user.tag} ✅`);
    
    // ระบบทดสอบการส่งข้อความเมื่อบอทเริ่มทำงาน
    try {
        const testChannel = await client.channels.fetch(VOICE_LOG_ID);
        if (testChannel) {
            await testChannel.send('⚙️ **ระบบ Voice LOG พร้อมใช้งาน:** ตรวจสอบสิทธิ์การส่งข้อความสำเร็จ!');
            console.log(`[System] ตรวจพบห้อง LOG: ${testChannel.name} และส่งข้อความทดสอบแล้ว ✅`);
        }
    } catch (err) {
        console.error(`[Error] บอทเข้าไม่ถึงห้อง LOG: ${err.message}`);
    }
});

// --- ระบบ LOG การเข้า-ออก และย้ายห้องเสียง ---
client.on('voiceStateUpdate', async (oldState, newState) => {
    try {
        const logChannel = await client.channels.fetch(VOICE_LOG_ID);
        if (!logChannel) return;

        const member = newState.member || oldState.member;
        if (member.user.bot) return; // ไม่บันทึกบอท

        // 1. กรณีเข้าห้องเสียง
        if (!oldState.channelId && newState.channelId) {
            const embed = new EmbedBuilder()
                .setColor('#2ECC71')
                .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() })
                .setDescription(`🟢 <@${member.id}> **เข้าห้องเสียง:** \`${newState.channel.name}\``)
                .setTimestamp();
            await logChannel.send({ embeds: [embed] });
        }

        // 2. กรณีออกจากห้องเสียง
        else if (oldState.channelId && !newState.channelId) {
            const embed = new EmbedBuilder()
                .setColor('#E74C3C')
                .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() })
                .setDescription(`🔴 <@${member.id}> **ออกจากห้องเสียง:** \`${oldState.channel.name}\``)
                .setTimestamp();
            await logChannel.send({ embeds: [embed] });
        }

        // 3. กรณีย้ายห้องเสียง
        else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            const embed = new EmbedBuilder()
                .setColor('#F1C40F')
                .setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() })
                .setDescription(`🟡 <@${member.id}> **ย้ายห้อง:** \`${oldState.channel.name}\` ➡️ \`${newState.channel.name}\``)
                .setTimestamp();
            await logChannel.send({ embeds: [embed] });
        }
    } catch (err) {
        console.error('Voice Log Error:', err);
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
            const logChannel = await client.channels.fetch(LEVEL_LOG_ID);
            if (logChannel) {
                // พยายามเปลี่ยนชื่อห้อง (จำกัด 2 ครั้ง/10 นาที ตามกฎ Discord)
                await logChannel.setName(`🏆┃level-${userData.level}`).catch(() => {});
                
                const levelEmbed = new EmbedBuilder()
                    .setColor('#00FF7F')
                    .setAuthor({ name: 'LEVEL UP!', iconURL: message.author.displayAvatarURL() })
                    .setDescription(`ยินดีด้วย <@${message.author.id}> เลเวลอัปเป็น **${userData.level}** แล้ว!`)
                    .setTimestamp();
                await logChannel.send({ embeds: [levelEmbed] });
            }
        }
        await userData.save();
    } catch (err) {
        console.error('Level System Error:', err);
    }

    // Commands
    if (!message.content.startsWith(PREFIX)) return;
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'level' || command === 'lv') {
        message.reply(`📊 **${message.author.username}** | Level: **${userData.level}** | XP: **${userData.xp}/${userData.level * 100}**`);
    }
});

client.login(process.env.TOKEN);