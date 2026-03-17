const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config(); // ใช้สำหรับดึง Token จากหน้า Variables ของ Railway

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ส่วนควบคุม: เช็คสถานะการออนไลน์
client.once('ready', () => {
    console.log('=================================');
    console.log(`Log in as: ${client.user.tag}`);
    console.log(`Status: Online and Ready!`);
    console.log('=================================');
});

// ส่วนรับคำสั่งพื้นฐาน (เอาไว้เช็คว่าบอทตอบสนองไหม)
client.on('messageCreate', (message) => {
    if (message.author.bot) return;

    if (message.content === '!ping') {
        message.reply('Pong! ระบบทำงานปกติดีครับ');
    }
});

// ใช้ Token จาก Environment Variable เพื่อความปลอดภัย
client.login(process.env.TOKEN);