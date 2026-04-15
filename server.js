const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const port = process.env.PORT || 8080;
const ADMIN_ID = '550122613087666177';

// --- Database Schema ---
const UserSchema = new mongoose.Schema({
    userId: String,
    username: String,
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 }
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

// --- Middleware & Session ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.set('trust proxy', 1);

app.use(session({
    secret: 'MasaruBot_Secret_2026',
    resave: true,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGO_URL })
}));

app.use(passport.initialize());
app.use(passport.session());

// --- หน้า Profile (ดูเลเวล) ---
app.get('/profile', async (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/auth/discord');
    try {
        let dbUser = await User.findOne({ userId: req.user.id });
        if (!dbUser) {
            dbUser = await User.create({ userId: req.user.id, username: req.user.username, xp: 0, level: 1 });
        }
        const avatarUrl = `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png`;
        res.render('profile', { user: req.user, dbUser, avatarUrl });
    } catch (err) {
        res.status(500).send("Profile Page Error");
    }
});

// --- ระบบ Login & Admin (คงเดิมจากที่พี่มี) ---
app.get('/auth/discord', passport.authenticate('discord'));
app.get('/auth/discord/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    res.redirect('/profile');
});

app.listen(port, () => console.log(`Dashboard running on port ${port}`));