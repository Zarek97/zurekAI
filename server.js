require('dotenv').config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const fetch = require("node-fetch");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const OPENROUTER_KEY = process.env.OPENROUTER_KEY;
let db;

(async () => {
    try {
        db = await open({
            filename: "./database.db",
            driver: sqlite3.Database
        });
        await db.exec(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT)`);
        console.log("SERWER GOTOWY DO DEPLOYA");
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
        const user = await db.get("SELECT * FROM users WHERE username = ?", [username]);
        if (user && await bcrypt.compare(password, user.password)) {
            res.json({ success: true });
        } else {
            res.status(401).json({ error: "Błąd" });
        }
    } catch (err) {
        res.status(500).json({ error: "Błąd" });
    }
});

app.post("/api/chat", async (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: "Brak tekstu" });
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
app.listen(PORT, () => {
    console.log("Nasłuchiwanie na porcie " + PORT);
});