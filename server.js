const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;

const app = express();
const port = process.env.PORT || 3000;

function keepAlive(User) {
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
        secret: 'masaru-secret-key-999',
        resave: false,
        saveUninitialized: false
    }));

    app.use(passport.initialize());
    app.use(passport.session());

    // --- หน้าแรก ---
    app.get('/', (req, res) => {
        res.send(`
            <body style="background:#23272a; color:white; font-family:sans-serif; text-align:center; padding-top:100px;">
                <h1 style="font-size:40px;">🚀 Masaru Bot Dashboard</h1>
                <p>ระบบจัดการเลเวลและข้อมูลสมาชิก</p>
                <br>
                <a href="/login" style="background:#5865F2; color:white; padding:15px 40px; text-decoration:none; border-radius:8px; font-weight:bold; font-size:20px;">Login with Discord</a>
            </body>
        `);
    });

    app.get('/login', passport.authenticate('discord'));
    app.get('/auth/discord/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
        res.redirect('/profile');
    });

    // --- หน้าโปรไฟล์ ---
    app.get('/profile', async (req, res) => {
        if (!req.isAuthenticated()) return res.redirect('/');
        const userData = await User.findOne({ userId: req.user.id });
        const avatarUrl = req.user.avatar ? `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png?size=256` : 'https://cdn.discordapp.com/embed/avatars/0.png';
        
        res.send(`
            <body style="background:#23272a; color:white; font-family:sans-serif; text-align:center; padding:50px;">
                <div style="background:#2c2f33; padding:40px; border-radius:20px; display:inline-block; border-top: 5px solid #5865F2;">
                    <img src="${avatarUrl}" style="border-radius:50%; width:120px; border:4px solid #5865F2;">
                    <h2>ยินดีต้อนรับ, ${req.user.username}</h2>
                    <hr style="border:0; border-top:1px solid #444;">
                    <div style="display:flex; justify-content:space-around; gap:20px; margin-top:20px;">
                        <div><p style="color:#b9bbbe; margin:0;">Level</p><h3 style="color:#f1c40f; font-size:30px; margin:5px 0;">${userData ? userData.level : 1}</h3></div>
                        <div><p style="color:#b9bbbe; margin:0;">XP</p><h3 style="color:#f1c40f; font-size:30px; margin:5px 0;">${userData ? userData.xp : 0}</h3></div>
                    </div>
                    <br>
                    <a href="/leaderboard" style="color:#5865F2; text-decoration:none; font-weight:bold;">🏆 ดูอันดับทั้งหมด</a>
                    <br><br>
                    <a href="/logout" style="color:#ed4245; font-size:14px;">ออกจากระบบ</a>
                </div>
            </body>
        `);
    });

    // --- หน้าตารางอันดับ ---
    app.get('/leaderboard', async (req, res) => {
        const topUsers = await User.find().sort({ level: -1, xp: -1 }).limit(10);
        let rows = topUsers.map((u, i) => `
            <tr style="border-bottom:1px solid #444;">
                <td style="padding:15px; text-align:center;">${i+1}</td>
                <td style="padding:15px;"><img src="${u.avatar || ''}" width="30" style="border-radius:50%; vertical-align:middle; margin-right:10px;"> ${u.username || u.userId}</td>
                <td style="padding:15px; text-align:center; color:#f1c40f;">Lv. ${u.level}</td>
                <td style="padding:15px; text-align:center;">${u.xp} XP</td>
            </tr>
        `).join('');

        res.send(`
            <body style="background:#23272a; color:white; font-family:sans-serif; padding:40px;">
                <h1 style="text-align:center;">🏆 Masaru Top 10</h1>
                <table style="width:100%; max-width:700px; margin:auto; background:#2c2f33; border-radius:15px; overflow:hidden; border-collapse:collapse;">
                    <tr style="background:#1e2124; color:#b9bbbe;">
                        <th style="padding:15px;">Rank</th><th style="padding:15px; text-align:left;">User</th><th style="padding:15px;">Level</th><th style="padding:15px;">Total XP</th>
                    </tr>
                    ${rows}
                </table>
                <p style="text-align:center; margin-top:20px;"><a href="/profile" style="color:#5865F2; text-decoration:none;">⬅️ กลับหน้าโปรไฟล์</a></p>
            </body>
        `);
    });

    app.get('/logout', (req, res) => { req.logout(() => res.redirect('/')); });
    app.listen(port, () => console.log(`🌐 Web Dashboard Online on Port ${port}`));
}

module.exports = keepAlive;