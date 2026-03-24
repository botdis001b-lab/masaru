const { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');

// --- [ตั้งค่าระบบ] ---
const INACTIVE_DAYS = 10; 
const ROLE_ID = '1356148472851726437'; // ยศที่ให้กดรับ
const CHANNEL_ID = '1486030638464237631'; // ห้องที่มีปุ่มกด

// Schema สำหรับเก็บเวลาเข้าห้องเสียงล่าสุด
const VoiceActive = mongoose.models.VoiceActive || mongoose.model('VoiceActive', new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    lastActive: { type: Date, default: Date.now }
}));

function initMemberManagement(client) {
    // --- [ส่วนที่ 1: ระบบปุ่มกดรับยศ พร้อมคำอธิบายและการอัปเดต] ---
    client.once(Events.ClientReady, async () => {
        const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
        if (!channel) return;

        // ค้นหาและลบข้อความเก่าของบอทในห้องนี้ เพื่อให้หน้าตาปุ่มอัปเดตใหม่เสมอ
        const messages = await channel.messages.fetch({ limit: 50 });
        const oldMessages = messages.filter(msg => msg.author.id === client.user.id);
        if (oldMessages.size > 0) {
            await channel.bulkDelete(oldMessages).catch(() => null);
        }

        const embed = new EmbedBuilder()
            .setTitle('🛡️ ระบบรับยศเข้าห้องพิเศษ')
            .setColor('#00ff99')
            .setThumbnail(client.user.displayAvatarURL())
            .setDescription(
                `ยินดีต้อนรับสู่ห้อง **#รับยศ** ครับ!\n\n` +
                `**รายละเอียดการรับยศ:**\n` +
                `• กดปุ่มด้านล่างเพื่อรับยศ <@&${ROLE_ID}>\n` +
                `• ยศนี้ใช้สำหรับเปิดการมองเห็นห้องพิเศษภายในเซิร์ฟเวอร์\n\n` +
                `**⚠️ กฎการรักษาความเคลื่อนไหว:**\n` +
                `• หากไม่เข้าใช้งานห้องเสียง (Voice Channel) เกิน **${INACTIVE_DAYS} วัน**\n` +
                `• ระบบจะทำการ **ถอดยศทั้งหมด** ออกอัตโนมัติเพื่อรักษาความสะอาดของรายชื่อสมาชิกครับ\n\n` +
                `*หากโดนถอดยศไปแล้ว สามารถกลับมากดรับใหม่ได้ที่นี่ทุกเมื่อ!*`
            )
            .setFooter({ text: 'Masaru Management System', iconURL: client.user.displayAvatarURL() })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('get_role')
                .setLabel('✅ กดเพื่อรับยศ / คืนยศ')
                .setStyle(ButtonStyle.Success)
        );

        await channel.send({ embeds: [embed], components: [row] });
        console.log(`[System] อัปเดตหน้าปุ่มกดรับยศในห้องเรียบร้อยแล้ว`);
    });

    // จัดการการกดปุ่ม (สลับยศไปมา)
    client.on(Events.InteractionCreate, async (interaction) => {
        if (!interaction.isButton() || interaction.customId !== 'get_role') return;
        
        const role = interaction.guild.roles.cache.get(ROLE_ID);
        if (!role) return interaction.reply({ content: '❌ ไม่พบข้อมูลยศในเซิร์ฟเวอร์ กรุณาแจ้งแอดมิน', ephemeral: true });

        if (interaction.member.roles.cache.has(ROLE_ID)) {
            await interaction.member.roles.remove(role);
            interaction.reply({ content: `✅ ถอดยศ <@&${ROLE_ID}> เรียบร้อยแล้วครับ`, ephemeral: true });
        } else {
            await interaction.member.roles.add(role);
            interaction.reply({ content: `✅ รับยศ <@&${ROLE_ID}> เรียบร้อย! ยินดีต้อนรับเข้าสู่ห้องพิเศษครับ`, ephemeral: true });
        }
    });

    // --- [ส่วนที่ 2: ระบบบันทึกเวลาเมื่อเข้าห้องเสียง] ---
    client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
        // บันทึกเวลาเมื่อมีการเข้าห้องเสียงใดๆ
        if (!oldState.channelId && newState.channelId) {
            await VoiceActive.findOneAndUpdate(
                { userId: newState.member.id },
                { lastActive: new Date() },
                { upsert: true }
            );
        }
    });

    // --- [ส่วนที่ 3: ระบบตรวจสอบและถอดยศคนหาย 10 วัน] ---
    setInterval(async () => {
        console.log(`[System] เริ่มตรวจสอบสมาชิกที่ไม่มีความเคลื่อนไหวเกิน ${INACTIVE_DAYS} วัน...`);
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - INACTIVE_DAYS);

        try {
            const inactiveUsers = await VoiceActive.find({ lastActive: { $lt: cutoff } });
            
            for (const data of inactiveUsers) {
                const guild = client.guilds.cache.first();
                if (!guild) continue;

                const member = await guild.members.fetch(data.userId).catch(() => null);
                if (member && !member.permissions.has('Administrator')) { // ข้ามแอดมิน
                    const rolesToRemove = member.roles.cache.filter(role => role.name !== '@everyone');
                    if (rolesToRemove.size > 0) {
                        await member.roles.remove(rolesToRemove).catch(() => null);
                        console.log(`[Auto-Remove] ถอดยศของ ${member.user.username} เนื่องจากหายไปนานเกินกำหนด`);
                    }
                }
            }
        } catch (err) {
            console.error('[Error] ตรวจสอบคนหายผิดพลาด:', err);
        }
    }, 1000 * 60 * 60 * 24); // รันตรวจสอบวันละ 1 ครั้ง
}

module.exports = { initMemberManagement };