const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const mongoose = require('mongoose');

const app = express();
const port = process.env.PORT || 8080; // ใช้ Port ตามที่ Railway กำหนดใน Log

// --- จุดสำคัญมากสำหรับ Railway ---
app.set('trust proxy', 1); 

mongoose.connect(process.env.MONGO_URL).then(() => console.log('Web DB Connected! 📦'));

const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({
    userId: String,
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 }
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL,
    scope: ['identify']
}, (accessToken, refreshToken, profile, done) => {
    process.nextTick(() => done(null, profile));
}));

app.use(session({
    secret: 'masaru-standalone-v1',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: true, // บังคับใช้ HTTPS
        maxAge: 60000 * 60 * 24 // 24 ชม.
    }
}));

app.use(passport.initialize());
app.use(passport.session());

app.get('/', (req, res) => {
    res.send(`<body style="background:#23272a;color:white;text-align:center;font-family:sans-serif;padding-top:100px;">
        <h1 style="font-size:40px;">🚀 Masaru Dashboard</h1>
        <a href="/login" style="background:#5865F2;color:white;padding:15px 40px;text-decoration:none;border-radius:8px;font-weight:bold;">Login with Discord</a>
    </body>`);
});

app.get('/login', passport.authenticate('discord'));

// --- ส่วนที่ปรับปรุง: ดัก Error ตอน Callback ---
app.get('/auth/discord/callback', (req, res, next) => {
    passport.authenticate('discord', (err, user, info) => {
        if (err) {
            console.error('❌ Discord Auth Error:', err);
            return res.status(500).send(`Login Error: ${err.message}`);
        }
        if (!user) return res.redirect('/');
        
        req.logIn(user, (err) => {
            if (err) return next(err);
            res.redirect('/profile');
        });
    })(req, res, next);
});

app.get('/profile', async (req, res) => {
    try {
        if (!req.isAuthenticated()) return res.redirect('/');
        
        // ค้นหาข้อมูล ถ้าไม่มีให้สร้างใหม่ (กันบักหน้าเว็บล้ม)
        let userData = await User.findOne({ userId: req.user.id });
        if (!userData) {
            userData = await User.create({ userId: req.user.id, xp: 0, level: 1 });
        }

        const avatarUrl = req.user.avatar 
            ? `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png` 
            : 'https://cdn.discordapp.com/embed/avatars/0.png';
        
        res.send(`<body style="background:#23272a;color:white;text-align:center;font-family:sans-serif;padding:50px;">
            <div style="background:#2c2f33;padding:40px;border-radius:20px;display:inline-block;border-top:5px solid #5865F2;">
                <img src="${avatarUrl}" style="border-radius:50%;width:120px;border:4px solid #5865F2;">
                <h2>สวัสดีคุณ ${req.user.username}</h2>
                <hr style="border:0;border-top:1px solid #444;">
                <p style="font-size:20px;">Level: <span style="color:#f1c40f;">${userData.level}</span></p>
                <p>XP: ${userData.xp}</p>
                <br><a href="/logout" style="color:#ed4245;">Logout</a>
            </div>
        </body>`);
    } catch (err) {
        console.error('🔥 Profile Error:', err);
        res.status(500).send("เกิดข้อผิดพลาดในการดึงข้อมูลจาก Database");
    }
});

app.get('/logout', (req, res) => {
    req.logout(() => res.redirect('/'));
});

app.listen(port, () => console.log(`🌐 Web Dashboard Online on Port ${port}`));