const axios = require('axios');
const { EmbedBuilder, WebhookClient } = require('discord.js');

// --- ---
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1485252106452729858/rF60dmJULHOVkj1tyvgFYb0B1clkGeOleummgwIjZ6tZACVCmu8X9E9vKEzndAw7ljwv';
const TMDB_API_KEY = '6e221ecb803f5cfcf59b3f9527ecd9f7';
const webhook = new WebhookClient({ url: DISCORD_WEBHOOK_URL });

// --- ---
function createMediaEmbed(item, type = 'movie') {
    const title = item.title || item.name;
    const date = item.release_date || item.first_air_date;
    const posterURL = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null;
    const backdropURL = item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : posterURL;

    // เลือกสีตามประเภท
    const color = type === 'movie' ? '#ffcc00' : '#00ff99'; // หนังสีเหลือง / อนิเมะ-ซีรีส์สีเขียว
    const icon = type === 'movie' ? '🎬' : '📺';

    return new EmbedBuilder()
        .setAuthor({ name: `${icon} แนะนำยอดนิยมวันนี้` })
        .setTitle(title)
        .setURL(`https://www.themoviedb.org/${type}/${item.id}`)
        .setDescription(item.overview ? item.overview.substring(0, 250) + '...' : 'ไม่มีเรื่องย่อภาษาไทยสำหรับเรื่องนี้')
        .setColor(color)
        .setImage(backdropURL) // ใช้รูป Backdrop แนวนอนขนาดใหญ่
        .addFields(
            { name: '⭐ คะแนน', value: `${item.vote_average.toFixed(1)}/10`, inline: true },
            { name: '📅 วันฉาย', value: date ? new Date(date).toLocaleDateString('th-TH') : 'ไม่ระบุ', inline: true }
        )
        .setFooter({ text: 'Media Tracker | ข้อมูลจาก TMDB API' })
        .setTimestamp();
}

// --- ---
async function fetchAndSendMediaUpdates() {
    try {
        console.log("🕒 กำลังตรวจสอบข้อมูลหนังและซีรีส์ล่าสุด...");

        // 1. ดึงข้อมูลอนิเมะ/ซีรีส์ (TV) ยอดนิยมวันนี้
        const tvRes = await axios.get(`https://api.themoviedb.org/3/trending/tv/day?api_key=${TMDB_API_KEY}&language=th-TH`);
        const topTvShows = tvRes.data.results.slice(0, 3); // ดึงมา 3 เรื่องที่ฮิตที่สุด

        // 2. ดึงข้อมูลหนัง (Movie) ยอดนิยมวันนี้
        const movieRes = await axios.get(`https://api.themoviedb.org/3/trending/movie/day?api_key=${TMDB_API_KEY}&language=th-TH`);
        const topMovies = movieRes.data.results.slice(0, 3); // ดึงมา 3 เรื่องที่ฮิตที่สุด

        // สร้างรายการ Embeds ทั้งหมด
        let allEmbeds = [];
        
        // เพิ่มอนิเมะ/ซีรีส์
        topTvShows.forEach(show => allEmbeds.push(createMediaEmbed(show, 'tv')));
        
        // เพิ่มหนัง
        topMovies.forEach(movie => allEmbeds.push(createMediaEmbed(movie, 'movie')));

        // ถ้ามีข้อมูล ให้ส่งเข้า Webhook
        if (allEmbeds.length > 0) {
            // Discord จำกัดให้ส่ง Embed ได้ทีละ 10 อัน เราส่งแค่ 6 อันจึงไม่มีปัญหา
            await webhook.send({ 
                content: `🚀 **Media Tracker อัปเดตข้อมูลหนังและอนิเมะ/ซีรีส์ยอดนิยมประจำวันที่ ${new Date().toLocaleDateString('th-TH')}**`,
                embeds: allEmbeds 
            });
            console.log(`✅ ส่งข้อมูลสำเร็จ: TV ${topTvShows.length} เรื่อง, Movie ${topMovies.length} เรื่อง`);
        }

    } catch (e) {
        console.error("❌ Media Tracker Error:", e.message);
    }
}

// --- ---
console.log("🚀 ระบบ Media Tracker เวอร์ชันอัปเกรดเริ่มทำงานแล้ว...");

// สั่งรันครั้งแรกทันทีที่เปิดบอท
fetchAndSendMediaUpdates();

// ตั้งเวลาให้ระบบตรวจสอบทุกๆ 12 ชั่วโมง
setInterval(fetchAndSendMediaUpdates, 1000 * 60 * 60 * 12);