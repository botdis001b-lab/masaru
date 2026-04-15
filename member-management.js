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
const ROLE_ID = '1356148472851726437'; 
const CHANNEL_ID = '1486030638464237631'; 
const ADMIN_CHANNEL_ID = '1490233799534186627'; 
const OWNER_ID = '550122613087666177'; 
const INACTIVE_DAYS = 10;

const VoiceActive = mongoose.models.VoiceActive || mongoose.model('VoiceActive', new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    lastActive: { type: Date, default: Date.now }
}));

function initMemberManagement(client) {

    // --- [1. แผงควบคุม Admin - หลังบ้าน] ---
    client.once(Events.ClientReady, async () => {
        const adminChannel = await client.channels.fetch(ADMIN_CHANNEL_ID).catch(() => null);
        if (!adminChannel) return;

        const messages = await adminChannel.messages.fetch({ limit: 10 });
        const oldAdminMsgs = messages.filter(m => m.author.id === client.user.id);
        if (oldAdminMsgs.size > 0) await adminChannel.bulkDelete(oldAdminMsgs).catch(() => null);

        const adminEmbed = new EmbedBuilder()
            .setTitle('⚙️ Masaru Ultimate Control')
            .setColor('#ff0000')
            .setThumbnail(client.user.displayAvatarURL())
            .setDescription(
                `### เมนูจัดการสมาชิกสำหรับพี่\n\n` +
                `🔍 **เลือกรายชื่อถอดยศ:** ดึงรายชื่อสมาชิกทุกคนมาให้พี่ "เลือกติ๊ก" เพื่อถอดเอง (เลือกได้สูงสุด 25 คน)\n\n` +
                `🧹 **กวาดล้าง Auto:** ถอดคนที่หายไปเกิน ${INACTIVE_DAYS} วัน ตามฐานข้อมูล\n\n` +
                `💥 **ถอดยศทุกคน (ล้างบาง):** ดึงยศคืนจากสมาชิกทุกคนมียศนี้ทันที`
            )
            .setFooter({ text: 'Masaru Admin Management System' })
            .setTimestamp();

        const adminRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('open_selector').setLabel('🔍 เลือกรายชื่อถอดยศ').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('run_cleanup_now').setLabel('🧹 กวาดล้าง Auto').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('force_remove_all').setLabel('💥 ถอดยศทุกคน (ล้างบาง)').setStyle(ButtonStyle.Danger)
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
            .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
            .setDescription(
                `### ยืนยันตัวตนเพื่อรับสิทธิ์สมาชิก\n` +
                `กดปุ่มด้านล่างเพื่อรับยศ <@&${ROLE_ID}>\n\n` +
                `**เงื่อนไขการรักษายศ:**\n` +
                `• ต้องเข้าห้องเสียงอย่างน้อย 1 ครั้งทุกๆ **${INACTIVE_DAYS} วัน**\n` +
                `• เช็กอันดับเลเวล/โปรไฟล์ ได้ที่ปุ่มด้านล่าง`
            )
            .addFields(
                { name: '👤 สมาชิกทั้งหมด', value: `\`${channel.guild.memberCount}\` คน`, inline: true },
                { name: '⏳ อัปเดตล่าสุด', value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
            )
            .setFooter({ text: 'Masaru Experience System' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('get_role').setLabel('✅ ยืนยันตัวตน / รับยศ').setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setLabel('📊 ดูเลเวล/โปรไฟล์ (Web)')
                .setStyle(ButtonStyle.Link)
                .setURL('https://masaru-dashboard.up.railway.app/profile')
        );

        await channel.send({ embeds: [embed], components: [row] });
    });

    // --- [3. ระบบจัดการ Interaction ทั้งหมด] ---
    client.on(Events.InteractionCreate, async (interaction) => {
        if (interaction.isButton() && interaction.customId === 'get_role') {
            const role = interaction.guild.roles.cache.get(ROLE_ID);
            if (interaction.member.roles.cache.has(ROLE_ID)) {
                await interaction.member.roles.remove(role);
                return interaction.reply({ content: 'ถอดยศออกจากตัวคุณแล้วครับ', ephemeral: true });
            } else {
                await interaction.member.roles.add(role);
                return interaction.reply({ content: 'รับยศเรียบร้อย! ยินดีต้อนรับครับ', ephemeral: true });
            }
        }

        if (interaction.user.id !== OWNER_ID) return;

        // ปุ่มเรียกเมนูเลือกรายชื่อ
        if (interaction.isButton() && interaction.customId === 'open_selector') {
            const userSelect = new UserSelectMenuBuilder()
                .setCustomId('mass_remove_select')
                .setPlaceholder('พิมพ์ชื่อหรือเลือกสมาชิกที่พี่จะถอดยศ...')
                .setMinValues(1)
                .setMaxValues(25);
            const row = new ActionRowBuilder().addComponents(userSelect);
            return interaction.reply({ content: '📌 **กรุณาเลือกรายชื่อสมาชิกที่จะถอดยศ (เลือกได้หลายคน):**', components: [row], ephemeral: true });
        }

        // ประมวลผลเมื่อพี่เลือกชื่อเสร็จ
        if (interaction.isUserSelectMenu() && interaction.customId === 'mass_remove_select') {
            await interaction.deferUpdate();
            const selectedIds = interaction.values;
            let successCount = 0;
            for (const uid of selectedIds) {
                const member = await interaction.guild.members.fetch(uid).catch(() => null);
                if (member && member.roles.cache.has(ROLE_ID) && !member.permissions.has('Administrator')) {
                    await member.roles.remove(ROLE_ID).catch(() => null);
                    successCount++;
                }
            }
            return interaction.followUp({ content: `✅ ถอดยศสมาชิกที่พี่เลือกไปทั้งหมด \`${successCount}\` คนเรียบร้อยครับ!`, ephemeral: true });
        }

        // ปุ่มกวาดล้าง Auto
        if (interaction.isButton() && interaction.customId === 'run_cleanup_now') {
            await interaction.reply({ content: '🧹 กำลังสแกนถอดคนที่หายเกินกำหนด...', ephemeral: true });
            const count = await runCleanupLogic(client);
            return interaction.followUp({ content: `✅ กวาดล้างเสร็จสิ้น! ถอดยศไป \`${count}\` คน`, ephemeral: true });
        }

        // ปุ่มล้างบางทุกคน
        if (interaction.isButton() && interaction.customId === 'force_remove_all') {
            await interaction.reply({ content: '⚠️ กำลังล้างบางยศนี้จากทุกคน...', ephemeral: true });
            const role = interaction.guild.roles.cache.get(ROLE_ID);
            const members = Array.from(role.members.values());
            let count = 0;
            for (const m of members) {
                if (!m.permissions.has('Administrator')) {
                    await m.roles.remove(role).catch(() => null);
                    count++;
                }
            }
            return interaction.followUp({ content: `💥 ดึงยศคืนจากสมาชิกทั้งหมด \`${count}\` คนเสร็จสิ้น!`, ephemeral: true });
        }
    });

    client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
        if (newState.channelId) {
            await VoiceActive.findOneAndUpdate({ userId: newState.member.id }, { lastActive: new Date() }, { upsert: true });
        }
    });
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