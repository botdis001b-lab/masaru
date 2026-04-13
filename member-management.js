const { 
    Events, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    UserSelectMenuBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} = require('discord.js');
const mongoose = require('mongoose');

// --- [ตั้งค่าระบบหลัก] ---
const INACTIVE_DAYS = 10; 
const ROLE_ID = '1356148472851726437'; // ยศที่ควบคุม
const CHANNEL_ID = '1486030638464237631'; // ห้องรับยศ (หน้าบ้าน)
const ADMIN_CHANNEL_ID = '1490233799534186627'; // ห้องควบคุม (หลังบ้าน)
const OWNER_ID = '550122613087666177'; // ID ของพี่ (Admin)

// Schema สำหรับเก็บเวลาเคลื่อนไหว (ยังคงไว้เพื่อระบบ Auto Cleanup)
const VoiceActive = mongoose.models.VoiceActive || mongoose.model('VoiceActive', new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    lastActive: { type: Date, default: Date.now }
}));

function initMemberManagement(client) {

    // --- [1. หน้าจอ Dashboard Admin - หลังบ้าน] ---
    client.once(Events.ClientReady, async () => {
        const adminChannel = await client.channels.fetch(ADMIN_CHANNEL_ID).catch(() => null);
        if (!adminChannel) return;

        // ล้างข้อความเก่าของบอทออกก่อน
        const messages = await adminChannel.messages.fetch({ limit: 10 });
        const oldAdminMsgs = messages.filter(m => m.author.id === client.user.id);
        if (oldAdminMsgs.size > 0) await adminChannel.bulkDelete(oldAdminMsgs).catch(() => null);

        const adminEmbed = new EmbedBuilder()
            .setTitle('⚙️ แผงควบคุมการจัดการสมาชิก (Admin Only)')
            .setColor('#ff0000')
            .setDescription(
                `**เลือกรูปแบบการจัดการ:**\n\n` +
                `🔍 **เลือกรายชื่อถอดยศ:** ดึงรายชื่อสมาชิกทุกคนมาให้พี่เลือกติ๊กเพื่อถอดยศ\n` +
                `🧹 **กวาดล้าง Auto:** ถอดเฉพาะคนที่หายไปเกิน ${INACTIVE_DAYS} วัน (ตามฐานข้อมูล)\n` +
                `💥 **ล้างบางทั้งหมด:** ดึงยศคืนจากทุกคนที่ครอบครองยศนี้ทันที`
            )
            .setTimestamp();

        const adminRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('open_selector').setLabel('🔍 เลือกรายชื่อถอดยศ').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('run_cleanup_now').setLabel('🧹 กวาดล้าง Auto').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('force_remove_all').setLabel('💥 ล้างบางทั้งหมด').setStyle(ButtonStyle.Danger)
        );

        await adminChannel.send({ embeds: [adminEmbed], components: [adminRow] });
    });

    // --- [2. หน้าจอรับยศสมาชิก - หน้าบ้าน] ---
    client.once(Events.ClientReady, async () => {
        const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
        if (!channel) return;
        const messages = await channel.messages.fetch({ limit: 10 });
        const oldMessages = messages.filter(msg => msg.author.id === client.user.id);
        if (oldMessages.size > 0) await channel.bulkDelete(oldMessages).catch(() => null);

        const embed = new EmbedBuilder()
            .setTitle('🛡️ MASARU MEMBER ACCESS')
            .setColor('#2f3136')
            .setDescription(`กดปุ่มด้านล่างเพื่อรับยศ <@&${ROLE_ID}>\n*(ระบบจะบันทึกการเข้าห้องเสียงเพื่อยืนยันสถานะ)*`);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('get_role').setLabel('✅ ยืนยันตัวตน / รับยศ').setStyle(ButtonStyle.Success)
        );
        await channel.send({ embeds: [embed], components: [row] });
    });

    // --- [3. ระบบจัดการ Interaction] ---
    client.on(Events.InteractionCreate, async (interaction) => {
        // ส่วนของสมาชิกทั่วไป: รับยศ
        if (interaction.isButton() && interaction.customId === 'get_role') {
            const role = interaction.guild.roles.cache.get(ROLE_ID);
            if (interaction.member.roles.cache.has(ROLE_ID)) {
                await interaction.member.roles.remove(role);
                return interaction.reply({ content: 'คืนยศเรียบร้อยแล้วครับ', ephemeral: true });
            } else {
                await interaction.member.roles.add(role);
                return interaction.reply({ content: 'รับยศเรียบร้อย ยินดีต้อนรับครับ!', ephemeral: true });
            }
        }

        // ส่วนของ Admin (พี่) เท่านั้น
        if (interaction.user.id !== OWNER_ID) return;

        // 3.1 ปุ่มเรียกเมนูเลือกรายชื่อ
        if (interaction.isButton() && interaction.customId === 'open_selector') {
            const userSelect = new UserSelectMenuBuilder()
                .setCustomId('mass_kick_select')
                .setPlaceholder('เลือกสมาชิกที่ต้องการถอดยศ (เลือกได้หลายคน)...')
                .setMinValues(1)
                .setMaxValues(25);

            const row = new ActionRowBuilder().addComponents(userSelect);
            return interaction.reply({ content: '📌 **กรุณาเลือกรายชื่อที่ต้องการถอดยศ:**', components: [row], ephemeral: true });
        }

        // 3.2 เมื่อเลือกรายชื่อเสร็จแล้วสั่งถอด
        if (interaction.isUserSelectMenu() && interaction.customId === 'mass_kick_select') {
            await interaction.deferUpdate();
            const selectedIds = interaction.values;
            let count = 0;

            for (const uid of selectedIds) {
                const member = await interaction.guild.members.fetch(uid).catch(() => null);
                if (member && member.roles.cache.has(ROLE_ID) && !member.permissions.has('Administrator')) {
                    await member.roles.remove(ROLE_ID).catch(() => null);
                    count++;
                }
            }
            return interaction.followUp({ content: `✅ ถอดยศสมาชิกที่พี่เลือกไปทั้งหมด \`${count}\` คน เรียบร้อยครับ!`, ephemeral: true });
        }

        // 3.3 ปุ่มกวาดล้าง Auto (ตามฐานข้อมูล 10 วัน)
        if (interaction.isButton() && interaction.customId === 'run_cleanup_now') {
            await interaction.reply({ content: '🧹 กำลังสแกนหาคนที่หายไปเกินกำหนด...', ephemeral: true });
            const count = await runCleanupLogic(client);
            return interaction.followUp({ content: `✅ กวาดล้างเสร็จ! ถอดยศไป \`${count}\` คน`, ephemeral: true });
        }

        // 3.4 ปุ่มล้างบางทั้งหมด (ทุกคนมียศโดนหมด)
        if (interaction.isButton() && interaction.customId === 'force_remove_all') {
            await interaction.reply({ content: '⚠️ กำลังดึงยศคืนจากสมาชิกทุกคนในดิสคอร์ด...', ephemeral: true });
            const role = interaction.guild.roles.cache.get(ROLE_ID);
            const members = Array.from(role.members.values());
            let count = 0;
            for (const m of members) {
                if (!m.permissions.has('Administrator')) {
                    await m.roles.remove(role).catch(() => null);
                    count++;
                }
            }
            return interaction.followUp({ content: `💥 ล้างบางเสร็จสิ้น! ดึงยศคืนไป \`${count}\` คน`, ephemeral: true });
        }
    });

    // บันทึกเสียง
    client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
        if (newState.channelId) {
            await VoiceActive.findOneAndUpdate({ userId: newState.member.id }, { lastActive: new Date() }, { upsert: true });
        }
    });

    setInterval(() => runCleanupLogic(client), 86400000);
}

async function runCleanupLogic(client) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - INACTIVE_DAYS);
    let count = 0;
    try {
        const inactive = await VoiceActive.find({ lastActive: { $lt: cutoff } });
        const guild = client.guilds.cache.first();
        for (const data of inactive) {
            const member = await guild?.members.fetch(data.userId).catch(() => null);
            if (member && member.roles.cache.has(ROLE_ID) && !member.permissions.has('Administrator')) {
                await member.roles.remove(ROLE_ID).catch(() => null);
                count++;
            }
        }
    } catch (e) { console.error(e); }
    return count;
}

module.exports = { initMemberManagement };