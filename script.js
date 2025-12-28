const chatDisplay = document.getElementById('chat-display');
const userQuery = document.getElementById('user-query');
const sendBtn = document.getElementById('send-btn');
const historyList = document.querySelector('.history-list');
const newChatBtn = document.querySelector('.new-chat');
const authOverlay = document.getElementById('auth-overlay');
const startWebcamBtn = document.getElementById('start-webcam-btn');

const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:3000' 
    : 'https://zurekai.onrender.com';

let currentUser = localStorage.getItem('logged_user') || null;
let chatHistory = JSON.parse(localStorage.getItem(`history_${currentUser}`)) || [];
let currentChat = null;

let model, webcam, labelContainer, maxPredictions;
let lastDetectedClass = "";
let detectionActive = true;

function initApp() {
    if (currentUser) {
        authOverlay.style.display = 'none';
        document.getElementById('display-username').textContent = currentUser;
        loadHistory();
    } else {
        authOverlay.style.display = 'flex';
    }
}

async function initTeachableMachine() {
    startWebcamBtn.disabled = true;
    startWebcamBtn.textContent = "ŁADOWANIE...";
    
    const URL = "https://teachablemachine.withgoogle.com/models/TWÓJ_ID_MODELU/";
    const modelURL = URL + "model.json";
    const metadataURL = URL + "metadata.json";

    try {
        model = await tmImage.load(modelURL, metadataURL);
        maxPredictions = model.getTotalClasses();

        webcam = new tmImage.Webcam(150, 150, true);
        await webcam.setup();
        await webcam.play();
        
        document.getElementById("webcam-container").innerHTML = "";
        document.getElementById("webcam-container").appendChild(webcam.canvas);
        labelContainer = document.getElementById("label-container");
        
        startWebcamBtn.style.display = "none";
        window.requestAnimationFrame(loop);
    } catch (e) {
        alert("Błąd kamery: " + e.message);
        startWebcamBtn.disabled = false;
        startWebcamBtn.textContent = "SPRÓBUJ PONOWNIE";
    }
}

async function loop() {
    webcam.update();
    await predict();
    window.requestAnimationFrame(loop);
}

async function predict() {
    const prediction = await model.predict(webcam.canvas);
    let highestProb = 0;
    let currentClass = "";

    for (let i = 0; i < maxPredictions; i++) {
        if (prediction[i].probability > highestProb) {
            highestProb = prediction[i].probability;
            currentClass = prediction[i].className;
        }
    }

    labelContainer.innerHTML = currentClass + ": " + (highestProb * 100).toFixed(0) + "%";

    if (highestProb > 0.98 && currentClass !== lastDetectedClass && currentClass !== "Background" && detectionActive) {
        lastDetectedClass = currentClass;
        detectionActive = false;
        
        const msg = "Widzę teraz: " + currentClass + ". Co możesz o tym powiedzieć?";
        renderMessage('user', msg);
        saveToHistory('user', msg);
        callGeminiAPI(msg);

        setTimeout(() => { detectionActive = true; }, 7000);
    }
}

async function handleLogin() {
    const user = document.getElementById('auth-user').value.trim();
    const pass = document.getElementById('auth-pass').value.trim();
    if (!user || !pass) return;
    try {
        const res = await fetch(`${API_URL}/api/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: user, password: pass })
        });
        if (res.ok) {
            localStorage.setItem('logged_user', user);
            location.reload(); 
        } else {
            alert("Błąd logowania");
        }
    } catch (err) {
        alert("Serwer nie odpowiada");
    }
}

async function handleRegister() {
    const user = document.getElementById('auth-user').value.trim();
    const pass = document.getElementById('auth-pass').value.trim();
    if (!user || !pass) return;
    try {
        const res = await fetch(`${API_URL}/api/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: user, password: pass })
        });
        if (res.ok) alert("Konto OK");
    } catch (err) {
        alert("Błąd rejestracji");
    }
}

function logout() {
    localStorage.removeItem('logged_user');
    location.reload();
}

function renderMessage(type, content) {
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
        currentChat = { id: Date.now(), name: content.substring(0, 15), messages: [] };
        chatHistory.push(currentChat);
    }
    currentChat.messages.push({ type, content });
    localStorage.setItem(`history_${currentUser}`, JSON.stringify(chatHistory));
    renderHistoryList();
}

function renderHistoryList() {
    if (!historyList) return;
    historyList.innerHTML = '';
    chatHistory.forEach((chat) => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.textContent = chat.name;
        item.onclick = () => { currentChat = chat; renderChat(chat); };
        historyList.appendChild(item);
    });
}

function renderChat(chat) {
    chatDisplay.innerHTML = '';
    chat.messages.forEach(msg => renderMessage(msg.type, msg.content));
}

async function callGeminiAPI(text) {
    const typing = document.createElement('div');
    typing.className = 'message ai-msg';
    typing.innerHTML = `<i class="fas fa-robot"></i> <span class="typing">AI 2.5 myśli...</span>`;
    chatDisplay.appendChild(typing);
    try {
        const res = await fetch(`${API_URL}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: text })
        });
        const data = await res.json();
        typing.remove();
        renderMessage('ai', data.reply);
        saveToHistory('ai', data.reply);
    } catch (err) {
        typing.remove();
        renderMessage('ai', "Błąd połączenia z AI");
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

if (startWebcamBtn) startWebcamBtn.onclick = initTeachableMachine;
if (sendBtn) sendBtn.onclick = processInput;
if (userQuery) userQuery.onkeydown = e => { if (e.key === 'Enter') processInput(); };
if (newChatBtn) newChatBtn.onclick = () => { currentChat = null; chatDisplay.innerHTML = ''; };

initApp();