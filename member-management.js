const { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const mongoose = require('mongoose');

const ROLE_ID = '1356148472851726437'; 
const CHANNEL_ID = '1486030638464237631'; 
const ADMIN_CHANNEL_ID = '1490233799534186627'; 
const INACTIVE_DAYS = 10;

const VoiceActive = mongoose.models.VoiceActive || mongoose.model('VoiceActive', new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    lastActive: { type: Date, default: Date.now }
}));

function initMemberManagement(client) {
    client.once(Events.ClientReady, async () => {
        const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
        if (!channel) return;
        
        const embed = new EmbedBuilder()
            .setTitle('🏆 ระบบสมาชิก & เลเวล')
            .setDescription('กดปุ่มด้านล่างเพื่อรับยศเข้าห้องเสียง หรือเช็คสถานะสมาชิกของคุณ\n\n*หมายเหตุ: หากไม่ได้เข้าห้องเสียงนาน 10 วัน ยศจะถูกดึงคืนอัตโนมัติ*')
            .setColor('#5865F2');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('get_role').setLabel('🔰 รับยศสมาชิก').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('check_status').setLabel('🔍 เช็คสถานะ').setStyle(ButtonStyle.Secondary)
        );

        const messages = await channel.messages.fetch({ limit: 10 });
        if (messages.size === 0) await channel.send({ embeds: [embed], components: [row] });
    });

    client.on(Events.InteractionCreate, async (interaction) => {
        if (!interaction.isButton()) return;
        if (interaction.customId === 'get_role') {
            await interaction.member.roles.add(ROLE_ID).catch(() => null);
            await interaction.reply({ content: '✅ มอบยศสมาชิกเรียบร้อย!', ephemeral: true });
        }
        if (interaction.customId === 'check_status') {
            const data = await VoiceActive.findOne({ userId: interaction.user.id });
            const date = data ? data.lastActive.toLocaleDateString('th-TH') : 'ไม่มีข้อมูล';
            await interaction.reply({ content: `📅 ออนไลน์ห้องเสียงล่าสุด: ${date}`, ephemeral: true });
        }
    });

    client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
        if (newState.channelId) {
            await VoiceActive.findOneAndUpdate({ userId: newState.member.id }, { lastActive: new Date() }, { upsert: true });
        }
    });

    setInterval(() => runCleanupLogic(client), 1000 * 60 * 60 * 24); // เช็คคนหายทุก 24 ชม.
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
    } catch (e) { console.error("Cleanup Error:", e.message); }
}

module.exports = { initMemberManagement };