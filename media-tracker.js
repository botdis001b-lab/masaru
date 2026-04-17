const axios = require('axios');
const { EmbedBuilder, WebhookClient } = require('discord.js');
const mongoose = require('mongoose');

const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1485252106452729858/rF60dmJULHOVkj1tyvgFYb0B1clkGeOleummgwIjZ6tZACVCmu8X9E9vKEzndAw7ljwv';
const TMDB_API_KEY = '6e221ecb803f5cfcf59b3f9527ecd9f7';
const webhook = new WebhookClient({ url: DISCORD_WEBHOOK_URL });

const MediaLog = mongoose.models.MediaLog || mongoose.model('MediaLog', new mongoose.Schema({
    mediaId: { type: String, required: true, unique: true },
    sentAt: { type: Date, default: Date.now, expires: 86400 } 
}));

async function fetchAndSendMediaUpdates() {
    if (mongoose.connection.readyState !== 1) return;

    try {
        const [tvRes, movieRes] = await Promise.all([
            axios.get(`https://api.themoviedb.org/3/trending/tv/day?api_key=${TMDB_API_KEY}&language=th-TH`),
            axios.get(`https://api.themoviedb.org/3/trending/movie/day?api_key=${TMDB_API_KEY}&language=th-TH`)
        ]);

        const topMedia = [...tvRes.data.results.slice(0, 3).map(i => ({...i, type:'tv'})), ...movieRes.data.results.slice(0, 3).map(i => ({...i, type:'movie'}))];
        let embeds = [];

        for (const item of topMedia) {
            const key = `${item.type}-${item.id}`;
            if (!(await MediaLog.findOne({ mediaId: key }))) {
                const embed = new EmbedBuilder()
                    .setTitle(item.title || item.name)
                    .setColor(item.type === 'movie' ? '#ffcc00' : '#00ff99')
                    .setImage(`https://image.tmdb.org/t/p/w780${item.backdrop_path}`)
                    .setFooter({ text: 'Media Tracker | กันส่งซ้ำ' });
                embeds.push(embed);
                await new MediaLog({ mediaId: key }).save();
            }
        }

        if (embeds.length > 0) await webhook.send({ content: '🚀 **รายการใหม่ประจำวัน!**', embeds });
    } catch (e) { console.error("Media Error:", e.message); }
}

setTimeout(fetchAndSendMediaUpdates, 15000);
setInterval(fetchAndSendMediaUpdates, 1000 * 60 * 60 * 6);