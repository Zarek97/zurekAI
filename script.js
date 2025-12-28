const chatDisplay = document.getElementById('chat-display');
const userQuery = document.getElementById('user-query');
const sendBtn = document.getElementById('send-btn');
const historyList = document.querySelector('.history-list');
const newChatBtn = document.querySelector('.new-chat');
const authOverlay = document.getElementById('auth-overlay');

let currentUser = localStorage.getItem('logged_user') || null;
let chatHistory = JSON.parse(localStorage.getItem(`history_${currentUser}`)) || [];
let currentChat = null;


function initApp() {
    if (currentUser) {
        authOverlay.style.display = 'none';
        document.getElementById('display-username').textContent = currentUser;
        loadHistory();
    } else {
        authOverlay.style.display = 'flex';
    }
}

async function handleLogin() {
    const user = document.getElementById('auth-user').value.trim();
    const pass = document.getElementById('auth-pass').value.trim();

    if (!user || !pass) return alert("Uzupełnij pola!");

    try {
        const res = await fetch("http://localhost:3000/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: user, password: pass })
        });

        if (res.ok) {
            localStorage.setItem('logged_user', user);
            currentUser = user;
            authOverlay.style.display = 'none';
            location.reload(); 
        } else {
            const errorData = await res.json();
            alert(errorData.error || "Błąd logowania");
        }
    } catch (err) {
        alert("Brak połączenia z serwerem (sprawdź czy node server.js działa)");
    }
}

async function handleRegister() {
    const user = document.getElementById('auth-user').value.trim();
    const pass = document.getElementById('auth-pass').value.trim();

    if (!user || !pass) return alert("Uzupełnij pola!");

    try {
        const res = await fetch("http://localhost:3000/api/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: user, password: pass })
        });

        const data = await res.json();
        if (res.ok) {
            alert("Konto utworzone! Możesz się zalogować.");
        } else {
            alert(data.error);
        }
    } catch (err) {
        alert("Błąd serwera");
    }
}

function logout() {
    localStorage.removeItem('logged_user');
    location.reload();
}

function renderMessage(type, content) {
    const chatDisplay = document.getElementById('chat-display');
    const div = document.createElement('div');
    div.classList.add('message', type === 'user' ? 'user-msg' : 'ai-msg');
    
    if (type === 'ai') {
        const finalContent = typeof marked !== 'undefined' ? marked.parse(content) : content;
        div.innerHTML = `<i class="fas fa-robot"></i><div class="ai-content">${finalContent}</div>`;
    } else {
        div.innerHTML = `<div class="user-msg-content">${content}</div>`;
    }
    
    chatDisplay.appendChild(div);
    chatDisplay.scrollTop = chatDisplay.scrollHeight;
}

function saveToHistory(type, content) {
    if (!currentChat) {
        currentChat = { 
            id: Date.now(), 
            name: type === 'user' ? content.substring(0, 25) : "Nowy czat", 
            messages: [] 
        };
        chatHistory.push(currentChat);
    }
    currentChat.messages.push({ type, content });
    localStorage.setItem(`history_${currentUser}`, JSON.stringify(chatHistory));
    renderHistoryList();
}

function renderHistoryList() {
    if (!historyList) return;
    historyList.innerHTML = '';
    chatHistory.forEach((chat, index) => {
        const container = document.createElement('div');
        container.className = `history-item-container ${currentChat === chat ? 'active' : ''}`;
        
        const item = document.createElement('div');
        item.className = 'history-item';
        item.textContent = chat.name;
        item.onclick = () => { currentChat = chat; renderChat(chat); renderHistoryList(); };

        const del = document.createElement('i');
        del.className = 'fas fa-trash delete-chat-btn';
        del.onclick = (e) => {
            e.stopPropagation();
            chatHistory.splice(index, 1);
            if (currentChat === chat) { currentChat = null; chatDisplay.innerHTML = ''; }
            localStorage.setItem(`history_${currentUser}`, JSON.stringify(chatHistory));
            renderHistoryList();
        };

        container.append(item, del);
        historyList.appendChild(container);
    });
}

function renderChat(chat) {
    chatDisplay.innerHTML = '';
    chat.messages.forEach(msg => renderMessage(msg.type, msg.content));
}

async function callGeminiAPI(text) {
    const typing = document.createElement('div');
    typing.className = 'message ai-msg';
    typing.innerHTML = `<i class="fas fa-robot"></i> <span class="typing">AI myśli...</span>`;
    chatDisplay.appendChild(typing);
    chatDisplay.scrollTop = chatDisplay.scrollHeight;

    try {
        const res = await fetch("http://localhost:3000/api/chat", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({ text: text })
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || "Błąd serwera");
        }

        const data = await res.json();
        typing.remove();
        renderMessage('ai', data.reply);
        saveToHistory('ai', data.reply);
    } catch (err) {
        typing.remove();
        console.error("Szczegóły błędu:", err);
        renderMessage('ai', "Błąd połączenia: " + err.message);
    }
}

function processInput() {
    const val = userQuery.value.trim();
    if (!val) return;
    renderMessage('user', val);
    saveToHistory('user', val);
    userQuery.value = '';
    callGeminiAPI(val);
}

if (sendBtn) sendBtn.onclick = processInput;
if (userQuery) userQuery.onkeydown = e => { if (e.key === 'Enter') processInput(); };
if (newChatBtn) newChatBtn.onclick = () => { currentChat = null; chatDisplay.innerHTML = ''; renderHistoryList(); };

function loadHistory() { renderHistoryList(); if (currentChat) renderChat(currentChat); }

initApp();