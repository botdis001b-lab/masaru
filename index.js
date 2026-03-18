const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');
const startWeb = require('./server.js');

// 1. เชื่อมต่อฐานข้อมูลก่อน
mongoose.connect(process.env.MONGO_URL)
    .then(() => console.log('MongoDB Connected! ✅'))
    .catch(err => console.error(err));

// 2. สร้าง Schema และ Model ให้เสร็จก่อนเพื่อน
const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 }
});
const User = mongoose.model('User', userSchema);

// 3. ส่ง User model ไปให้หน้าเว็บรัน (แก้ปัญหา MissingSchemaError)
startWeb(User);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers
    ],
});

// --- ดึงโค้ดนาฬิกาและ Log เสียงจากไฟล์เก่าที่พี่มีมาใส่ตรงนี้ได้เลยครับ ---
// (โค้ดส่วน client.on('ready') และ client.on('voiceStateUpdate') ของพี่ใช้ได้อยู่แล้ว)

client.login(process.env.TOKEN);