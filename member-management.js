const { 
    Events, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder 
} = require('discord.js');
const mongoose = require('mongoose');

// --- [ตั้งค่าระบบหลัก] ---
const INACTIVE_DAYS = 10; 
const ROLE_ID = '1356148472851726437'; // ยศที่ควบคุม
const CHANNEL_ID = '1486030638464237631'; // ห้องรับยศ
const ADMIN_CHANNEL_ID = '1490233799534186627'; // ห้องควบคุม
const OWNER_ID = '550122613087666177'; // ID ของพี่ (Admin)

const VoiceActive = mongoose.models.VoiceActive || mongoose.model('VoiceActive', new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    lastActive: { type: Date, default: Date.now }
}));

function initMemberManagement(client) {

    // --- [1. หน้าจอ Dashboard สำหรับ Admin] ---
    client.once(Events.ClientReady, async () => {
        const adminChannel = await client.channels.fetch(ADMIN_CHANNEL_ID).catch(() => null);
        if (!adminChannel) return;

        const messages = await adminChannel.messages.fetch({ limit: 10 });
        const oldAdminMsgs = messages.filter(m => m.author.id === client.user.id);
        if (oldAdminMsgs.size > 0) await adminChannel.bulkDelete(oldAdminMsgs).catch(() => null);

        const adminEmbed = new EmbedBuilder()
            .setTitle('⚙️ แผงควบคุมระบบสมาชิก (Full Control)')
            .setColor('#ff0000')
            .setDescription(
                `**โหมดควบคุม:** สมาชิกทุกคนที่มีชื่อในฐานข้อมูล\n` +
                `• เกณฑ์ถอดยศ: \`${INACTIVE_DAYS}\` วัน\n\n` +
                `**ปุ่มสั่งการ:**\n` +
                `🔍 **ดูรายชื่อทั้งหมด:** เช็กสถานะทุกคนแบบละเอียด (เปลี่ยนหน้าได้)\n` +
                `🧹 **กวาดล้างทั้งหมด:** ถอดยศคนที่หายเกินกำหนดทันที`
            )
            .setTimestamp();

        const adminRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('check_all_0').setLabel('🔍 ดูรายชื่อสมาชิก').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('run_cleanup_all').setLabel('🧹 กวาดล้างทั้งหมด').setStyle(ButtonStyle.Danger)
        );

        await adminChannel.send({ embeds: [adminEmbed], components: [adminRow] });
    });

    // --- [2. หน้าจอรับยศ (หน้าบ้าน)] ---
    client.once(Events.ClientReady, async () => {
        const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
        if (!channel) return;
        const messages = await channel.messages.fetch({ limit: 10 });
        const oldMessages = messages.filter(msg => msg.author.id === client.user.id);
        if (oldMessages.size > 0) await channel.bulkDelete(oldMessages).catch(() => null);

        const embed = new EmbedBuilder()
            .setTitle('🛡️ MASARU MEMBER ACCESS')
            .setColor('#2f3136')
            .setDescription(`กดปุ่มเพื่อรับยศ <@&${ROLE_ID}>\n*(ระบบจะเช็กความเคลื่อนไหวทุก ${INACTIVE_DAYS} วัน)*`)
            .setFooter({ text: 'Masaru Automation' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('get_role').setLabel('✅ รับ/คืนยศ').setStyle(ButtonStyle.Success)
        );
        await channel.send({ embeds: [embed], components: [row] });
    });

    // --- [3. ระบบจัดการ Interaction (รองรับการเปลี่ยนหน้า)] ---
    client.on(Events.InteractionCreate, async (interaction) => {
        if (interaction.isButton() && interaction.customId === 'get_role') {
            const role = interaction.guild.roles.cache.get(ROLE_ID);
            if (interaction.member.roles.cache.has(ROLE_ID)) {
                await interaction.member.roles.remove(role);
                return interaction.reply({ content: 'ถอดยศแล้ว', ephemeral: true });
            } else {
                await interaction.member.roles.add(role);
                return interaction.reply({ content: 'รับยศแล้ว', ephemeral: true });
            }
        }

        if (interaction.user.id !== OWNER_ID) return;

        // ระบบดูรายชื่อแบบเปลี่ยนหน้าได้
        if (interaction.isButton() && interaction.customId.startsWith('check_all_')) {
            const page = parseInt(interaction.customId.split('_')[2]);
            const users = await VoiceActive.find().sort({ lastActive: 1 });
            const PAGE_SIZE = 15;
            const totalPages = Math.ceil(users.length / PAGE_SIZE);
            const start = page * PAGE_SIZE;
            const currentUsers = users.slice(start, start + PAGE_SIZE);

            if (users.length === 0) return interaction.reply({ content: 'ไม่มีข้อมูล', ephemeral: true });

            let report = `📊 **รายชื่อสมาชิก (${page + 1}/${totalPages})**\n`;
            const selectMenu = new StringSelectMenuBuilder().setCustomId('manage_select').setPlaceholder('เลือกคนที่จะจัดการ...');

            currentUsers.forEach(u => {
                const diff = Math.floor((new Date() - u.lastActive) / 86400000);
                const remain = INACTIVE_DAYS - diff;
                const icon = remain <= 0 ? '🔴' : '🟢';
                report += `${icon} <@${u.userId}>: หายไป \`${diff}\` วัน (เหลือ \`${remain > 0 ? remain : 0}\` วัน)\n`;
                selectMenu.addOptions(new StringSelectMenuOptionBuilder().setLabel(`จัดการ: ${u.userId}`).setValue(u.userId));
            });

            const navRow = new ActionRowBuilder();
            if (page > 0) navRow.addComponents(new ButtonBuilder().setCustomId(`check_all_${page - 1}`).setLabel('⬅️ ก่อนหน้า').setStyle(ButtonStyle.Secondary));
            if (page < totalPages - 1) navRow.addComponents(new ButtonBuilder().setCustomId(`check_all_${page + 1}`).setLabel('ถัดไป ➡️').setStyle(ButtonStyle.Secondary));

            const components = [new ActionRowBuilder().addComponents(selectMenu)];
            if (navRow.components.length > 0) components.push(navRow);

            if (interaction.replied || interaction.deferred) {
                await interaction.editReply({ content: report, components: components });
            } else {
                await interaction.reply({ content: report, components: components, ephemeral: true });
            }
        }

        // เมนูจัดการรายคน
        if (interaction.isStringSelectMenu() && interaction.customId === 'manage_select') {
            const tid = interaction.values[0];
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`ext_${tid}`).setLabel('➕ ต่ออายุ (10 วัน)').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`kick_${tid}`).setLabel('🚫 ถอดยศทันที').setStyle(ButtonStyle.Danger)
            );
            return interaction.reply({ content: `🛠️ จัดการ <@${tid}>:`, components: [row], ephemeral: true });
        }

        // ประมวลผลปุ่มจัดการ
        if (interaction.isButton()) {
            const [action, uid] = interaction.customId.split('_');
            if (action === 'ext') {
                await VoiceActive.findOneAndUpdate({ userId: uid }, { lastActive: new Date() });
                return interaction.update({ content: `✅ ต่ออายุให้ <@${uid}> แล้ว`, components: [] });
            }
            if (action === 'kick') {
                const mem = await interaction.guild.members.fetch(uid).catch(() => null);
                if (mem) await mem.roles.remove(mem.roles.cache.filter(r => r.name !== '@everyone'));
                return interaction.update({ content: `🚫 ถอดยศ <@${uid}> แล้ว`, components: [] });
            }
            if (interaction.customId === 'run_cleanup_all') {
                await interaction.reply({ content: '🧹 กำลังกวาดล้าง...', ephemeral: true });
                await runCleanupLogic(client);
            }
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
    try {
        const inactive = await VoiceActive.find({ lastActive: { $lt: cutoff } });
        const guild = client.guilds.cache.first();
        for (const data of inactive) {
            const member = await guild?.members.fetch(data.userId).catch(() => null);
            if (member && !member.permissions.has('Administrator')) {
                const roles = member.roles.cache.filter(r => r.name !== '@everyone');
                await member.roles.remove(roles).catch(() => null);
            }
        }
    } catch (e) { console.error(e); }
}

module.exports = { initMemberManagement };