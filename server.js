const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const port = process.env.PORT || 8080;

// --- [DEBUG] เช็กตำแหน่งไฟล์ป้องกัน View Error ---
console.log('📁 Current Directory:', __dirname);
console.log('📁 Views Directory:', path.join(__dirname, 'views'));

// ตั้งค่า View Engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1); 

// เชื่อมต่อ MongoDB พร้อมระบบแจ้งเตือน
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

app.use(session({
    secret: 'masaru-safe-v2',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: true, maxAge: 60000 * 60 * 24 }
}));

app.use(passport.initialize());
app.use(passport.session());

// --- [Routes] ---
app.get('/', (req, res) => {
    if (req.isAuthenticated()) return res.redirect('/profile');
    res.render('login', (err, html) => {
        if (err) {
            console.error('❌ Render Login Error:', err);
            return res.status(500).send(`Render Error: ${err.message}. Check if views/login.ejs exists.`);
        }
        res.send(html);
    });
});

app.get('/login', (req, res, next) => {
    console.log('🔄 Starting Discord Auth...');
    passport.authenticate('discord')(req, res, next);
});

app.get('/auth/discord/callback', (req, res, next) => {
    passport.authenticate('discord', (err, user, info) => {
        if (err) {
            console.error('❌ Auth Callback Error:', err);
            return res.status(500).send(`Auth Error: ${err.message}`);
        }
        if (!user) return res.redirect('/');
        req.logIn(user, (err) => {
            if (err) return next(err);
            res.redirect('/profile');
        });
    })(req, res, next);
});

app.get('/profile', async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/');
    try {
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
            currentPage: 'profile' 
        });
    } catch (err) {
        console.error('❌ Profile Load Error:', err);
        res.status(500).send(`DB Error: ${err.message}`);
    }
});

app.get('/logout', (req, res) => {
    req.logout(() => res.redirect('/'));
});

// ดักจับ Error รวม
app.use((err, req, res, next) => {
    console.error('🔥 Global Bug Catch:', err.stack);
    res.status(500).send(`Something went wrong: ${err.message}`);
});

app.listen(port, () => console.log(`🌐 Web Dashboard Online on Port ${port}`));