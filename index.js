const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');

// เชื่อมต่อ MongoDB สำหรับเก็บเวล
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

// ID และ ระบบนาฬิกา ASCII (คงเดิมไว้ทั้งหมด)
const CLOCK_CHANNEL_ID = '1483918700976410694'; 
// ... โค้ด asciiDigits และ getNewDigitalClock ของพี่ ...

client.once('ready', async () => {
    console.log(`Bot Online as: ${client.user.tag} 🤖`);
    // รันนาฬิกาปกติ...
});

// ระบบเลเวล และ Log เสียง (คงเดิมไว้)
// ...

client.login(process.env.TOKEN);