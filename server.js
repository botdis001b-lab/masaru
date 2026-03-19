const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const port = process.env.PORT || 8080;

// ตั้งค่า EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
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
    cookie: { secure: true, maxAge: 60000 * 60 * 24 }
}));

app.use(passport.initialize());
app.use(passport.session());

// --- Routes ---
app.get('/', (req, res) => {
    if (req.isAuthenticated()) return res.redirect('/profile');
    res.render('login'); // ดึงไฟล์ views/login.ejs
});

app.get('/login', passport.authenticate('discord'));

app.get('/auth/discord/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    res.redirect('/profile');
});

app.get('/profile', async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/');
    try {
        const userData = await User.findOne({ userId: req.user.id }) || { xp: 0, level: 1 };
        const avatarUrl = req.user.avatar 
            ? `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png` 
            : 'https://cdn.discordapp.com/embed/avatars/0.png';
        
        res.render('profile', { 
            user: req.user, 
            userData: userData, 
            avatarUrl: avatarUrl,
            currentPage: 'profile' 
        });
    } catch (err) { res.status(500).send("DB Error"); }
});

app.get('/logout', (req, res) => { req.logout(() => res.redirect('/')); });

app.listen(port, () => console.log(`🌐 Web Dashboard Online on Port ${port}`));