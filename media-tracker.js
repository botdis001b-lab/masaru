const axios = require('axios');
const { EmbedBuilder, WebhookClient } = require('discord.js');

// --- ตั้งค่าระบบจากข้อมูลที่พี่ให้มา ---
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1485252106452729858/rF60dmJULHOVkj1tyvgFYb0B1clkGeOleummgwIjZ6tZACVCmu8X9E9vKEzndAw7ljwv';
const TMDB_API_KEY = '6e221ecb803f5cfcf59b3f9527ecd9f7';
const webhook = new WebhookClient({ url: DISCORD_WEBHOOK_URL });

// ฟังก์ชันส่งข้อความเข้า Discord
async function sendNotification(title, description, imageUrl, color = '#ff5722') {
    const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(description)
        .setImage(imageUrl) // เปลี่ยนเป็นรูปใหญ่ให้สวยๆ ครับ
        .setColor(color)
        .setFooter({ text: 'Media Tracker Update' })
        .setTimestamp();
    
    await webhook.send({ embeds: [embed] });
}

// --- 1. ระบบเช็กอนิเมะฉายวันนี้ (Jikan API) ---
async function checkAnimeSchedule() {
    try {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const today = days[new Date().getDay()];
        
        const res = await axios.get(`https://api.themoviedb.org/3/trending/tv/day?api_key=${TMDB_API_KEY}&language=th-TH`);
        const anime = res.data.results[0]; // ดึงรายการเด่นมา 1 เรื่อง

        if (anime) {
            await sendNotification(
                `📺 แนะนำอนิเมะ/ซีรีส์วันนี้: ${anime.name}`,
                `${anime.overview.substring(0, 200)}...`,
                `https://image.tmdb.org/t/p/w500${anime.backdrop_path || anime.poster_path}`,
                '#00ff99'
            );
            console.log(`[Media] แจ้งเตือนเรื่อง: ${anime.name}`);
        }
    } catch (e) { console.error("Media Tracker Error:", e.message); }
}

// --- 2. ระบบเช็กหนังฮิต (TMDB API) ---
async function checkNewMovies() {
    try {
        const res = await axios.get(`https://api.themoviedb.org/3/trending/movie/day?api_key=${TMDB_API_KEY}&language=th-TH`);
        const movie = res.data.results[0];

        if (movie) {
            await sendNotification(
                `🎬 หนังกำลังฮิต: ${movie.title}`,
                `${movie.overview.substring(0, 200)}...`,
                `https://image.tmdb.org/t/p/w500${movie.backdrop_path || movie.poster_path}`,
                '#ffcc00'
            );
            console.log(`[Movie] แจ้งเตือนเรื่อง: ${movie.title}`);
        }
    } catch (e) { console.error("Movie Tracker Error:", e.message); }
}

// สั่งรันครั้งแรกทันทีและตั้งเวลาทุก 12 ชั่วโมง
console.log("🚀 ระบบ Media Tracker เริ่มทำงานแล้ว...");
checkAnimeSchedule();
checkNewMovies();

setInterval(() => {
    checkAnimeSchedule();
    checkNewMovies();
}, 1000 * 60 * 60 * 12);