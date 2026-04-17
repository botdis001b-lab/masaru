const { EmbedBuilder, Events } = require('discord.js');

const MESSAGE_LOG_CHANNEL_ID = '1494379391327928370'; 

function initSystemLogs(client) {
    async function sendLog(embed) {
        try {
            const channel = await client.channels.fetch(MESSAGE_LOG_CHANNEL_ID);
            if (channel) await channel.send({ embeds: [embed] });
        } catch (e) { }
    }

    // ลบข้อความ
    client.on(Events.MessageDelete, (message) => {
        if (message.author?.bot || !message.content) return;
        const embed = new EmbedBuilder()
            .setColor('#ff4d4d')
            .setAuthor({ name: '🗑️ ลบข้อความ' })
            .setDescription(`**ผู้ส่ง:** ${message.author}\n**ห้อง:** ${message.channel}\n**ข้อความเดิม:** ${message.content}`)
            .setTimestamp();
        sendLog(embed);
    });

    // แก้ไขข้อความ
    client.on(Events.MessageUpdate, (oldMsg, newMsg) => {
        if (oldMsg.author?.bot || oldMsg.content === newMsg.content) return;
        const embed = new EmbedBuilder()
            .setColor('#ffa500')
            .setAuthor({ name: '📝 แก้ไขข้อความ' })
            .addFields(
                { name: 'ก่อนแก้ไข', value: oldMsg.content || 'ว่างเปล่า' },
                { name: 'หลังแก้ไข', value: newMsg.content || 'ว่างเปล่า' }
            )
            .setFooter({ text: `แก้ไขโดย: ${oldMsg.author.tag}` })
            .setTimestamp();
        sendLog(embed);
    });
}

module.exports = { initSystemLogs };