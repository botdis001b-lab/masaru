const { EmbedBuilder, Events } = require('discord.js');

const GLOBAL_LOG_CHANNEL_ID = '1494379391327928370'; 

function initSystemLogs(client) {
    console.log("🛠️ ระบบ Global Log เริ่มทำงาน...");

    async function sendLog(embed) {
        try {
            const channel = await client.channels.fetch(GLOBAL_LOG_CHANNEL_ID);
            if (channel) await channel.send({ embeds: [embed] });
        } catch (e) { console.error("Log Send Error:", e.message); }
    }

    client.on(Events.MessageDelete, (message) => {
        if (message.author?.bot || !message.content) return;
        const embed = new EmbedBuilder()
            .setColor('#ff4d4d')
            .setTitle('🗑️ ลบข้อความ')
            .setDescription(`**คนส่ง:** ${message.author}\n**ห้อง:** ${message.channel}\n**เนื้อหา:** ${message.content}`)
            .setTimestamp();
        sendLog(embed);
    });

    client.on(Events.MessageUpdate, (oldMsg, newMsg) => {
        if (oldMsg.author?.bot || oldMsg.content === newMsg.content) return;
        const embed = new EmbedBuilder()
            .setColor('#ffa500')
            .setTitle('📝 แก้ไขข้อความ')
            .addFields(
                { name: 'ก่อนแก้', value: oldMsg.content || 'ไม่มี' },
                { name: 'หลังแก้', value: newMsg.content || 'ไม่มี' }
            )
            .setFooter({ text: `โดย: ${oldMsg.author.tag}` })
            .setTimestamp();
        sendLog(embed);
    });

    client.on(Events.GuildMemberAdd, (member) => {
        const embed = new EmbedBuilder().setColor('#2ecc71').setTitle('📥 สมาชิกเข้าใหม่').setDescription(`**${member.user.tag}** เข้ามาแล้ว`).setTimestamp();
        sendLog(embed);
    });

    client.on(Events.GuildMemberRemove, (member) => {
        const embed = new EmbedBuilder().setColor('#e74c3c').setTitle('📤 สมาชิกออก').setDescription(`**${member.user.tag}** ออกจากเซิร์ฟไปแล้ว`).setTimestamp();
        sendLog(embed);
    });
}

module.exports = { initSystemLogs };