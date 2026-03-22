const axios = require('axios');
const { EmbedBuilder, WebhookClient } = require('discord.js');

// --- ตั้งค่าระบบ ---
const DISCORD_WEBHOOK_URL = 'ใส่_WEBHOOK_URL_ของพี่ที่นี่';
const TMDB_API_KEY = 'ใส่_TMDB_API_KEY_ของพี่ที่นี่';
const webhook = new WebhookClient({ url: DISCORD_WEBHOOK_URL });

// ฟังก์ชันส่งข้อความเข้า Discord
async function sendNotification(title, description, imageUrl, color = '#ff0055') {
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setThumbnail(imageUrl)
        .setColor(color)
        .setTimestamp();
    
    await webhook.send({ embeds: [embed] });
}

// --- 1. ระบบเช็กอนิเมะฉายวันนี้ (Jikan API - ฟรีไม่ต้องใช้ Key) ---
async function checkAnimeSchedule() {
    try {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const today = days[new Date().getDay()];
        
        const res = await axios.get(`https://api.jikan.moe/v4/schedules?filter=${today}`);
        const anime = res.data.data[0]; // ดึงเรื่องแรกมาเป็นตัวอย่าง (หรือจะ Loop ทั้งหมดก็ได้)

        if (anime) {
            await sendNotification(
                `📺 อนิเมะฉายวันนี้: ${anime.title}`,
                `เวลาฉาย: ${anime.broadcast.string || 'ไม่ระบุ'}\nคะแนน: ⭐ ${anime.score || 'N/A'}`,
                anime.images.jpg.image_url,
                '#00ff99'
            );
            console.log(`[Anime] Notified: ${anime.title}`);
        }
    } catch (e) { console.error("Anime Tracker Error:", e.message); }
}

// --- 2. ระบบเช็กหนัง/ซีรีส์มาใหม่ (TMDB API) ---
async function checkNewMovies() {
    try {
        const res = await axios.get(`https://api.themoviedb.org/3/trending/all/day?api_key=${TMDB_API_KEY}&language=th-TH`);
        const media = res.data.results[0];

        if (media) {
            const title = media.title || media.name;
            await sendNotification(
                `🎬 กำลังฮิต: ${title}`,
                `${media.overview.substring(0, 150)}...\n\nประเภท: ${media.media_type === 'tv' ? 'ซีรีส์' : 'ภาพยนตร์'}`,
                `https://image.tmdb.org/t/p/w500${media.poster_path}`,
                '#ffcc00'
            );
            console.log(`[Media] Notified: ${title}`);
        }
    } catch (e) { console.error("Movie Tracker Error:", e.message); }
}

// ตั้งเวลารัน (เช่น เช็กทุก 6 ชั่วโมง)
console.log("🚀 Media Tracker Started...");
checkAnimeSchedule();
checkNewMovies();

setInterval(() => {
    checkAnimeSchedule();
    checkNewMovies();
}, 1000 * 60 * 60 * 6); // รันทุก 6 ชั่วโมง