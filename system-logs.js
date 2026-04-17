const { EmbedBuilder, Events } = require('discord.js');

// 🚩 ห้อง Log ระบบใหม่ (เหตุการณ์ข้อความ)
const MESSAGE_LOG_CHANNEL_ID = '1494379391327928370'; 

function initSystemLogs(client) {
    console.log("🛠️ ระบบ New Log (Message Tracker) เริ่มทำงาน...");

    async function sendLog(embed) {
        try {
            const channel = await client.channels.fetch(MESSAGE_LOG_CHANNEL_ID);
            if (channel) await channel.send({ embeds: [embed] });
        } catch (e) { console.error("Message Log Error:", e.message); }
    }

    // จับคนลบข้อความ
    client.on(Events.MessageDelete, (message) => {
        if (message.author?.bot || !message.content) return;
        const embed = new EmbedBuilder()
            .setColor('#ff4d4d')
            .setAuthor({ name: '🗑️ ลบข้อความ' })
            .setDescription(`**ผู้ส่ง:** ${message.author}\n**ห้อง:** ${message.channel}\n**เนื้อหา:** ${message.content}`)
            .setTimestamp();
        sendLog(embed);
    });

    // จับคนแก้ไขข้อความ
    client.on(Events.MessageUpdate, (oldMsg, newMsg) => {
        if (oldMsg.author?.bot || oldMsg.content === newMsg.content) return;
        const embed = new EmbedBuilder()
            .setColor('#ffa500')
            .setAuthor({ name: '📝 แก้ไขข้อความ' })
            .addFields(
                { name: 'เดิม', value: oldMsg.content || 'ไม่มี', inline: false },
                { name: 'ใหม่', value: newMsg.content || 'ไม่มี', inline: false }
            )
            .setFooter({ text: `แก้ไขโดย: ${oldMsg.author.tag}` })
            .setTimestamp();
        sendLog(embed);
    });
}

module.exports = { initSystemLogs };