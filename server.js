const express = require('express');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, 'db.json');

app.use(express.json());
app.use(express.static(__dirname));

const readDB = () => JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
const writeDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');

// --- REAL ONLINE PLAYER TRACKING ---
const activePlayers = new Map();

setInterval(() => {
    const now = Date.now();
    for (const [username, lastPing] of activePlayers.entries()) {
        if (now - lastPing > 15000) activePlayers.delete(username);
    }
}, 5000);

app.post('/api/heartbeat', (req, res) => {
    const { username } = req.body;
    if (username) activePlayers.set(username, Date.now());
    res.sendStatus(200);
});

app.get('/api/status', (req, res) => {
    res.status(200).json({ status: 'ONLINE', players: activePlayers.size });
});

// --- AUTHENTICATION & USER ROUTES ---

app.post('/api/signup', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'ACCOUNT NAME AND PASSWORD REQUIRED.' });

    const db = readDB();
    if (db.users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
        return res.status(400).json({ error: 'ACCOUNT NAME ALREADY EXISTS.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        // Add currencies to new users!
        db.users.push({ 
            username, 
            password: hashedPassword,
            sculptCoins: 50, // 50 starter coins
            diamonds: 0,
            tokens: 0
        });
        writeDB(db);
        res.status(201).json({ message: 'ACCOUNT CREATED SUCCESSFULLY!' });
    } catch (err) {
        res.status(500).json({ error: 'INTERNAL SERVER ERROR.' });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const db = readDB();
    const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());

    if (!user) return res.status(401).json({ error: 'INVALID ACCOUNT NAME OR PASSWORD.' });

    try {
        const match = await bcrypt.compare(password, user.password);
        if (match) res.status(200).json({ message: 'LOGIN SUCCESSFUL!' });
        else res.status(401).json({ error: 'INVALID ACCOUNT NAME OR PASSWORD.' });
    } catch (err) {
        res.status(500).json({ error: 'INTERNAL SERVER ERROR.' });
    }
});

// Fetch User Data for Dashboard
app.post('/api/userdata', (req, res) => {
    const { username } = req.body;
    const db = readDB();
    const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    
    if (user) {
        res.status(200).json({ sculptCoins: user.sculptCoins, diamonds: user.diamonds, tokens: user.tokens });
    } else {
        res.status(404).json({ error: 'USER NOT FOUND' });
    }
});

// Award Diamonds for the Rare 4% Welcome Message
app.post('/api/award-diamonds', (req, res) => {
    const { username, amount } = req.body;
    const db = readDB();
    const userIndex = db.users.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
    
    if (userIndex !== -1) {
        db.users[userIndex].diamonds += amount;
        writeDB(db);
        res.status(200).json({ newTotal: db.users[userIndex].diamonds });
    } else {
        res.status(404).json({ error: 'USER NOT FOUND' });
    }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'auth.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
