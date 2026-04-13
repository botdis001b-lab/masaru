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
            .setThumbnail(client.user.displayAvatarURL())
            .setDescription(
                `**โหมดจัดการขั้นสูง:**\n` +
                `• เกณฑ์ถอดยศ: \`${INACTIVE_DAYS}\` วัน\n` +
                `• ยศที่ดูแล: <@&${ROLE_ID}>\n\n` +
                `**คำอธิบายปุ่ม:**\n` +
                `🔍 **ดูรายชื่อสมาชิก:** เช็กสถานะ 52 คน (เปลี่ยนหน้าได้)\n` +
                `🧹 **กวาดล้าง (Auto):** ถอดเฉพาะคนที่หมดเวลาในฐานข้อมูล\n` +
                `💥 **ถอดยศทั้งหมด:** ดึงยศคืนจากทุกคนทันที (ล้างบางคนไม่ออน)`
            )
            .setFooter({ text: 'Masaru Ultimate Control System' })
            .setTimestamp();

        const adminRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('check_all_0').setLabel('🔍 ดูรายชื่อ').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('run_cleanup_all').setLabel('🧹 กวาดล้าง (Auto)').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('force_remove_all').setLabel('💥 ถอดยศทั้งหมด').setStyle(ButtonStyle.Danger)
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
                `### ระบบยืนยันตัวตนสมาชิก\n` +
                `กดปุ่มด้านล่างเพื่อรับยศ <@&${ROLE_ID}>\n\n` +
                `**กฎการรักษายศ:**\n` +
                `> • ต้องเข้าห้องเสียงอย่างน้อย 1 ครั้งใน **${INACTIVE_DAYS} วัน**\n` +
                `> • หากยศหาย สามารถกดรับใหม่ได้ที่นี่เสมอ\n\n` +
                `*เช็กสถานะเลเวลของคุณได้ที่หน้าเว็บ Dashboard*`
            )
            .addFields(
                { name: '👤 สมาชิกในเซิร์ฟ', value: `\`${channel.guild.memberCount}\` คน`, inline: true },
                { name: '🕒 อัปเดตล่าสุด', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
            )
            .setFooter({ text: 'Masaru Automation System' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('get_role').setLabel('✅ ยืนยันตัวตน / รับยศ').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setLabel('📊 ดูโปรไฟล์ (Web)').setStyle(ButtonStyle.Link).setURL('https://masaru-dashboard.up.railway.app/profile') //
        );

        await channel.send({ embeds: [embed], components: [row] });
    });

    // --- [3. ระบบจัดการ Interaction ทั้งหมด] ---
    client.on(Events.InteractionCreate, async (interaction) => {
        // ส่วนสมาชิกทั่วไป: รับยศ
        if (interaction.isButton() && interaction.customId === 'get_role') {
            const role = interaction.guild.roles.cache.get(ROLE_ID);
            if (interaction.member.roles.cache.has(ROLE_ID)) {
                await interaction.member.roles.remove(role);
                return interaction.reply({ content: 'คืนยศเรียบร้อยแล้วครับ', ephemeral: true });
            } else {
                await interaction.member.roles.add(role);
                return interaction.reply({ content: 'รับยศเรียบร้อย! ยินดีต้อนรับครับ', ephemeral: true });
            }
        }

        // ส่วน Admin Only
        if (interaction.user.id !== OWNER_ID) return;

        // 3.1 ระบบดูรายชื่อทุกคนที่มียศ (Pagination)
        if (interaction.isButton() && interaction.customId.startsWith('check_all_')) {
            const page = parseInt(interaction.customId.split('_')[2]);
            const role = interaction.guild.roles.cache.get(ROLE_ID);
            if (!role) return interaction.reply({ content: 'ไม่พบยศในเซิร์ฟเวอร์', ephemeral: true });

            const membersWithRole = Array.from(role.members.values());
            const dbUsers = await VoiceActive.find();
            
            const PAGE_SIZE = 15;
            const totalPages = Math.ceil(membersWithRole.length / PAGE_SIZE);
            const start = page * PAGE_SIZE;
            const currentMembers = membersWithRole.slice(start, start + PAGE_SIZE);

            let report = `📊 **รายชื่อสมาชิกที่มีอยู่ (${page + 1}/${totalPages})**\n`;
            const selectMenu = new StringSelectMenuBuilder().setCustomId('manage_select').setPlaceholder('เลือกคนที่จะจัดการรายบุคคล...');

            currentMembers.forEach(member => {
                const dbData = dbUsers.find(u => u.userId === member.id);
                let statusInfo = "";
                let icon = '⚪';

                if (dbData) {
                    const diff = Math.floor((new Date() - dbData.lastActive) / 86400000);
                    const remain = INACTIVE_DAYS - diff;
                    icon = remain <= 0 ? '🔴' : '🟢';
                    statusInfo = `หายไป \`${diff}\` วัน (เหลือ \`${remain > 0 ? remain : 0}\` ว)`;
                } else {
                    statusInfo = `*ยังไม่มีประวัติเข้าห้องเสียง*`;
                }
                
                report += `${icon} <@${member.id}>: ${statusInfo}\n`;
                selectMenu.addOptions(new StringSelectMenuOptionBuilder().setLabel(`จัดการ: ${member.user.username}`).setValue(member.id));
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

        // 3.2 ระบบล้างบางถอดยศทั้งหมด
        if (interaction.isButton() && interaction.customId === 'force_remove_all') {
            await interaction.reply({ content: '⚠️ กำลังถอดยศคืนจากทุกคนที่ครอบครองยศนี้...', ephemeral: true });
            const role = interaction.guild.roles.cache.get(ROLE_ID);
            const members = Array.from(role.members.values());
            let count = 0;

            for (const member of members) {
                if (member.permissions.has('Administrator')) continue;
                await member.roles.remove(role).catch(() => null);
                count++;
            }
            return interaction.followUp({ content: `✅ ดึงยศคืนจากสมาชิกทั้งหมด \`${count}\` คนเรียบร้อย!`, ephemeral: true });
        }

        // 3.3 ระบบจัดการรายคน
        if (interaction.isStringSelectMenu() && interaction.customId === 'manage_select') {
            const tid = interaction.values[0];
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`ext_${tid}`).setLabel('➕ ต่ออายุ (10 วัน)').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`kick_${tid}`).setLabel('🚫 ถอดยศทันที').setStyle(ButtonStyle.Danger)
            );
            return interaction.reply({ content: `🛠️ จัดการสมาชิก <@${tid}>:`, components: [row], ephemeral: true });
        }

        // 3.4 ประมวลผลปุ่ม ต่ออายุ/ถอดยศ/กวาดล้าง
        if (interaction.isButton()) {
            const [action, uid] = interaction.customId.split('_');
            if (action === 'ext') {
                await VoiceActive.findOneAndUpdate({ userId: uid }, { lastActive: new Date() }, { upsert: true });
                return interaction.update({ content: `✅ ต่ออายุให้ <@${uid}> แล้ว`, components: [] });
            }
            if (action === 'kick') {
                const mem = await interaction.guild.members.fetch(uid).catch(() => null);
                if (mem) await mem.roles.remove(mem.roles.cache.filter(r => r.name !== '@everyone'));
                return interaction.update({ content: `🚫 ถอดยศ <@${uid}> เรียบร้อย`, components: [] });
            }
            if (interaction.customId === 'run_cleanup_all') {
                await interaction.reply({ content: '🧹 กำลังรันระบบกวาดล้างตามฐานข้อมูล...', ephemeral: true });
                await runCleanupLogic(client);
            }
        }
    });

    // --- [4. ระบบบันทึกเสียง & ลูปอัตโนมัติ] ---
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