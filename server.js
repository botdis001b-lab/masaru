const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const port = process.env.PORT || 8080;

// --- [CONFIG] ---
const ADMIN_ID = '550122613087666177';

// ตั้งค่า View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1); 

// เชื่อมต่อ MongoDB
mongoose.connect(process.env.MONGO_URL)
    .then(() => console.log('Web DB Connected! 📦'))
    .catch(err => console.error('❌ MongoDB Connection Fail:', err));

// Schema สำหรับ User
const userSchema = new mongoose.Schema({
    userId: String,
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 }
});
const User = mongoose.models.User || mongoose.model('User', userSchema);

// Passport Setup
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID,
    clientSecret: process.env.DISCORD_CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL,
    scope: ['identify']
}, (accessToken, refreshToken, profile, done) => {
    return done(null, profile);
}));

app.use(session({
    secret: 'masaru-admin-secure-v3',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: true, maxAge: 60000 * 60 * 24 }
}));

app.use(passport.initialize());
app.use(passport.session());

// --- [MIDDLEWARE] ---
const isAdmin = (req, res, next) => {
    if (req.isAuthenticated() && req.user.id === ADMIN_ID) {
        return next();
    }
    res.status(403).send('🔒 Access Denied: เฉพาะเจ้าของบอท ID 550122613087666177 เท่านั้นที่เข้าได้');
};

// --- [ROUTES] ---
app.get('/', (req, res) => {
    if (req.isAuthenticated()) return res.redirect('/profile');
    res.render('login');
});

app.get('/login', passport.authenticate('discord'));

app.get('/auth/discord/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    res.redirect('/profile');
});

app.get('/profile', async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/');
    try {
        // หาข้อมูล หรือสร้างใหม่ถ้าไม่มี
        let userData = await User.findOne({ userId: req.user.id });
        if (!userData) {
            userData = await User.create({ userId: req.user.id, xp: 0, level: 1 });
        }
        
        const avatarUrl = req.user.avatar 
            ? `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png` 
            : 'https://cdn.discordapp.com/embed/avatars/0.png';
        
        res.render('profile', { 
            user: req.user, 
            userData: userData, 
            avatarUrl: avatarUrl,
            currentPage: 'profile',
            isAdmin: req.user.id === ADMIN_ID 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Database Error");
    }
});

// หน้า Admin (เข้าได้เฉพาะพี่)
app.get('/admin/manage', isAdmin, (req, res) => {
    // ส่งตัวแปรที่จำเป็นไปให้หน้า admin_panel.ejs ด้วย
    res.render('admin_panel', { 
        user: req.user, 
        currentPage: 'admin',
        isAdmin: true 
    });
});

app.get('/logout', (req, res) => {
    req.logout(() => res.redirect('/'));
});

// จัดการกรณี Error 404 (หาหน้าไม่เจอ)
app.use((req, res) => {
    res.status(404).send('ไม่พบหน้านี้ในระบบ Masaru Bot');
});

app.listen(port, () => console.log(`🌐 Web Dashboard Online on Port ${port}`));