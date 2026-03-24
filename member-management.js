const { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');
const client = require('./index.js').client;

// --- [ตั้งค่าระบบ] ---
const INACTIVE_DAYS = 10; // หายไป 10 วันถอดยศ
const ROLE_ID = '1356148472851726437'; // ID ยศที่ให้กดรับ
const CHANNEL_ID = '1486030638464237631'; // ID ห้องที่มีปุ่มกด
const EXEMPT_ROLES = ['ADMIN_ID_HERE']; // ใส่ ID ยศที่ไม่ต้องการให้โดนถอด (เช่น แอดมิน)

// Schema สำหรับเก็บเวลาเข้าห้องเสียงล่าสุด
const VoiceLogSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    lastActive: { type: Date, default: Date.now }
});
const VoiceActive = mongoose.models.VoiceActive || mongoose.model('VoiceActive', VoiceLogSchema);

// --- [ส่วนที่ 1: ระบบปุ่มกดรับยศ] ---
client.once(Events.ClientReady, async () => {
    const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
    if (!channel) return;

    // ตรวจสอบว่ามีข้อความปุ่มอยู่หรือยัง (ป้องกันบอทส่งซ้ำทุกครั้งที่รีสตาร์ท)
    const messages = await channel.messages.fetch({ limit: 10 });
    const isExist = messages.some(msg => msg.author.id === client.user.id && msg.embeds.length > 0);
    
    if (!isExist) {
        const embed = new EmbedBuilder()
            .setTitle('🎫 รับยศเข้าห้อง')
            .setDescription('กดปุ่มด้านล่างเพื่อรับยศสำหรับเข้าใช้งานห้องพิเศษครับ')
            .setColor('#00ff99');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('get_role_button')
                .setLabel('กดรับยศตรงนี้')
                .setStyle(ButtonStyle.Success)
        );

        await channel.send({ embeds: [embed], components: [row] });
    }
});

// จัดการการกดปุ่ม
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton() || interaction.customId !== 'get_role_button') return;

    const role = interaction.guild.roles.cache.get(ROLE_ID);
    if (!role) return interaction.reply({ content: 'ไม่พบยศในระบบ กรุณาแจ้งแอดมิน', ephemeral: true });

    if (interaction.member.roles.cache.has(ROLE_ID)) {
        await interaction.member.roles.remove(role);
        return interaction.reply({ content: 'ถอดยศเรียบร้อยแล้วครับ', ephemeral: true });
    } else {
        await interaction.member.roles.add(role);
        return interaction.reply({ content: 'รับยศเรียบร้อย! ยินดีต้อนรับครับ', ephemeral: true });
    }
});

// --- [ส่วนที่ 2: ระบบเช็กคนหาย 10 วัน] ---
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    if (newState.channelId) { // เมื่อมีการเข้าห้องเสียง
        await VoiceActive.findOneAndUpdate(
            { userId: newState.member.id },
            { lastActive: new Date() },
            { upsert: true }
        );
    }
});

async function checkInactiveMembers() {
    console.log('[System] กำลังตรวจสอบสมาชิกที่หายไปนาน...');
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - INACTIVE_DAYS);

    try {
        const inactiveData = await VoiceActive.find({ lastActive: { $lt: cutoff } });
        
        for (const data of inactiveData) {
            const guild = client.guilds.cache.first();
            if (!guild) continue;

            const member = await guild.members.fetch(data.userId).catch(() => null);
            if (!member) continue;

            // ข้ามถ้าเป็นแอดมินหรือยศที่ยกเว้น
            if (member.roles.cache.some(r => EXEMPT_ROLES.includes(r.id))) continue;

            const rolesToRemove = member.roles.cache.filter(r => r.name !== '@everyone');
            if (rolesToRemove.size > 0) {
                await member.roles.remove(rolesToRemove);
                console.log(`[Removed] ถอดยศ ${member.user.username} (หายไปเกิน ${INACTIVE_DAYS} วัน)`);
            }
        }
    } catch (e) {
        console.error('Check Inactive Error:', e);
    }
}

// รันการตรวจสอบทุก 24 ชั่วโมง
setInterval(checkInactiveMembers, 1000 * 60 * 60 * 24);