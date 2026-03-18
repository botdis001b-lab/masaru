const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;

const app = express();
const port = process.env.PORT || 3000;

// รับ User model จาก index.js เพื่อให้ดึงเลเวลมาโชว์ได้
module.exports = function(User) {
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
        secret: 'masaru-secret-v5',
        resave: false,
        saveUninitialized: false
    }));

    app.use(passport.initialize());
    app.use(passport.session());

    app.get('/', (req, res) => {
        res.send(`<body style="background:#23272a;color:white;text-align:center;font-family:sans-serif;padding-top:100px;">
            <h1 style="font-size:40px;">🚀 Masaru Dashboard</h1>
            <p>ระบบเลเวลและข้อมูลสมาชิก</p><br>
            <a href="/login" style="background:#5865F2;color:white;padding:15px 40px;text-decoration:none;border-radius:8px;font-weight:bold;font-size:20px;">Login with Discord</a>
        </body>`);
    });

    app.get('/login', passport.authenticate('discord'));
    app.get('/auth/discord/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
        res.redirect('/profile');
    });

    app.get('/profile', async (req, res) => {
        if (!req.isAuthenticated()) return res.redirect('/');
        const userData = await User.findOne({ userId: req.user.id });
        const avatarUrl = req.user.avatar ? `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png';
        
        res.send(`<body style="background:#23272a;color:white;text-align:center;font-family:sans-serif;padding:50px;">
            <div style="background:#2c2f33;padding:40px;border-radius:20px;display:inline-block;border-top:5px solid #5865F2;">
                <img src="${avatarUrl}" style="border-radius:50%;width:120px;border:4px solid #5865F2;">
                <h2>สวัสดีคุณ ${req.user.username}</h2>
                <hr style="border:0;border-top:1px solid #444;">
                <p style="font-size:20px;">Level: <span style="color:#f1c40f;">${userData ? userData.level : 1}</span></p>
                <p>XP: ${userData ? userData.xp : 0}</p>
                <br><a href="/logout" style="color:#ed4245;">Logout</a>
            </div>
        </body>`);
    });

    app.get('/logout', (req, res) => { req.logout(() => res.redirect('/')); });
    app.listen(port, () => console.log(`🌐 Dashboard Online on Port ${port}`));
};