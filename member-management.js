const { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');

// --- [ตั้งค่า] ---
const INACTIVE_DAYS = 10; 
const ROLE_ID = '1356148472851726437'; // ยศที่ให้กดรับ
const CHANNEL_ID = '1486030638464237631'; // ห้องที่มีปุ่มกด

const VoiceActive = mongoose.models.VoiceActive || mongoose.model('VoiceActive', new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    lastActive: { type: Date, default: Date.now }
}));

function initMemberManagement(client) {
    // --- [ระบบปุ่มกดรับยศ] ---
    client.once(Events.ClientReady, async () => {
        const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
        if (!channel) return;

        const messages = await channel.messages.fetch({ limit: 10 });
        const isExist = messages.some(msg => msg.author.id === client.user.id);
        
        if (!isExist) {
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
                    `• ระบบจะ **ถอดยศทั้งหมด** ออกอัตโนมัติเพื่อระบุสมาชิกที่ยังเคลื่อนไหวอยู่ครับ\n\n` +
                    `*หากโดนถอดยศ สามารถกลับมากดรับใหม่ได้ตลอดเวลา!*`
                )
                .setFooter({ text: 'Masaru Management System', iconURL: client.user.displayAvatarURL() })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('get_role').setLabel('✅ กดรับยศ / คืนยศ').setStyle(ButtonStyle.Success)
            );
            await channel.send({ embeds: [embed], components: [row] });
        }
    });

    // จัดการการกดปุ่ม
    client.on(Events.InteractionCreate, async (interaction) => {
        if (!interaction.isButton() || interaction.customId !== 'get_role') return;
        const role = interaction.guild.roles.cache.get(ROLE_ID);
        if (!role) return interaction.reply({ content: 'ไม่พบข้อมูลยศในระบบ', ephemeral: true });

        if (interaction.member.roles.cache.has(ROLE_ID)) {
            await interaction.member.roles.remove(role);
            interaction.reply({ content: 'ถอดยศ <@&' + ROLE_ID + '> เรียบร้อยแล้วครับ', ephemeral: true });
        } else {
            await interaction.member.roles.add(role);
            interaction.reply({ content: 'รับยศ <@&' + ROLE_ID + '> เรียบร้อย! ยินดีต้อนรับครับ', ephemeral: true });
        }
    });

    // --- [ระบบบันทึกเวลาเข้าห้องเสียง] ---
    client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
        if (newState.channelId) {
            await VoiceActive.findOneAndUpdate(
                { userId: newState.member.id },
                { lastActive: new Date() },
                { upsert: true }
            );
        }
    });

    // --- [ระบบตรวจสอบคนหายทุก 24 ชม.] ---
    setInterval(async () => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - INACTIVE_DAYS);
        const inactive = await VoiceActive.find({ lastActive: { $lt: cutoff } });
        
        for (const data of inactive) {
            const guild = client.guilds.cache.first();
            const member = await guild?.members.fetch(data.userId).catch(() => null);
            if (member && !member.permissions.has('Administrator')) { // แอดมินจะไม่โดนถอด
                const roles = member.roles.cache.filter(r => r.name !== '@everyone');
                if (roles.size > 0) {
                    await member.roles.remove(roles).catch(() => null);
                    console.log(`[Auto-Remove] ถอดยศของ ${member.user.username} (หายไปเกิน 10 วัน)`);
                }
            }
        }
    }, 1000 * 60 * 60 * 24);
}

module.exports = { initMemberManagement };