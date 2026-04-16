const { EmbedBuilder, Events } = require('discord.js');

// 🚩 ID ห้องสำหรับเก็บ Log ทั้งหมดตามที่พี่ต้องการ
const GLOBAL_LOG_CHANNEL_ID = '1494379391327928370'; 

function initSystemLogs(client) {
    console.log("🛠️ ระบบ Global Log เริ่มทำงาน...");

    async function sendLog(embed) {
        try {
            const channel = await client.channels.fetch(GLOBAL_LOG_CHANNEL_ID);
            if (channel) await channel.send({ embeds: [embed] });
        } catch (e) { console.error("Log Error:", e.message); }
    }

    // 1. Log เมื่อมีคนลบข้อความ
    client.on(Events.MessageDelete, (message) => {
        if (message.author?.bot || !message.content) return;
        const embed = new EmbedBuilder()
            .setColor('#ff4d4d')
            .setAuthor({ name: '🗑️ มีการลบข้อความ' })
            .setDescription(`**ผู้ส่ง:** ${message.author}\n**ช่อง:** ${message.channel}\n**ข้อความ:** ${message.content}`)
            .setTimestamp();
        sendLog(embed);
    });

    // 2. Log เมื่อมีคนแก้ไขข้อความ
    client.on(Events.MessageUpdate, (oldMsg, newMsg) => {
        if (oldMsg.author?.bot || oldMsg.content === newMsg.content) return;
        const embed = new EmbedBuilder()
            .setColor('#ffa500')
            .setAuthor({ name: '📝 มีการแก้ไขข้อความ' })
            .addFields(
                { name: 'ก่อนแก้ไข', value: oldMsg.content || 'ว่างเปล่า' },
                { name: 'หลังแก้ไข', value: newMsg.content || 'ว่างเปล่า' }
            )
            .setFooter({ text: `ผู้แก้ไข: ${oldMsg.author.tag}` })
            .setTimestamp();
        sendLog(embed);
    });

    // 3. Log เมื่อสมาชิกเข้า/ออกเซิร์ฟเวอร์
    client.on(Events.GuildMemberAdd, (member) => {
        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setAuthor({ name: '📥 สมาชิกเข้าใหม่' })
            .setDescription(`**${member.user.tag}** เพิ่งเข้าร่วมเซิร์ฟเวอร์\nID: ${member.id}`)
            .setTimestamp();
        sendLog(embed);
    });

    client.on(Events.GuildMemberRemove, (member) => {
        const embed = new EmbedBuilder()
            .setColor('#e74c3c')
            .setAuthor({ name: '📤 สมาชิกออกไปแล้ว' })
            .setDescription(`**${member.user.tag}** ออกจากเซิร์ฟเวอร์ไปแล้ว`)
            .setTimestamp();
        sendLog(embed);
    });

    // 4. Log เมื่อมีคนเปลี่ยนชื่อเล่น
    client.on(Events.GuildMemberUpdate, (oldMember, newMember) => {
        if (oldMember.nickname !== newMember.nickname) {
            const embed = new EmbedBuilder()
                .setColor('#3498db')
                .setAuthor({ name: '📛 เปลี่ยนชื่อเล่น' })
                .setDescription(`**${newMember.user.tag}** เปลี่ยนชื่อเล่น`)
                .addFields(
                    { name: 'เดิม', value: oldMember.nickname || 'ไม่มี', inline: true },
                    { name: 'ใหม่', value: newMember.nickname || 'ไม่มี', inline: true }
                )
                .setTimestamp();
            sendLog(embed);
        }
    });
}

module.exports = { initSystemLogs };