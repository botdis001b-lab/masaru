const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const app = express();
const port = process.env.PORT || 3000;

// ตั้งค่าดึงข้อมูลจาก Schema เดิมที่มีอยู่ (User)
const User = mongoose.model('User'); 

function keepAlive() {
    // ตั้งค่าให้ Express อ่านข้อมูลจาก Form ได้
    app.use(express.urlencoded({ extended: true }));
    
    // ระบบ Session สำหรับ Login (ป้องกันคนนอกเข้าดูข้อมูล)
    app.use(session({
        secret: 'masaru-secret-key',
        resave: false,
        saveUninitialized: true
    }));

    // --- 1. หน้า Login ---
    app.get('/login', (req, res) => {
        res.send(`
            <body style="background:#23272a; color:white; font-family:sans-serif; text-align:center; padding-top:50px;">
                <h2>🔐 Admin Login</h2>
                <form action="/login" method="POST">
                    <input type="password" name="password" placeholder="ใส่รหัสผ่าน" style="padding:10px; border-radius:5px; border:none;">
                    <button type="submit" style="padding:10px 20px; cursor:pointer; background:#7289da; color:white; border:none; border-radius:5px;">เข้าสู่ระบบ</button>
                </form>
            </body>
        `);
    });

    app.post('/login', (req, res) => {
        const { password } = req.body;
        if (password === '1234') { // <--- เปลี่ยนรหัสผ่านตรงนี้
            req.session.isAdmin = true;
            res.redirect('/data');
        } else {
            res.send("<script>alert('รหัสผ่านไม่ถูกต้อง'); window.location='/login';</script>");
        }
    });

    // --- 2. หน้าแสดงข้อมูล (ต้อง Login ก่อน) ---
    app.get('/data', async (req, res) => {
        if (!req.session.isAdmin) return res.redirect('/login');

        try {
            const allUsers = await User.find().sort({ level: -1 }); // ดึงทุกคนเรียงตามเลเวล
            let userRows = allUsers.map((u, i) => `
                <tr style="border-bottom: 1px solid #444;">
                    <td style="padding:10px;">${i + 1}</td>
                    <td style="padding:10px;">${u.userId}</td>
                    <td style="padding:10px; color:#f1c40f;">Lv. ${u.level}</td>
                    <td style="padding:10px;">${u.xp} XP</td>
                </tr>
            `).join('');

            res.send(`
                <body style="background:#23272a; color:white; font-family:sans-serif; padding:20px;">
                    <div style="max-width:800px; margin:auto; background:#2c2f33; padding:20px; border-radius:10px;">
                        <h1 style="color:#7289da;">📊 รายชื่อผู้ลงทะเบียน (Ranking)</h1>
                        <table style="width:100%; border-collapse: collapse; text-align:left;">
                            <thead>
                                <tr style="background:#7289da; color:white;">
                                    <th style="padding:10px;">อันดับ</th>
                                    <th style="padding:10px;">User ID</th>
                                    <th style="padding:10px;">เลเวล</th>
                                    <th style="padding:10px;">ค่า XP</th>
                                </tr>
                            </thead>
                            <tbody>${userRows}</tbody>
                        </table>
                        <br>
                        <a href="/logout" style="color:#e74c3c;">ออกจากระบบ</a>
                    </div>
                </body>
            `);
        } catch (err) {
            res.send("เกิดข้อผิดพลาดในการดึงข้อมูล");
        }
    });

    // หน้าแรก (Public)
    app.get('/', (req, res) => {
        res.send("<body style='background:#23272a; color:white; text-align:center; padding-top:100px;'><h1>🚀 MasaruBot Website</h1><a href='/login' style='color:#7289da;'>ไปที่หน้าจัดการข้อมูล</a></body>");
    });

    // ออกจากระบบ
    app.get('/logout', (req, res) => {
        req.session.destroy();
        res.redirect('/');
    });

    app.listen(port, () => console.log(`Web Server running on port ${port}`));
}

module.exports = keepAlive;