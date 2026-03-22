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
const ADMIN_ID = '550122613087666177'; // ID ของพี่

// ระบบ Log ภายใน
let systemLogs = [];
const addLog = (msg) => {
    const time = new Date().toLocaleString('th-TH');
    systemLogs.unshift(`[${time}] ${msg}`);
    if (systemLogs.length > 20) systemLogs.pop();
};

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));

// --- ส่วนที่ 1: การตั้งค่า Proxy และ Session (แก้ปัญหา Login Loop) ---
app.set('trust proxy', 1); // บังคับใช้เพราะ Railway อยู่หลัง Reverse Proxy

app.use(session({
    secret: 'MasaruBot_Permanent_Secret_Key_2026', 
    resave: true, // เปลี่ยนเป็น true เพื่อให้ Session มีการอัปเดตตลอด
    saveUninitialized: false,
    store: MongoStore.create({ 
        mongoUrl: process.env.MONGO_URL,
        ttl: 14 * 24 * 60 * 60 
    }),
    cookie: { 
        secure: true, // ต้องเป็น true เมื่อรันบน https ของ Railway
        httpOnly: true,
        sameSite: 'lax', // เปลี่ยนจาก strict เป็น lax เพื่อให้ Browser ยอมรับ Cookie หลังกลับจาก Discord
        maxAge: 1000 * 60 * 60 * 24 * 14 
    }
}));

// --- ส่วนที่ 2: เชื่อมต่อ Database ---
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
}, (accessToken, refreshToken, profile, done) => {
    console.log(`[Login] Attempt from ${profile.username} (${profile.id})`);
    return done(null, profile);
}));

app.use(passport.initialize());
app.use(passport.session());

// Middleware เช็คสิทธิ์ Admin
app.use((req, res, next) => {
    res.locals.isAdmin = req.isAuthenticated() && String(req.user.id) === String(ADMIN_ID);
    next();
});

// --- ส่วนที่ 3: Routes (ปรับปรุงการ Redirect) ---
app.get('/', (req, res) => {
    if (req.isAuthenticated()) return res.redirect('/profile');
    res.render('login');
});

app.get('/login', passport.authenticate('discord'));

app.get('/auth/discord/callback', 
    passport.authenticate('discord', { failureRedirect: '/' }), 
    (req, res) => {
        // บังคับเซฟ Session ก่อนจะเปลี่ยนหน้า เพื่อป้องกันข้อมูลหายระหว่างทาง
        req.session.save((err) => {
            if (err) {
                console.error("Session Save Error:", err);
                return res.redirect('/');
            }
            res.redirect('/profile');
        });
    }
);

app.get('/profile', async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/');
    try {
        const userData = await User.findOne({ userId: req.user.id }) || await User.create({ userId: req.user.id });
        const avatarUrl = `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png`;
        res.render('profile', { user: req.user, userData, avatarUrl });
    } catch (err) {
        res.redirect('/');
    }
});

app.get('/admin', async (req, res) => {
    if (!res.locals.isAdmin) {
        addLog(`Access Denied: ${req.user?.username || 'Unknown'} (${req.user?.id || 'N/A'})`);
        return res.status(403).render('error', { msg: "ไม่มีสิทธิ์เข้าถึงหน้าควบคุม" });
    }
    try {
        const totalUsers = await User.countDocuments();
        const allUsers = await User.find({});
        const avatarUrl = `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png`;
        const configKeys = {
            YT_KEY: process.env.YOUTUBE_API_KEY ? "********" + process.env.YOUTUBE_API_KEY.slice(-4) : "MISSING",
            DB_URL: "CONNECTED ✅"
        };
        res.render('admin', { user: req.user, avatarUrl, totalUsers, allUsers, systemLogs, configKeys });
    } catch (err) {
        res.status(500).send("Admin Page Error");
    }
});

app.post('/admin/update-user', async (req, res) => {
    if (!res.locals.isAdmin) return res.status(403).send("No Permission");
    const { userId, level, xp } = req.body;
    await User.findOneAndUpdate({ userId }, { level: Number(level), xp: Number(xp) });
    addLog(`Updated User ${userId} -> Lv.${level}, XP.${xp}`);
    res.redirect('/admin');
});

app.get('/logout', (req, res) => {
    req.logout(() => {
        req.session.destroy(); // ล้าง Session ทั้งหมดเมื่อออก
        res.redirect('/');
    });
});

app.listen(port, () => console.log(`🌐 Server running on port ${port}`));