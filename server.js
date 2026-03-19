const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const mongoose = require('mongoose');
const path = require('path');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 8080;
const ADMIN_ID = '550122613087666177';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);

if (mongoose.connection.readyState === 0) {
    mongoose.connect(process.env.MONGO_URL).then(() => console.log('Web DB Connected! 📦'));
}

const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({
    userId: String, xp: { type: Number, default: 0 }, level: { type: Number, default: 1 }
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL,
    scope: ['identify']
}, (accessToken, refreshToken, profile, done) => done(null, profile)));

app.use(session({
    secret: 'masaru-v4-final',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URL }),
    cookie: { secure: true, maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

app.use(passport.initialize());
app.use(passport.session());

// --- ROUTES ---
app.get('/', (req, res) => req.isAuthenticated() ? res.redirect('/profile') : res.render('login'));
app.get('/login', passport.authenticate('discord'));
app.get('/auth/discord/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => res.redirect('/profile'));

// หน้าโปรไฟล์หลัก (โชว์เลเวล)
app.get('/profile', async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/');
    try {
        let userData = await User.findOne({ userId: req.user.id });
        if (!userData) userData = await User.create({ userId: req.user.id });
        const avatarUrl = req.user.avatar ? `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png';
        res.render('profile', { user: req.user, userData, avatarUrl, isAdmin: req.user.id === ADMIN_ID });
    } catch (err) { res.status(500).send("Error"); }
});

// หน้า YouTube แยกต่างหาก
app.get('/youtube', async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/');
    try {
        let videos = [];
        if (process.env.YOUTUBE_API_KEY && process.env.YOUTUBE_CHANNEL_ID) {
            try {
                const ytUrl = `https://www.googleapis.com/youtube/v3/search?key=${process.env.YOUTUBE_API_KEY}&channelId=${process.env.YOUTUBE_CHANNEL_ID}&part=snippet,id&order=date&maxResults=6&type=video`;
                const ytRes = await axios.get(ytUrl);
                videos = ytRes.data.items;
            } catch (e) { console.error("YT API Error"); }
        }
        const avatarUrl = req.user.avatar ? `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png';
        res.render('youtube', { user: req.user, avatarUrl, videos, isAdmin: req.user.id === ADMIN_ID });
    } catch (err) { res.status(500).send("Error"); }
});

app.get('/logout', (req, res) => req.logout(() => res.redirect('/')));
app.listen(port, () => console.log(`🌐 Server active on ${port}`));