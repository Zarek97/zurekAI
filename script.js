const chatDisplay = document.getElementById('chat-display');
const userQuery = document.getElementById('user-query');
const sendBtn = document.getElementById('send-btn');
const historyList = document.querySelector('.history-list');
const newChatBtn = document.querySelector('.new-chat');
const authOverlay = document.getElementById('auth-overlay');

const API_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000' : 'https://zurekai.onrender.com';

let currentUser = localStorage.getItem('logged_user') || null;
let currentUserId = localStorage.getItem('user_id') || null;
let chatHistory = [];
let currentChat = null;

async function initApp() {
    if (currentUser) {
        authOverlay.style.display = 'none';
        document.getElementById('display-username').textContent = currentUser;
        await loadChatsFromServer();
    } else {
        authOverlay.style.display = 'flex';
    }
}

async function loadChatsFromServer() {
    try {
        const res = await fetch(`${API_URL}/api/chats/${currentUserId}`);
        chatHistory = await res.json();
        renderHistoryList();
    } catch (err) {
        console.error("Błąd pobierania czatów");
    }
}

async function handleLogin() {
    const user = document.getElementById('auth-user').value.trim();
    const pass = document.getElementById('auth-pass').value.trim();
    const res = await fetch(`${API_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user, password: pass })
    });
    if (res.ok) {
        const data = await res.json();
        localStorage.setItem('logged_user', user);
        localStorage.setItem('user_id', data.userId);
        location.reload();
    }
}

async function handleRegister() {
    const user = document.getElementById('auth-user').value.trim();
    const pass = document.getElementById('auth-pass').value.trim();
    await fetch(`${API_URL}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user, password: pass })
    });
    alert("Zarejestrowano");
}

function renderMessage(type, content) {
    const div = document.createElement('div');
    div.classList.add('message', type === 'user' ? 'user-msg' : 'ai-msg');
    div.innerHTML = type === 'ai' ? `<i class="fas fa-robot"></i><div>${marked.parse(content)}</div>` : `<div>${content}</div>`;
    chatDisplay.appendChild(div);
    chatDisplay.scrollTop = chatDisplay.scrollHeight;
}

async function saveChat(chat) {
    await fetch(`${API_URL}/api/chats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...chat, userId: currentUserId })
    });
}

async function deleteChat(id, e) {
    e.stopPropagation();
    await fetch(`${API_URL}/api/chats/${id}`, { method: "DELETE" });
    chatHistory = chatHistory.filter(c => c.id !== id);
    if (currentChat && currentChat.id === id) {
        currentChat = null;
        chatDisplay.innerHTML = '';
    }
    renderHistoryList();
}

function renderHistoryList() {
    historyList.innerHTML = '';
    chatHistory.forEach(chat => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `<span>${chat.name}</span><i class="fas fa-trash" onclick="deleteChat('${chat.id}', event)"></i>`;
        item.onclick = () => { currentChat = chat; renderChat(chat); };
        historyList.appendChild(item);
    });
}

function renderChat(chat) {
    chatDisplay.innerHTML = '';
    chat.messages.forEach(m => renderMessage(m.type, m.content));
}

async function callGeminiAPI(text) {
    const typing = document.createElement('div');
    typing.className = 'message ai-msg';
    typing.innerHTML = `<i class="fas fa-robot"></i> <span>AI 2.5 myśli...</span>`;
    chatDisplay.appendChild(typing);
    
    const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
    });
    const data = await res.json();
    typing.remove();
    
    if (!currentChat) {
        currentChat = { id: Date.now().toString(), name: text.substring(0, 15), messages: [] };
        chatHistory.push(currentChat);
    }
    
    renderMessage('ai', data.reply);
    currentChat.messages.push({ type: 'user', content: text }, { type: 'ai', content: data.reply });
    await saveChat(currentChat);
    renderHistoryList();
}

function processInput() {
    const val = userQuery.value.trim();
    if (!val) return;
    renderMessage('user', val);
    userQuery.value = '';
    callGeminiAPI(val);
}

sendBtn.onclick = processInput;

userQuery.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        processInput();
    }
});

newChatBtn.onclick = () => { currentChat = null; chatDisplay.innerHTML = ''; };
initApp();