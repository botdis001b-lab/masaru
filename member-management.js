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
const ROLE_ID = '1356148472851726437'; 
const CHANNEL_ID = '1486030638464237631'; 
const ADMIN_CHANNEL_ID = '1490233799534186627'; 
const OWNER_ID = '550122613087666177'; 

const VoiceActive = mongoose.models.VoiceActive || mongoose.model('VoiceActive', new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    lastActive: { type: Date, default: Date.now }
}));

function initMemberManagement(client) {

    // --- [1. หน้าจอ Dashboard Admin] ---
    client.once(Events.ClientReady, async () => {
        const adminChannel = await client.channels.fetch(ADMIN_CHANNEL_ID).catch(() => null);
        if (!adminChannel) return;

        const messages = await adminChannel.messages.fetch({ limit: 10 });
        const oldAdminMsgs = messages.filter(m => m.author.id === client.user.id);
        if (oldAdminMsgs.size > 0) await adminChannel.bulkDelete(oldAdminMsgs).catch(() => null);

        const adminEmbed = new EmbedBuilder()
            .setTitle('⚙️ แผงควบคุมการจัดการยศ (Admin)')
            .setColor('#ff0000')
            .setDescription(
                `**เลือกรูปแบบการถอดยศ:**\n` +
                `🔍 **ดูรายชื่อ:** เช็กสถานะคนมียศ 52 คน และจัดการรายบุคคล\n` +
                `🧹 **ถอดยศคนในระบบ:** ดึงยศคืนจากทุกคนที่บอทเคยบันทึกไว้ (ไม่สนวันหมดอายุ)\n` +
                `💥 **ถอดยศทุกคน (ล้างบาง):** ดึงยศคืนจากสมาชิกทุกคนในเซิร์ฟเวอร์ที่มียศนี้`
            )
            .setTimestamp();

        const adminRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('check_all_0').setLabel('🔍 ดูรายชื่อสมาชิก').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('remove_all_db').setLabel('🧹 ถอดยศคนในระบบ').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('force_remove_all').setLabel('💥 ถอดยศทุกคน (ล้างบาง)').setStyle(ButtonStyle.Danger)
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
            .setTitle('🛡️ MASARU MEMBER ACCESS')
            .setColor('#2f3136')
            .setDescription(`คลิกที่ปุ่มเพื่อรับยศ <@&${ROLE_ID}>\n*(โปรดเข้าห้องเสียงสม่ำเสมอเพื่อรักษายศ)*`);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('get_role').setLabel('✅ ยืนยันตัวตน / รับยศ').setStyle(ButtonStyle.Success)
        );
        await channel.send({ embeds: [embed], components: [row] });
    });

    // --- [3. ระบบจัดการ Interaction] ---
    client.on(Events.InteractionCreate, async (interaction) => {
        if (interaction.isButton() && interaction.customId === 'get_role') {
            const role = interaction.guild.roles.cache.get(ROLE_ID);
            if (interaction.member.roles.cache.has(ROLE_ID)) {
                await interaction.member.roles.remove(role);
                return interaction.reply({ content: 'ถอดยศออกจากตัวคุณแล้ว', ephemeral: true });
            } else {
                await interaction.member.roles.add(role);
                return interaction.reply({ content: 'รับยศเรียบร้อย ยินดีต้อนรับครับ', ephemeral: true });
            }
        }

        if (interaction.user.id !== OWNER_ID) return;

        // 3.1 ดูรายชื่อและจัดการรายคน
        if (interaction.isButton() && interaction.customId.startsWith('check_all_')) {
            const page = parseInt(interaction.customId.split('_')[2]);
            const role = interaction.guild.roles.cache.get(ROLE_ID);
            if (!role) return interaction.reply({ content: 'ไม่พบยศในระบบ', ephemeral: true });

            const membersWithRole = Array.from(role.members.values());
            const dbUsers = await VoiceActive.find();
            
            const PAGE_SIZE = 15;
            const totalPages = Math.ceil(membersWithRole.length / PAGE_SIZE);
            const start = page * PAGE_SIZE;
            const currentMembers = membersWithRole.slice(start, start + PAGE_SIZE);

            let report = `📊 **รายชื่อสมาชิกที่มียศ (${page + 1}/${totalPages})**\n`;
            const selectMenu = new StringSelectMenuBuilder().setCustomId('manage_select').setPlaceholder('เลือกสมาชิกเพื่อถอดยศ/ต่ออายุ...');

            currentMembers.forEach(member => {
                const dbData = dbUsers.find(u => u.userId === member.id);
                let status = "⚪ ไม่มีประวัติเข้าห้องเสียง";
                if (dbData) {
                    const diff = Math.floor((new Date() - dbData.lastActive) / 86400000);
                    status = `${diff >= INACTIVE_DAYS ? '🔴' : '🟢'} หายไป ${diff} วัน`;
                }
                report += `<@${member.id}>: ${status}\n`;
                selectMenu.addOptions(new StringSelectMenuOptionBuilder().setLabel(`จัดการ: ${member.user.username}`).setValue(member.id));
            });

            const navRow = new ActionRowBuilder();
            if (page > 0) navRow.addComponents(new ButtonBuilder().setCustomId(`check_all_${page - 1}`).setLabel('⬅️').setStyle(ButtonStyle.Secondary));
            if (page < totalPages - 1) navRow.addComponents(new ButtonBuilder().setCustomId(`check_all_${page + 1}`).setLabel('➡️').setStyle(ButtonStyle.Secondary));

            const components = [new ActionRowBuilder().addComponents(selectMenu)];
            if (navRow.components.length > 0) components.push(navRow);
            await interaction.reply({ content: report, components, ephemeral: true });
        }

        // 3.2 ปุ่มถอดยศคนในระบบ (ดึงคืนจากทุกคนที่บอทเคยบันทึก)
        if (interaction.isButton() && interaction.customId === 'remove_all_db') {
            await interaction.reply({ content: '🧹 กำลังทยอยถอดยศสมาชิกจากฐานข้อมูล...', ephemeral: true });
            const allDbUsers = await VoiceActive.find();
            let count = 0;
            for (const user of allDbUsers) {
                const member = await interaction.guild.members.fetch(user.userId).catch(() => null);
                if (member && member.roles.cache.has(ROLE_ID) && !member.permissions.has('Administrator')) {
                    await member.roles.remove(ROLE_ID).catch(() => null);
                    count++;
                }
            }
            return interaction.followUp({ content: `✅ เรียบร้อย! ถอดยศคนในระบบไปทั้งหมด \`${count}\` คน`, ephemeral: true });
        }

        // 3.3 ปุ่มถอดยศทุกคน (ล้างบาง)
        if (interaction.isButton() && interaction.customId === 'force_remove_all') {
            await interaction.reply({ content: '⚠️ กำลังล้างบางยศนี้จากทุกคนในเซิร์ฟเวอร์...', ephemeral: true });
            const role = interaction.guild.roles.cache.get(ROLE_ID);
            const members = Array.from(role.members.values());
            let count = 0;
            for (const m of members) {
                if (!m.permissions.has('Administrator')) {
                    await m.roles.remove(role).catch(() => null);
                    count++;
                }
            }
            return interaction.followUp({ content: `💥 ถอดยศเสร็จสิ้น! ดึงยศคืนจากสมาชิกทั้งหมด \`${count}\` คน`, ephemeral: true });
        }

        // 3.4 Interaction จัดการรายคน
        if (interaction.isStringSelectMenu() && interaction.customId === 'manage_select') {
            const tid = interaction.values[0];
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`ext_${tid}`).setLabel('➕ ต่ออายุ (10 วัน)').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`kick_${tid}`).setLabel('🚫 ถอดยศทันที').setStyle(ButtonStyle.Danger)
            );
            return interaction.reply({ content: `🛠️ จัดการสมาชิก <@${tid}>:`, components: [row], ephemeral: true });
        }

        if (interaction.isButton()) {
            const [action, uid] = interaction.customId.split('_');
            if (action === 'ext') {
                await VoiceActive.findOneAndUpdate({ userId: uid }, { lastActive: new Date() }, { upsert: true });
                return interaction.update({ content: `✅ ต่ออายุสมาชิก <@${uid}> แล้ว`, components: [] });
            }
            if (action === 'kick') {
                const mem = await interaction.guild.members.fetch(uid).catch(() => null);
                if (mem) await mem.roles.remove(ROLE_ID).catch(() => null);
                return interaction.update({ content: `🚫 ถอดยศ <@${uid}> เรียบร้อย`, components: [] });
            }
        }
    });

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
            if (member && member.roles.cache.has(ROLE_ID) && !member.permissions.has('Administrator')) {
                await member.roles.remove(ROLE_ID).catch(() => null);
            }
        }
    } catch (e) { console.error(e); }
}

module.exports = { initMemberManagement };