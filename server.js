const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;

const app = express();
const port = process.env.PORT || 3000;

// รับ User model มาจาก index.js เพื่อป้องกัน Schema Error
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
        secret: 'masaru-secret-v3',
        resave: false,
        saveUninitialized: false
    }));

    app.use(passport.initialize());
    app.use(passport.session());

    // --- หน้า Dashboard ---
    app.get('/', (req, res) => {
        res.send(`<body style="background:#23272a;color:white;text-align:center;font-family:sans-serif;padding-top:100px;">
            <h1>🚀 Masaru Bot Dashboard</h1>
            <a href="/login" style="background:#5865F2;color:white;padding:15px 30px;text-decoration:none;border-radius:5px;">Login with Discord</a>
        </body>`);
    });

    app.get('/login', passport.authenticate('discord'));
    app.get('/auth/discord/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
        res.redirect('/profile');
    });

    app.get('/profile', async (req, res) => {
        if (!req.isAuthenticated()) return res.redirect('/');
        const data = await User.findOne({ userId: req.user.id });
        res.send(`<body style="background:#23272a;color:white;text-align:center;font-family:sans-serif;padding:50px;">
            <img src="https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png" style="border-radius:50%;width:100px;">
            <h2>ยินดีต้อนรับ ${req.user.username}</h2>
            <p>Level: ${data ? data.level : 1} | XP: ${data ? data.xp : 0}</p>
            <a href="/logout" style="color:red;">Logout</a>
        </body>`);
    });

    app.get('/logout', (req, res) => { req.logout(() => res.redirect('/')); });

    app.listen(port, () => console.log(`🌐 Web Dashboard Online on Port ${port}`));
};