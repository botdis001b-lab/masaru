const { 
    Events, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    UserSelectMenuBuilder
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

    // --- [1. Dashboard Admin - ตกแต่งครบ] ---
    client.once(Events.ClientReady, async () => {
        const adminChannel = await client.channels.fetch(ADMIN_CHANNEL_ID).catch(() => null);
        if (!adminChannel) return;

        const messages = await adminChannel.messages.fetch({ limit: 10 });
        const oldAdminMsgs = messages.filter(m => m.author.id === client.user.id);
        if (oldAdminMsgs.size > 0) await adminChannel.bulkDelete(oldAdminMsgs).catch(() => null);

        const adminEmbed = new EmbedBuilder()
            .setTitle('⚙️ แผงควบคุมจัดการสมาชิก (Ultimate Control)')
            .setColor('#ff0000')
            .setThumbnail(client.user.displayAvatarURL())
            .setDescription(
                `### ยินดีต้อนรับกลับครับพี่!\n` +
                `ระบบนี้ช่วยให้พี่ควบคุมสมาชิกทุกคนได้ดั่งใจ\n\n` +
                `**เมนูสั่งการ:**\n` +
                `> 🔍 **เลือกรายชื่อถอดยศ:** ดึงชื่อทุกคนมาให้พี่จิ้มเลือกถอดเอง\n` +
                `> 🧹 **กวาดล้าง Auto:** ถอดคนที่หายเกิน ${INACTIVE_DAYS} วันอัตโนมัติ\n` +
                `> 💥 **ล้างบางยศ:** ดึงยศคืนจากทุกคนในเซิร์ฟเวอร์ทันที`
            )
            .setFooter({ text: 'Masaru Admin Console' })
            .setTimestamp();

        const adminRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('open_selector').setLabel('🔍 เลือกรายชื่อถอดยศ').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('run_cleanup_now').setLabel('🧹 กวาดล้าง Auto').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('force_remove_all').setLabel('💥 ล้างบางยศนี้').setStyle(ButtonStyle.Danger)
        );

        await adminChannel.send({ embeds: [adminEmbed], components: [adminRow] });
    });

    // --- [2. หน้าจอรับยศ (หน้าบ้าน) - ตกแต่งเต็มรูปแบบ] ---
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
                `### ยืนยันตัวตนเพื่อรับสิทธิ์สมาชิก\n` +
                `กดปุ่มด้านล่างเพื่อรับยศ <@&${ROLE_ID}>\n\n` +
                `**เงื่อนไขการรักษายศ:**\n` +
                `• ต้องมีการเคลื่อนไหวในห้องเสียงอย่างน้อย 1 ครั้งทุกๆ **${INACTIVE_DAYS} วัน**\n` +
                `• หากโดนถอดยศ สามารถกลับมากดรับใหม่ได้ที่นี่เสมอ`
            )
            .addFields(
                { name: '📊 สถานะเซิร์ฟเวอร์', value: `สมาชิกทั้งหมด: \`${channel.guild.memberCount}\` คน`, inline: true },
                { name: '🕒 เวลาอัปเดต', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
            )
            .setFooter({ text: 'Masaru Automation System' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('get_role').setLabel('✅ ยืนยันตัวตน / รับยศ').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setLabel('📊 ดูเลเวล (Web)').setStyle(ButtonStyle.Link).setURL('https://masaru-dashboard.up.railway.app/profile')
        );

        await channel.send({ embeds: [embed], components: [row] });
    });

    // --- [3. ระบบ Interaction] ---
    client.on(Events.InteractionCreate, async (interaction) => {
        if (interaction.isButton() && interaction.customId === 'get_role') {
            const role = interaction.guild.roles.cache.get(ROLE_ID);
            if (interaction.member.roles.cache.has(ROLE_ID)) {
                await interaction.member.roles.remove(role);
                return interaction.reply({ content: 'คืนยศเรียบร้อยแล้วครับ', ephemeral: true });
            } else {
                await interaction.member.roles.add(role);
                return interaction.reply({ content: 'ยินดีต้อนรับ! คุณได้รับยศเรียบร้อยแล้ว', ephemeral: true });
            }
        }

        if (interaction.user.id !== OWNER_ID) return;

        // เมนูเลือกรายชื่อ
        if (interaction.isButton() && interaction.customId === 'open_selector') {
            const userSelect = new UserSelectMenuBuilder()
                .setCustomId('mass_kick_select')
                .setPlaceholder('จิ้มชื่อสมาชิกที่พี่ต้องการถอดยศ...')
                .setMinValues(1)
                .setMaxValues(25);

            const row = new ActionRowBuilder().addComponents(userSelect);
            return interaction.reply({ content: '📌 **กรุณาเลือกชื่อคนที่พี่จะถอดยศครับ (เลือกได้หลายคน):**', components: [row], ephemeral: true });
        }

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
            return interaction.followUp({ content: `✅ เรียบร้อยครับพี่! ถอดยศจากคนที่เลือกไป \`${count}\` คน`, ephemeral: true });
        }

        // ปุ่มกวาดล้าง Auto
        if (interaction.isButton() && interaction.customId === 'run_cleanup_now') {
            await interaction.reply({ content: '🧹 กำลังสแกนถอดคนที่หายไปเกินกำหนด...', ephemeral: true });
            const count = await runCleanupLogic(client);
            return interaction.followUp({ content: `✅ กวาดล้างเสร็จสิ้น! ถอดไปทั้งหมด \`${count}\` คน`, ephemeral: true });
        }

        // ปุ่มล้างบางทั้งหมด
        if (interaction.isButton() && interaction.customId === 'force_remove_all') {
            await interaction.reply({ content: '⚠️ กำลังดึงยศคืนจากทุกคนในเซิร์ฟเวอร์...', ephemeral: true });
            const role = interaction.guild.roles.cache.get(ROLE_ID);
            const members = Array.from(role.members.values());
            let count = 0;
            for (const m of members) {
                if (!m.permissions.has('Administrator')) {
                    await m.roles.remove(role).catch(() => null);
                    count++;
                }
            }
            return interaction.followUp({ content: `💥 ล้างบางเสร็จ! ดึงยศคืนรวม \`${count}\` คน`, ephemeral: true });
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