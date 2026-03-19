const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const port = process.env.PORT || 8080;

// --- [CONFIG] ---
const ADMIN_ID = '550122613087666177';

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1); // สำคัญมากสำหรับ Railway เพื่อให้ Cookie ทำงาน

// เชื่อมต่อ MongoDB
mongoose.connect(process.env.MONGO_URL)
    .then(() => console.log('Web DB Connected! 📦'))
    .catch(err => console.error('❌ MongoDB Connection Fail:', err));

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
    return done(null, profile);
}));

// --- [SESSION STORAGE] ---
// เปลี่ยนมาใช้ MongoStore เพื่อจดจำการ Login แม้จะรีเฟรชหน้าเว็บ
app.use(session({
    secret: 'masaru-super-secret-v4',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URL,
        ttl: 14 * 24 * 60 * 60 // จำไว้ 14 วัน
    }),
    cookie: { 
        secure: true, 
        maxAge: 1000 * 60 * 60 * 24 * 14 
    }
}));

app.use(passport.initialize());
app.use(passport.session());

// --- [MIDDLEWARE] ---
const isAdmin = (req, res, next) => {
    if (req.isAuthenticated() && req.user.id === ADMIN_ID) return next();
    res.status(403).send('🔒 เฉพาะเจ้าของบอทเท่านั้นที่เข้าถึงได้');
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
        let userData = await User.findOne({ userId: req.user.id });
        if (!userData) userData = await User.create({ userId: req.user.id, xp: 0, level: 1 });
        
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
    } catch (err) { res.status(500).send("DB Error"); }
});

app.get('/admin/manage', isAdmin, (req, res) => {
    res.render('admin_panel', { user: req.user, currentPage: 'admin', isAdmin: true });
});

app.get('/logout', (req, res) => {
    req.logout(() => res.redirect('/'));
});

app.listen(port, () => console.log(`🌐 Web Dashboard Online on Port ${port}`));