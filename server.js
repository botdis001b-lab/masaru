const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const app = express();
const port = process.env.PORT || 3000;

function keepAlive() {
    app.use(express.urlencoded({ extended: true }));
    
    app.use(session({
        secret: 'masaru-secret-key',
        resave: false,
        saveUninitialized: true
    }));

    // หน้า Login
    app.get('/login', (req, res) => {
        res.send(`
            <body style="background:#23272a; color:white; font-family:sans-serif; text-align:center; padding-top:50px;">
                <h2>🔐 Admin Dashboard Login</h2>
                <form action="/login" method="POST">
                    <input type="password" name="password" placeholder="รหัสผ่าน" style="padding:10px; border-radius:5px; border:none;">
                    <button type="submit" style="padding:10px 20px; cursor:pointer; background:#7289da; color:white; border:none; border-radius:5px;">Login</button>
                </form>
            </body>
        `);
    });

    app.post('/login', (req, res) => {
        if (req.body.password === '1234') { // รหัสผ่านของคุณ
            req.session.isAdmin = true;
            res.redirect('/data');
        } else {
            res.send("<script>alert('รหัสไม่ถูกต้อง'); window.location='/login';</script>");
        }
    });

    // หน้าแสดงข้อมูล (ดึงจาก MongoDB)
    app.get('/data', async (req, res) => {
        if (!req.session.isAdmin) return res.redirect('/login');

        try {
            // ดึง Model User มาใช้
            const User = mongoose.model('User');
            const allUsers = await User.find().sort({ level: -1 });
            
            let rows = allUsers.map((u, i) => `
                <tr style="border-bottom: 1px solid #444;">
                    <td style="padding:10px;">${i + 1}</td>
                    <td style="padding:10px;">${u.userId}</td>
                    <td style="padding:10px; color:#f1c40f;">Lv. ${u.level}</td>
                    <td style="padding:10px;">${u.xp} XP</td>
                </tr>
            `).join('');

            res.send(`
                <body style="background:#23272a; color:white; font-family:sans-serif; padding:20px;">
                    <h1 style="color:#7289da;">📊 ระบบข้อมูลผู้ใช้ MasaruBot</h1>
                    <table style="width:100%; border-collapse: collapse; background:#2c2f33;">
                        <tr style="background:#7289da;">
                            <th style="padding:10px;">อันดับ</th><th style="padding:10px;">User ID</th>
                            <th style="padding:10px;">เลเวล</th><th style="padding:10px;">XP</th>
                        </tr>
                        ${rows}
                    </table>
                    <br><a href="/logout" style="color:#e74c3c;">Logout</a>
                </body>
            `);
        } catch (err) {
            res.send("<h2>⚠️ ยังไม่พบข้อมูลในฐานข้อมูล หรือระบบฐานข้อมูลยังไม่พร้อม</h2><p>ลองให้คนพิมพ์คุยในดิสคอร์ดสักพักแล้วค่อยมาดูใหม่ครับ</p>");
        }
    });

    app.get('/', (req, res) => res.redirect('/login'));
    app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/'); });

    app.listen(port, () => console.log(`🌐 Web Server running on port ${port}`));
}

module.exports = keepAlive;