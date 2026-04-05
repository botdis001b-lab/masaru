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

// --- [ตั้งค่าระบบ] ---
const INACTIVE_DAYS = 10; 
const ROLE_ID = '1356148472851726437'; // ยศที่ควบคุม
const CHANNEL_ID = '1486030638464237631'; // ห้องรับยศ (หน้าบ้าน)
const ADMIN_CHANNEL_ID = '1490233799534186627'; // ห้องควบคุม (หลังบ้าน)
const OWNER_ID = '550122613087666177'; // ID ของพี่ (Admin)

// Schema สำหรับเก็บเวลาเคลื่อนไหว
const VoiceActive = mongoose.models.VoiceActive || mongoose.model('VoiceActive', new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    lastActive: { type: Date, default: Date.now }
}));

function initMemberManagement(client) {

    // --- [1. สร้างหน้าจอควบคุม Admin (รันตอนบอทออนไลน์)] ---
    client.once(Events.ClientReady, async () => {
        const adminChannel = await client.channels.fetch(ADMIN_CHANNEL_ID).catch(() => null);
        if (!adminChannel) return;

        // ล้างข้อความเก่าในห้องแอดมิน
        const messages = await adminChannel.messages.fetch({ limit: 10 });
        const oldAdminMsgs = messages.filter(m => m.author.id === client.user.id);
        if (oldAdminMsgs.size > 0) await adminChannel.bulkDelete(oldAdminMsgs).catch(() => null);

        const adminEmbed = new EmbedBuilder()
            .setTitle('⚙️ แผงควบคุมระบบสมาชิก (Admin Only)')
            .setColor('#ff0000')
            .setDescription(
                `**การตั้งค่าปัจจุบัน:**\n` +
                `• เกณฑ์ถอดยศ: \`${INACTIVE_DAYS}\` วัน\n` +
                `• ยศที่ดูแล: <@&${ROLE_ID}>\n\n` +
                `**วิธีใช้งาน:**\n` +
                `1. กด **"🔍 เช็กรายชื่อ"** เพื่อดูว่าใครเหลืออีกกี่วัน\n` +
                `2. เลือกชื่อในเมนูเพื่อ **"ต่ออายุ"** หรือ **"ถอดยศทันที"**\n` +
                `3. กด **"🧹 สั่งถอดทั้งหมด"** เพื่อจัดการคนที่หมดเวลาพร้อมกัน`
            )
            .setTimestamp();

        const adminRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('check_inactive').setLabel('🔍 เช็กรายชื่อคนหาย').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('run_cleanup_all').setLabel('🧹 สั่งถอดทั้งหมด').setStyle(ButtonStyle.Danger)
        );

        await adminChannel.send({ embeds: [adminEmbed], components: [adminRow] });
    });

    // --- [2. หน้าจอรับยศสมาชิก (หน้าบ้าน)] ---
    client.once(Events.ClientReady, async () => {
        const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
        if (!channel) return;

        const messages = await channel.messages.fetch({ limit: 10 });
        const oldMessages = messages.filter(msg => msg.author.id === client.user.id);
        if (oldMessages.size > 0) await channel.bulkDelete(oldMessages).catch(() => null);

        const embed = new EmbedBuilder()
            .setTitle('🛡️ ระบบรับยศเข้าห้องพิเศษ')
            .setColor('#00ff99')
            .setDescription(`กดปุ่มด้านล่างเพื่อรับยศ <@&${ROLE_ID}>\n*(หากหายไปเกิน ${INACTIVE_DAYS} วัน ยศจะถูกถอดอัตโนมัติ)*`)
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('get_role').setLabel('✅ รับ/คืนยศ').setStyle(ButtonStyle.Success)
        );
        await channel.send({ embeds: [embed], components: [row] });
    });

    // --- [3. ระบบจัดการ Interaction (ปุ่ม & เมนู)] ---
    client.on(Events.InteractionCreate, async (interaction) => {
        // --- ส่วนสมาชิกทั่วไป ---
        if (interaction.isButton() && interaction.customId === 'get_role') {
            const role = interaction.guild.roles.cache.get(ROLE_ID);
            if (interaction.member.roles.cache.has(ROLE_ID)) {
                await interaction.member.roles.remove(role);
                return interaction.reply({ content: 'ถอดยศแล้วครับ', ephemeral: true });
            } else {
                await interaction.member.roles.add(role);
                return interaction.reply({ content: 'รับยศแล้วครับ', ephemeral: true });
            }
        }

        // --- ส่วนแอดมิน (Check ID) ---
        if (interaction.user.id !== OWNER_ID) return;

        // ปุ่มเช็กรายชื่อ (แสดง Select Menu)
        if (interaction.isButton() && interaction.customId === 'check_inactive') {
            const users = await VoiceActive.find().sort({ lastActive: 1 }).limit(15);
            if (users.length === 0) return interaction.reply({ content: 'ยังไม่มีข้อมูลในระบบ', ephemeral: true });

            const now = new Date();
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('manage_member_select')
                .setPlaceholder('เลือกสมาชิกที่ต้องการจัดการรายบุคคล...');

            let report = "";
            users.forEach(u => {
                const daysDiff = Math.floor((now - u.lastActive) / (1000 * 60 * 60 * 24));
                const remaining = INACTIVE_DAYS - daysDiff;
                const icon = remaining <= 0 ? '🔴' : (remaining <= 2 ? '⚠️' : '🟢');
                
                report += `${icon} <@${u.userId}>: หายไป \`${daysDiff}\` วัน (เหลือ \`${remaining > 0 ? remaining : 0}\` วัน)\n`;
                
                selectMenu.addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel(`จัดการ: ${u.userId}`)
                        .setDescription(`หายไป ${daysDiff} วัน`)
                        .setValue(u.userId)
                );
            });

            const row = new ActionRowBuilder().addComponents(selectMenu);
            return interaction.reply({ content: `📊 **สถานะสมาชิก:**\n${report}`, components: [row], ephemeral: true });
        }

        // เมื่อเลือกชื่อสมาชิกจากเมนู
        if (interaction.isStringSelectMenu() && interaction.customId === 'manage_member_select') {
            const targetId = interaction.values[0];
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`extend_${targetId}`).setLabel('➕ ต่ออายุ (10 วัน)').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`kickrole_${targetId}`).setLabel('🚫 ถอดยศทันที').setStyle(ButtonStyle.Danger)
            );
            return interaction.reply({ content: `🛠️ จัดการ <@${targetId}>:`, components: [row], ephemeral: true });
        }

        // ประมวลผล ต่ออายุ / ถอดยศรายคน
        if (interaction.isButton()) {
            if (interaction.customId.startsWith('extend_')) {
                const uid = interaction.customId.split('_')[1];
                await VoiceActive.findOneAndUpdate({ userId: uid }, { lastActive: new Date() });
                return interaction.update({ content: `✅ ต่ออายุให้ <@${uid}> แล้ว (นับหนึ่งใหม่)`, components: [] });
            }
            if (interaction.customId.startsWith('kickrole_')) {
                const uid = interaction.customId.split('_')[1];
                const member = await interaction.guild.members.fetch(uid).catch(() => null);
                if (member) await member.roles.remove(member.roles.cache.filter(r => r.name !== '@everyone'));
                return interaction.update({ content: `🚫 ถอดยศของ <@${uid}> เรียบร้อย`, components: [] });
            }
            if (interaction.customId === 'run_cleanup_all') {
                await interaction.reply({ content: '⏳ กำลังกวาดล้างคนหมดเวลา...', ephemeral: true });
                await runCleanupLogic(client);
            }
        }
    });

    // --- [4. บันทึกเวลาเข้าห้องเสียง] ---
    client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
        if (newState.channelId) {
            await VoiceActive.findOneAndUpdate({ userId: newState.member.id }, { lastActive: new Date() }, { upsert: true });
        }
    });

    // ลูปอัตโนมัติทุก 24 ชม.
    setInterval(() => runCleanupLogic(client), 86400000);
}

// ฟังก์ชันกวาดล้าง (Logic หลัก)
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