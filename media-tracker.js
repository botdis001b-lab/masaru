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
        const movieRes = await axios.get(`https://api.themoviedb.org/3/trending/movie/day?api_key=${TMDB_API_KEY}&language=th-TH`);
        const topMovies = movieRes.data.results.slice(0, 3);

        for (const item of topMovies) {
            const exists = await MediaLog.findOne({ mediaId: `movie-${item.id}` });
            if (!exists) {
                const embed = new EmbedBuilder()
                    .setTitle(`🎬 แนะนำหนังวันนี้: ${item.title}`)
                    .setURL(`https://www.themoviedb.org/movie/${item.id}`)
                    .setImage(`https://image.tmdb.org/t/p/w780${item.backdrop_path}`)
                    .setColor('#ffcc00')
                    .setTimestamp();
                
                await webhook.send({ embeds: [embed] });
                await new MediaLog({ mediaId: `movie-${item.id}` }).save();
            }
        }
    } catch (e) { console.error(e.message); }
}

setInterval(fetchAndSendMediaUpdates, 1000 * 60 * 60 * 6);