const { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');

// --- [ตั้งค่าระบบ] ---
const INACTIVE_DAYS = 10; 
const ROLE_ID = '1356148472851726437'; // ยศที่ควบคุม
const CHANNEL_ID = '1486030638464237631'; // ห้องรับยศ (หน้าบ้าน)
const ADMIN_CHANNEL_ID = '1490233799534186627'; // ห้องควบคุม (หลังบ้าน)
const OWNER_ID = '550122613087666177'; // ID ของพี่ที่มีสิทธิ์กดปุ่มควบคุม

// Schema สำหรับเก็บเวลาเข้าห้องเสียงล่าสุด
const VoiceActive = mongoose.models.VoiceActive || mongoose.model('VoiceActive', new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    lastActive: { type: Date, default: Date.now }
}));

function initMemberManagement(client) {
    
    // --- [1. ระบบหน้าจอ Dashboard สำหรับ Admin] ---
    client.once(Events.ClientReady, async () => {
        const adminChannel = await client.channels.fetch(ADMIN_CHANNEL_ID).catch(() => null);
        if (!adminChannel) return;

        // ล้างข้อความเก่าในห้องแอดมินเพื่อให้หน้าจอสะอาด
        const messages = await adminChannel.messages.fetch({ limit: 10 });
        const oldAdminMsgs = messages.filter(m => m.author.id === client.user.id);
        if (oldAdminMsgs.size > 0) await adminChannel.bulkDelete(oldAdminMsgs).catch(() => null);

        const adminEmbed = new EmbedBuilder()
            .setTitle('⚙️ แผงควบคุมระบบจัดการสมาชิก (Admin Only)')
            .setColor('#ff0000')
            .setThumbnail(client.user.displayAvatarURL())
            .setDescription(
                `**สถานะการตั้งค่า:**\n` +
                `• เกณฑ์การถอดยศ: \`${INACTIVE_DAYS}\` วัน\n` +
                `• ยศที่ตรวจสอบ: <@&${ROLE_ID}>\n\n` +
                `**คำอธิบายปุ่ม:**\n` +
                `🔍 **เช็กรายชื่อ:** ดูว่าใครหายไปกี่วัน และเหลืออีกกี่วันจะโดนถอด\n` +
                `🧹 **สั่งถอดทันที:** บังคับให้ระบบตรวจสอบและถอดยศเดี๋ยวนี้`
            )
            .setFooter({ text: 'ระบบควบคุมความปลอดภัย Masaru' })
            .setTimestamp();

        const adminRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('check_inactive').setLabel('🔍 เช็กรายชื่อคนหาย').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('run_cleanup').setLabel('🧹 สั่งถอดทันที').setStyle(ButtonStyle.Danger)
        );

        await adminChannel.send({ embeds: [adminEmbed], components: [adminRow] });
        console.log(`[Admin] หน้าจอควบคุมในห้อง ${ADMIN_CHANNEL_ID} พร้อมใช้งาน`);
    });

    // --- [2. ระบบรับยศหน้าบ้าน (Embed เดิม)] ---
    client.once(Events.ClientReady, async () => {
        const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
        if (!channel) return;

        const messages = await channel.messages.fetch({ limit: 10 });
        const oldMessages = messages.filter(msg => msg.author.id === client.user.id);
        if (oldMessages.size > 0) await channel.bulkDelete(oldMessages).catch(() => null);

        const embed = new EmbedBuilder()
            .setTitle('🛡️ ระบบรับยศเข้าห้องพิเศษ')
            .setColor('#00ff99')
            .setDescription(
                `กดปุ่มด้านล่างเพื่อรับยศ <@&${ROLE_ID}> ครับ\n\n` +
                `**⚠️ กฎการรักษาความเคลื่อนไหว:**\n` +
                `• หากไม่เข้าห้องเสียงเกิน **${INACTIVE_DAYS} วัน** จะถูกถอดยศอัตโนมัติ`
            )
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('get_role').setLabel('✅ กดรับยศ / คืนยศ').setStyle(ButtonStyle.Success)
        );
        await channel.send({ embeds: [embed], components: [row] });
    });

    // --- [3. จัดการการกดปุ่มทั้งหมด] ---
    client.on(Events.InteractionCreate, async (interaction) => {
        if (!interaction.isButton()) return;

        // ส่วนของสมาชิกทั่วไป: รับยศ
        if (interaction.customId === 'get_role') {
            const role = interaction.guild.roles.cache.get(ROLE_ID);
            if (interaction.member.roles.cache.has(ROLE_ID)) {
                await interaction.member.roles.remove(role);
                return interaction.reply({ content: 'ถอดยศเรียบร้อยครับ', ephemeral: true });
            } else {
                await interaction.member.roles.add(role);
                return interaction.reply({ content: 'รับยศเรียบร้อยครับ', ephemeral: true });
            }
        }

        // ส่วนของแอดมิน: เช็กรายชื่อและสั่งถอด (เฉพาะพี่เท่านั้น)
        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({ content: '❌ คุณไม่มีสิทธิ์ใช้งานปุ่มควบคุมนี้', ephemeral: true });
        }

        if (interaction.customId === 'check_inactive') {
            const users = await VoiceActive.find().sort({ lastActive: 1 });
            if (users.length === 0) return interaction.reply({ content: 'ยังไม่มีข้อมูลการเข้าห้องเสียงในระบบ', ephemeral: true });

            const now = new Date();
            let report = users.map(u => {
                const daysDiff = Math.floor((now - u.lastActive) / (1000 * 60 * 60 * 24));
                const remaining = INACTIVE_DAYS - daysDiff;
                const statusIcon = remaining <= 0 ? '🔴' : (remaining <= 2 ? '⚠️' : '🟢');
                return `${statusIcon} <@${u.userId}>: หายไป \`${daysDiff}\` วัน (เหลือ \`${remaining > 0 ? remaining : 0}\` วัน)`;
            }).join('\n');

            interaction.reply({ content: `📊 **สถานะสมาชิกที่บันทึกไว้:**\n${report}`, ephemeral: true });
        }

        if (interaction.customId === 'run_cleanup') {
            await interaction.reply({ content: '⏳ เริ่มกระบวนการตรวจสอบและถอดยศ...', ephemeral: true });
            await runCleanupLogic(client); // เรียกฟังก์ชันถอด
        }
    });

    // --- [4. ระบบบันทึกเวลาเข้าห้องเสียง] ---
    client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
        if (newState.channelId) {
            await VoiceActive.findOneAndUpdate(
                { userId: newState.member.id },
                { lastActive: new Date() },
                { upsert: true }
            );
        }
    });

    // --- [5. ลูปตรวจสอบอัตโนมัติทุก 24 ชม.] ---
    setInterval(() => runCleanupLogic(client), 1000 * 60 * 60 * 24);
}

// ฟังก์ชันสำหรับสั่งถอดยศ (แยกออกมาเพื่อให้ปุ่มกดเรียกใช้ได้ด้วย)
async function runCleanupLogic(client) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - INACTIVE_DAYS);
    
    try {
        const inactiveUsers = await VoiceActive.find({ lastActive: { $lt: cutoff } });
        for (const data of inactiveUsers) {
            const guild = client.guilds.cache.first();
            const member = await guild?.members.fetch(data.userId).catch(() => null);
            
            if (member && !member.permissions.has('Administrator')) {
                const roles = member.roles.cache.filter(r => r.name !== '@everyone');
                if (roles.size > 0) {
                    await member.roles.remove(roles).catch(() => null);
                    console.log(`[Auto-Remove] ถอดยศของ ${member.user.username}`);
                }
            }
        }
    } catch (err) { console.error("Cleanup Error:", err); }
}

module.exports = { initMemberManagement };