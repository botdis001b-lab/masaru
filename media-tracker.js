const axios = require('axios');
const { EmbedBuilder, WebhookClient } = require('discord.js');
const mongoose = require('mongoose');

// --- [ตั้งค่าเบื้องต้น] ---
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1485252106452729858/rF60dmJULHOVkj1tyvgFYb0B1clkGeOleummgwIjZ6tZACVCmu8X9E9vKEzndAw7ljwv';
const TMDB_API_KEY = '6e221ecb803f5cfcf59b3f9527ecd9f7';
const webhook = new WebhookClient({ url: DISCORD_WEBHOOK_URL });

// Schema สำหรับจำว่าเรื่องไหนส่งไปแล้ว (ป้องกันการส่งซ้ำหลังรีบอท)
const MediaLog = mongoose.models.MediaLog || mongoose.model('MediaLog', new mongoose.Schema({
    mediaId: { type: String, required: true, unique: true },
    title: String,
    sentAt: { type: Date, default: Date.now, expires: 86400 } // ลบข้อมูลอัตโนมัติหลัง 24 ชม.
}));

// ฟังก์ชันสร้าง Embed (เหมือนเดิมแต่ปรับสีให้สวยขึ้น)
function createMediaEmbed(item, type = 'movie') {
    const title = item.title || item.name;
    const date = item.release_date || item.first_air_date;
    const posterURL = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null;
    const backdropURL = item.backdrop_path ? `https://image.tmdb.org/t/p/w780${item.backdrop_path}` : posterURL;
    const color = type === 'movie' ? '#ffcc00' : '#00ff99';
    const icon = type === 'movie' ? '🎬' : '📺';

    return new EmbedBuilder()
        .setAuthor({ name: `${icon} แนะนำยอดนิยม` })
        .setTitle(title)
        .setURL(`https://www.themoviedb.org/${type}/${item.id}`)
        .setDescription(item.overview ? item.overview.substring(0, 200) + '...' : 'ไม่มีเรื่องย่อภาษาไทยสำหรับเรื่องนี้')
        .setColor(color)
        .setImage(backdropURL)
        .addFields(
            { name: '⭐ คะแนน', value: `${item.vote_average.toFixed(1)}/10`, inline: true },
            { name: '📅 วันฉาย', value: date ? new Date(date).toLocaleDateString('th-TH') : 'ไม่ระบุ', inline: true }
        )
        .setFooter({ text: 'Media Tracker | ป้องกันการส่งซ้ำอัตโนมัติ' })
        .setTimestamp();
}

// --- [ฟังก์ชันหลัก: ตรวจสอบและส่งข้อมูล] ---
async function fetchAndSendMediaUpdates() {
    // ถ้า DB ยังไม่พร้อม ให้รอรอบหน้า เพื่อป้องกันการส่งซ้ำเพราะจำไม่ได้
    if (mongoose.connection.readyState !== 1) {
        console.log("⚠️ DB ยังไม่พร้อม ข้ามการเช็ก Media เพื่อป้องกันการส่งซ้ำ...");
        return;
    }

    try {
        console.log("🕒 กำลังตรวจสอบข้อมูลหนังและซีรีส์ล่าสุด...");

        // ดึงข้อมูลจาก TMDB
        const [tvRes, movieRes] = await Promise.all([
            axios.get(`https://api.themoviedb.org/3/trending/tv/day?api_key=${TMDB_API_KEY}&language=th-TH`),
            axios.get(`https://api.themoviedb.org/3/trending/movie/day?api_key=${TMDB_API_KEY}&language=th-TH`)
        ]);

        const topMedia = [
            ...tvRes.data.results.slice(0, 3).map(i => ({ ...i, mType: 'tv' })),
            ...movieRes.data.results.slice(0, 3).map(i => ({ ...i, mType: 'movie' }))
        ];

        let newEmbeds = [];

        for (const item of topMedia) {
            const mediaKey = `${item.mType}-${item.id}`;
            
            // เช็กใน Database ว่าเคยส่งไอดีนี้ไปหรือยัง
            const alreadySent = await MediaLog.findOne({ mediaId: mediaKey });
            
            if (!alreadySent) {
                newEmbeds.push(createMediaEmbed(item, item.mType));
                // บันทึกไอดีลง DB ทันที
                await new MediaLog({ mediaId: mediaKey, title: item.title || item.name }).save();
            }
        }

        if (newEmbeds.length > 0) {
            await webhook.send({ 
                content: `🚀 **พบรายการมาใหม่/ยอดนิยมประจำวันนี้!** (ตรวจพบใหม่ ${newEmbeds.length} เรื่อง)`,
                embeds: newEmbeds 
            });
            console.log(`✅ ส่งข้อมูลใหม่สำเร็จ ${newEmbeds.length} เรื่อง`);
        } else {
            console.log("ℹ️ ไม่มีเรื่องใหม่ที่ยังไม่เคยส่ง ข้ามการส่ง Webhook");
        }

    } catch (e) {
        console.error("❌ Media Tracker Error:", e.message);
    }
}

// เริ่มต้นระบบ
console.log("🚀 ระบบ Media Tracker (Anti-Duplicate) เริ่มทำงานแล้ว...");

// หน่วงเวลา 10 วินาทีหลังบอทเปิด เพื่อรอให้ DB เชื่อมต่อเสร็จก่อนเริ่มเช็กครั้งแรก
setTimeout(fetchAndSendMediaUpdates, 10000);

// ตรวจสอบทุกๆ 6 ชั่วโมง (ปรับให้ถี่ขึ้นได้เพราะมีระบบกันซ้ำแล้ว)
setInterval(fetchAndSendMediaUpdates, 1000 * 60 * 60 * 6);