const express = require('express');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, 'db.json');

// Middleware to parse JSON and serve static files
app.use(express.json());
app.use(express.static(__dirname));

// Helper function to read the database
const readDB = () => {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
};

// Helper function to write to the database
const writeDB = (data) => {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
};

// Sign Up Route
app.post('/api/signup', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }

    const db = readDB();
    const userExists = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());

    if (userExists) {
        return res.status(400).json({ error: 'Username already exists.' });
    }

    try {
        // Hash the password with a salt round of 10
        const hashedPassword = await bcrypt.hash(password, 10);
        
        db.users.push({ username, password: hashedPassword });
        writeDB(db);

        res.status(201).json({ message: 'Account created successfully!' });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Login Route
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }

    const db = readDB();
    const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());

    if (!user) {
        return res.status(401).json({ error: 'Invalid username or password.' });
    }

    try {
        // Compare the provided password with the hashed password in db.json
        const match = await bcrypt.compare(password, user.password);
        
        if (match) {
            res.status(200).json({ message: 'Login successful! Welcome to Playsculpt.' });
        } else {
            res.status(401).json({ error: 'Invalid username or password.' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});


// --- NEW SERVER STATUS ROUTE ---
// --- REAL ONLINE PLAYER TRACKING ---
const activePlayers = new Map(); // Stores username and their last ping time

// Cleanup routine: Check every 5 seconds for players who disconnected
setInterval(() => {
    const now = Date.now();
    for (const [username, lastPing] of activePlayers.entries()) {
        // If we haven't heard from them in 15 seconds, remove them
        if (now - lastPing > 15000) {
            activePlayers.delete(username);
        }
    }
}, 5000);

// Heartbeat Route: Players ping this to stay "online"
app.post('/api/heartbeat', (req, res) => {
    const { username } = req.body;
    if (username) {
        activePlayers.set(username, Date.now()); // Update their last seen time
    }
    res.sendStatus(200);
});

// Server Status Route: Now returns actual player count
app.get('/api/status', (req, res) => {
    res.status(200).json({
        status: 'ONLINE',
        players: activePlayers.size // Counts real active players in the Map
    });
});

// Route to serve auth.html as the main entry point for this test
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'auth.html'));
});


app.listen(PORT, () => {
    console.log(`Playsculpt server running at http://localhost:${PORT}`);
});