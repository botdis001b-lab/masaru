const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const mongoose = require('mongoose');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
const port = process.env.PORT || 8080;
const ADMIN_ID = '550122613087666177'; // ID ของพี่ที่ส่งมา

let systemLogs = [];
const addLog = (msg) => {
    const time = new Date().toLocaleString('th-TH');
    systemLogs.unshift(`[${time}] ${msg}`);
    if (systemLogs.length > 20) systemLogs.pop();
};

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', 1);

mongoose.connect(process.env.MONGO_URL).then(() => {
    addLog("Database Connected Successfully");
}).catch(err => console.error("DB Error:", err));

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
    secret: crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URL }),
    cookie: { secure: true, httpOnly: true, sameSite: 'strict', maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

app.use(passport.initialize());
app.use(passport.session());

// Middleware เช็คสิทธิ์ Admin แบบบังคับ String
app.use((req, res, next) => {
    res.locals.isAdmin = req.isAuthenticated() && String(req.user.id) === String(ADMIN_ID);
    next();
});

// --- ROUTES ---
app.get('/', (req, res) => req.isAuthenticated() ? res.redirect('/profile') : res.render('login'));
app.get('/login', passport.authenticate('discord'));
app.get('/auth/discord/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => res.redirect('/profile'));

app.get('/profile', async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/');
    const userData = await User.findOne({ userId: req.user.id }) || await User.create({ userId: req.user.id });
    const avatarUrl = `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png`;
    res.render('profile', { user: req.user, userData, avatarUrl });
});

app.get('/youtube', async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/');
    let videos = [];
    try {
        const ytUrl = `https://www.googleapis.com/youtube/v3/search?key=${process.env.YOUTUBE_API_KEY}&channelId=${process.env.YOUTUBE_CHANNEL_ID}&part=snippet,id&order=date&maxResults=3&type=video`;
        const ytRes = await axios.get(ytUrl);
        videos = ytRes.data.items;
    } catch (e) { addLog("YouTube API Error"); }
    const avatarUrl = `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png`;
    res.render('youtube', { user: req.user, avatarUrl, videos });
});

app.get('/admin', async (req, res) => {
    // เช็คสิทธิ์ซ้ำอีกรอบเพื่อความชัวร์
    if (!res.locals.isAdmin) {
        addLog(`Unauthorized access attempt: ${req.user?.username || 'Guest'} (ID: ${req.user?.id})`);
        return res.status(403).render('error', { msg: "ไม่มีสิทธิ์เข้าถึงหน้าควบคุม" });
    }
    const totalUsers = await User.countDocuments();
    const allUsers = await User.find({});
    const avatarUrl = `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png`;
    const configKeys = {
        YT_KEY: process.env.YOUTUBE_API_KEY ? "********" + process.env.YOUTUBE_API_KEY.slice(-4) : "MISSING",
        DB_URL: "CONNECTED ✅"
    };
    res.render('admin', { user: req.user, avatarUrl, totalUsers, allUsers, systemLogs, configKeys });
});

app.post('/admin/update-user', async (req, res) => {
    if (!res.locals.isAdmin) return res.status(403).send("No Permission");
    const { userId, level, xp } = req.body;
    await User.findOneAndUpdate({ userId }, { level: Number(level), xp: Number(xp) });
    addLog(`Updated User ${userId} -> Lv.${level}, XP.${xp}`);
    res.redirect('/admin');
});

app.get('/logout', (req, res) => req.logout(() => res.redirect('/')));
app.listen(port, () => console.log(`🌐 Server running on ${port}`));