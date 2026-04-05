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
const CHANNEL_ID = '1486030638464237631'; // ห้องรับยศ (หน้าบ้าน)
const ADMIN_CHANNEL_ID = '1490233799534186627'; // ห้องควบคุม (หลังบ้าน)
const OWNER_ID = '550122613087666177'; // ID ของพี่ (Admin)

// Schema สำหรับเก็บเวลาเคลื่อนไหว
const VoiceActive = mongoose.models.VoiceActive || mongoose.model('VoiceActive', new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    lastActive: { type: Date, default: Date.now }
}));

function initMemberManagement(client) {

    // --- [1. ระบบหน้าจอ Dashboard สำหรับ Admin] ---
    client.once(Events.ClientReady, async () => {
        const adminChannel = await client.channels.fetch(ADMIN_CHANNEL_ID).catch(() => null);
        if (!adminChannel) return;

        const messages = await adminChannel.messages.fetch({ limit: 10 });
        const oldAdminMsgs = messages.filter(m => m.author.id === client.user.id);
        if (oldAdminMsgs.size > 0) await adminChannel.bulkDelete(oldAdminMsgs).catch(() => null);

        const adminEmbed = new EmbedBuilder()
            .setTitle('⚙️ แผงควบคุมระบบสมาชิก (Admin Only)')
            .setColor('#ff0000')
            .setThumbnail(client.user.displayAvatarURL())
            .setDescription(
                `**การตั้งค่าปัจจุบัน:**\n` +
                `• เกณฑ์ถอดยศ: \`${INACTIVE_DAYS}\` วัน\n` +
                `• ยศที่ดูแล: <@&${ROLE_ID}>\n\n` +
                `**เมนูจัดการ:**\n` +
                `🔍 **เช็กรายชื่อ:** ดูสถานะรายคน/ต่ออายุ/ถอดยศมือถือ\n` +
                `🧹 **สั่งถอดทั้งหมด:** กวาดล้างคนที่หายไปเกิน ${INACTIVE_DAYS} วันทันที`
            )
            .setFooter({ text: 'ระบบควบคุมหลังบ้าน Masaru' })
            .setTimestamp();

        const adminRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('check_inactive').setLabel('🔍 เช็กรายชื่อคนหาย').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('run_cleanup_all').setLabel('🧹 สั่งถอดทั้งหมด').setStyle(ButtonStyle.Danger)
        );

        await adminChannel.send({ embeds: [adminEmbed], components: [adminRow] });
    });

    // --- [2. หน้าจอรับยศสมาชิกแบบ Premium (หน้าบ้าน)] ---
    client.once(Events.ClientReady, async () => {
        const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
        if (!channel) return;

        const messages = await channel.messages.fetch({ limit: 10 });
        const oldMessages = messages.filter(msg => msg.author.id === client.user.id);
        if (oldMessages.size > 0) await channel.bulkDelete(oldMessages).catch(() => null);

        const embed = new EmbedBuilder()
            .setTitle('🛡️ MASARU MEMBER ACCESS')
            .setColor('#2f3136')
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
            .setDescription(
                `### ยินดีต้อนรับสู่ระบบยืนยันตัวตน!\n` +
                `กรุณากดปุ่มด้านล่างเพื่อรับยศ <@&${ROLE_ID}> สำหรับเข้าใช้งานห้องพิเศษ\n\n` +
                `**📜 กฎระเบียบ:**\n` +
                `> 1. ต้องเข้าห้องเสียงอย่างน้อย 1 ครั้งใน **${INACTIVE_DAYS} วัน**\n` +
                `> 2. หากระบบถอดยศอัตโนมัติ สามารถกลับมากดรับใหม่ได้ที่นี่เสมอ\n\n` +
                `*เช็กสถานะเลเวลและแต้มของคุณได้ที่หน้าเว็บ Dashboard*`
            )
            .addFields(
                { name: '👤 สมาชิกในเซิร์ฟ', value: `\`${channel.guild.memberCount}\` คน`, inline: true },
                { name: '🕒 อัปเดตล่าสุด', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
            )
            .setFooter({ text: 'Masaru Automation System', iconURL: client.user.displayAvatarURL() });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('get_role').setLabel('✅ ยืนยันตัวตน / รับยศ').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setLabel('📊 ดูโปรไฟล์ (Web)').setStyle(ButtonStyle.Link).setURL('https://masaru-dashboard.up.railway.app/profile') //
        );

        await channel.send({ embeds: [embed], components: [row] });
    });

    // --- [3. ระบบจัดการ Interaction (ปุ่ม & เมนู)] ---
    client.on(Events.InteractionCreate, async (interaction) => {
        if (interaction.isButton() && interaction.customId === 'get_role') {
            const role = interaction.guild.roles.cache.get(ROLE_ID);
            if (interaction.member.roles.cache.has(ROLE_ID)) {
                await interaction.member.roles.remove(role);
                return interaction.reply({ content: 'ถอดยศเรียบร้อยครับ', ephemeral: true });
            } else {
                await interaction.member.roles.add(role);
                return interaction.reply({ content: 'รับยศเรียบร้อย! ยินดีต้อนรับครับ', ephemeral: true });
            }
        }

        if (interaction.user.id !== OWNER_ID) return; // เฉพาะ Admin

        if (interaction.isButton() && interaction.customId === 'check_inactive') {
            const users = await VoiceActive.find().sort({ lastActive: 1 }).limit(15);
            if (users.length === 0) return interaction.reply({ content: 'ยังไม่มีข้อมูลการเคลื่อนไหว', ephemeral: true });

            const now = new Date();
            const selectMenu = new StringSelectMenuBuilder().setCustomId('manage_member_select').setPlaceholder('เลือกสมาชิกเพื่อจัดการรายบุคคล...');

            let report = "";
            users.forEach(u => {
                const daysDiff = Math.floor((now - u.lastActive) / (1000 * 60 * 60 * 24));
                const remaining = INACTIVE_DAYS - daysDiff;
                const icon = remaining <= 0 ? '🔴' : (remaining <= 2 ? '⚠️' : '🟢');
                report += `${icon} <@${u.userId}>: หายไป \`${daysDiff}\` วัน (เหลือ \`${remaining > 0 ? remaining : 0}\` วัน)\n`;
                selectMenu.addOptions(new StringSelectMenuOptionBuilder().setLabel(`จัดการ ID: ${u.userId}`).setValue(u.userId));
            });

            const row = new ActionRowBuilder().addComponents(selectMenu);
            return interaction.reply({ content: `📊 **สถานะสมาชิก:**\n${report}`, components: [row], ephemeral: true });
        }

        if (interaction.isStringSelectMenu() && interaction.customId === 'manage_member_select') {
            const tid = interaction.values[0];
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`ext_${tid}`).setLabel('➕ ต่ออายุ (10 วัน)').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`kick_${tid}`).setLabel('🚫 ถอดยศทันที').setStyle(ButtonStyle.Danger)
            );
            return interaction.reply({ content: `🛠️ จัดการสมาชิก <@${tid}>:`, components: [row], ephemeral: true });
        }

        if (interaction.isButton()) {
            if (interaction.customId.startsWith('ext_')) {
                const uid = interaction.customId.split('_')[1];
                await VoiceActive.findOneAndUpdate({ userId: uid }, { lastActive: new Date() }); //
                return interaction.update({ content: `✅ ต่ออายุให้ <@${uid}> แล้ว`, components: [] });
            }
            if (interaction.customId.startsWith('kick_')) {
                const uid = interaction.customId.split('_')[1];
                const mem = await interaction.guild.members.fetch(uid).catch(() => null);
                if (mem) await mem.roles.remove(mem.roles.cache.filter(r => r.name !== '@everyone')); //
                return interaction.update({ content: `🚫 ถอดยศ <@${uid}> สำเร็จ`, components: [] });
            }
            if (interaction.customId === 'run_cleanup_all') {
                await interaction.reply({ content: '🧹 กำลังเริ่มระบบกวาดล้าง...', ephemeral: true });
                await runCleanupLogic(client); //
            }
        }
    });

    // --- [4. ระบบบันทึกเสียง & ลูปอัตโนมัติ] ---
    client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
        if (newState.channelId) {
            await VoiceActive.findOneAndUpdate({ userId: newState.member.id }, { lastActive: new Date() }, { upsert: true });
        }
    });

    setInterval(() => runCleanupLogic(client), 86400000); // รันทุก 24 ชม.
}

async function runCleanupLogic(client) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - INACTIVE_DAYS);
    try {
        const inactive = await VoiceActive.find({ lastActive: { $lt: cutoff } });
        const guild = client.guilds.cache.first();
        for (const data of inactive) {
            const member = await guild?.members.fetch(data.userId).catch(() => null);
            if (member && !member.permissions.has('Administrator')) { //
                const roles = member.roles.cache.filter(r => r.name !== '@everyone');
                await member.roles.remove(roles).catch(() => null);
            }
        }
    } catch (e) { console.error(e); }
}

module.exports = { initMemberManagement };