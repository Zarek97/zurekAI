require('dotenv').config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const fetch = require("node-fetch");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const OPENROUTER_KEY = process.env.OPENROUTER_KEY;
let db;

const isLocal = process.env.NODE_ENV !== 'production' && !process.env.RENDER;
const dbDir = isLocal ? path.join(__dirname, "data") : "/data";
const dbPath = path.join(dbDir, "database.db");

if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

(async () => {
    try {
        db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });
        await db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT, 
                username TEXT UNIQUE, 
                password TEXT
            );
            CREATE TABLE IF NOT EXISTS chats (
                id TEXT PRIMARY KEY, 
                user_id INTEGER, 
                name TEXT, 
                messages TEXT,
                FOREIGN KEY(user_id) REFERENCES users(id)
            );
        `);
        
        const users = await db.all("SELECT * FROM users");
        console.log("--- BAZA DANYCH (" + (isLocal ? "LOKALNA" : "SERWER") + ") ---");
        console.table(users);
        
        console.log("SERWER GOTOWY");
    } catch (err) {
        console.error(err);
    }
})();

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post("/api/register", async (req, res) => {
    const { username, password } = req.body;
    try {
        console.log("REJESTRACJA -> Login: " + username + " | Hasło: " + password);
        const hashed = await bcrypt.hash(password, 10);
        await db.run("INSERT INTO users (username, password) VALUES (?, ?)", [username, hashed]);
        res.json({ success: true });
    } catch (err) {
        res.status(400).json({ error: "Błąd" });
    }
});

app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    try {
        console.log("LOGOWANIE -> Login: " + username + " | Hasło: " + password);
        const user = await db.get("SELECT * FROM users WHERE username = ?", [username]);
        if (user && await bcrypt.compare(password, user.password)) {
            res.json({ success: true, userId: user.id });
        } else {
            res.status(401).json({ error: "Błąd" });
        }
    } catch (err) {
        res.status(500).json({ error: "Błąd" });
    }
});

app.get("/api/chats/:userId", async (req, res) => {
    try {
        const chats = await db.all("SELECT * FROM chats WHERE user_id = ?", [req.params.userId]);
        const formatted = chats.map(c => ({ ...c, messages: JSON.parse(c.messages) }));
        res.json(formatted);
    } catch (err) {
        res.status(500).json({ error: "Błąd" });
    }
});

app.post("/api/chats", async (req, res) => {
    const { id, userId, name, messages } = req.body;
    try {
        await db.run(
            "INSERT OR REPLACE INTO chats (id, user_id, name, messages) VALUES (?, ?, ?, ?)",
            [id, userId, name, JSON.stringify(messages)]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Błąd" });
    }
});

app.delete("/api/chats/:id", async (req, res) => {
    try {
        await db.run("DELETE FROM chats WHERE id = ?", [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Błąd" });
    }
});

app.post("/api/chat", async (req, res) => {
    const { text } = req.body;
    const lowerText = text.toLowerCase();

    if (
        (lowerText.includes("kto") && lowerText.includes("stworzył")) || 
        (lowerText.includes("kto") && lowerText.includes("zrobił")) || 
        lowerText.includes("twórca") || 
        lowerText.includes("twórcą") ||
        lowerText.includes("autorem")
    ) {
        return res.json({ reply: "Żurek mnie stworzył." });
    }

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: { 
                "Authorization": `Bearer ${OPENROUTER_KEY}`, 
                "Content-Type": "application/json" 
            },
            body: JSON.stringify({ 
                "model": "deepseek/deepseek-chat", 
                "messages": [{ "role": "user", "content": text }] 
            })
        });
        const data = await response.json();
        res.json({ reply: data.choices[0].message.content });
    } catch (err) {
        res.status(500).json({ error: "Błąd AI" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT);