import * as THREE from 'three';

// ==================== 3D SCENE SETUP ====================
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050510);
scene.fog = new THREE.FogExp2(0x050510, 0.003);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 2, 8);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
container.appendChild(renderer.domElement);

// Lights
const ambientLight = new THREE.AmbientLight(0x404060);
scene.add(ambientLight);
const pointLight = new THREE.PointLight(0xffffff, 1);
pointLight.position.set(5, 5, 5);
scene.add(pointLight);
const backLight = new THREE.PointLight(0x2266ff, 0.5);
backLight.position.set(-3, 2, -4);
scene.add(backLight);

// Central geometric object – Icosahedron with wireframe + inner glow
const geometry = new THREE.IcosahedronGeometry(1.2, 0);
const material = new THREE.MeshStandardMaterial({
    color: 0x33aaff,
    emissive: 0x1155aa,
    roughness: 0.3,
    metalness: 0.8,
    flatShading: false
});
const core = new THREE.Mesh(geometry, material);
scene.add(core);

// Wireframe overlay
const wireframeMat = new THREE.MeshBasicMaterial({ color: 0x88ccff, wireframe: true, transparent: true, opacity: 0.3 });
const wireframe = new THREE.Mesh(geometry, wireframeMat);
core.add(wireframe);

// Orbiting rings
const ringGeo = new THREE.TorusGeometry(1.8, 0.05, 64, 200);
const ringMat = new THREE.MeshStandardMaterial({ color: 0x44aaff, emissive: 0x2266aa });
const ring = new THREE.Mesh(ringGeo, ringMat);
ring.rotation.x = Math.PI / 2;
scene.add(ring);

const ring2Geo = new THREE.TorusGeometry(2.0, 0.04, 64, 200);
const ring2Mat = new THREE.MeshStandardMaterial({ color: 0xff44aa, emissive: 0x551133 });
const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
ring2.rotation.z = Math.PI / 3;
ring2.rotation.x = Math.PI / 4;
scene.add(ring2);

// Particle system (stars)
const particleCount = 1500;
const particlesGeometry = new THREE.BufferGeometry();
const positions = new Float32Array(particleCount * 3);
for (let i = 0; i < particleCount; i++) {
    positions[i*3] = (Math.random() - 0.5) * 200;
    positions[i*3+1] = (Math.random() - 0.5) * 100;
    positions[i*3+2] = (Math.random() - 0.5) * 80 - 40;
}
particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
const particlesMat = new THREE.PointsMaterial({ color: 0x88aaff, size: 0.1, transparent: true, opacity: 0.6 });
const particles = new THREE.Points(particlesGeometry, particlesMat);
scene.add(particles);

// Simple animation loop
let time = 0;
function animate() {
    requestAnimationFrame(animate);
    time += 0.008;
    core.rotation.y = time * 0.6;
    core.rotation.x = Math.sin(time * 0.3) * 0.2;
    wireframe.rotation.y = core.rotation.y;
    wireframe.rotation.x = core.rotation.x;
    ring.rotation.z += 0.005;
    ring2.rotation.x += 0.003;
    ring2.rotation.y += 0.004;
    particles.rotation.y += 0.0005;
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
}
animate();

// Handle window resize
window.addEventListener('resize', onWindowResize, false);
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// ==================== AI AGENT LOGIC ====================
// DOM elements
const chatArea = document.getElementById('chat-area');
const commandInput = document.getElementById('command-input');
const sendBtn = document.getElementById('send-btn');
const micBtn = document.getElementById('mic-btn');
const statusSpan = document.getElementById('status-text');

// Data storage
let notes = JSON.parse(localStorage.getItem('emergentNotes') || '[]');
let reminders = JSON.parse(localStorage.getItem('emergentReminders') || '[]');

// Helper: add message to chat
function addMessage(text, isUser = false) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isUser ? 'user-message' : 'ai-message'}`;
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.innerHTML = isUser ? `<i class="fas fa-user"></i> ${text}` : `<i class="fas fa-robot"></i> ${text}`;
    msgDiv.appendChild(bubble);
    chatArea.appendChild(msgDiv);
    chatArea.scrollTop = chatArea.scrollHeight;
}

// Text to speech
function speak(text) {
    if (!window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
}

// Helper: evaluate math safely
function evaluateMath(expr) {
    try {
        // allow only digits, operators, parentheses, spaces, and decimal point
        if (!/^[\d+\-*/()\s.]+$/.test(expr)) return null;
        const result = Function(`'use strict'; return (${expr})`)();
        return isNaN(result) ? null : result;
    } catch {
        return null;
    }
}

// Fetch Wikipedia summary
async function fetchWikiSummary(topic) {
    try {
        const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        return data.extract || "No summary found.";
    } catch {
        return "Could not fetch Wikipedia summary. Check your internet connection.";
    }
}

// Main command processor
async function processCommand(cmd) {
    const lower = cmd.toLowerCase().trim();
    addMessage(cmd, true);
    
    // Open website
    if (lower.startsWith("open ")) {
        let site = lower.replace("open ", "");
        let url = site.includes('.') ? `https://${site}` : `https://${site.replace(/\s/g, "")}.com`;
        window.open(url, "_blank");
        speak(`Opening ${site}`);
        addMessage(`Opened ${site}`, false);
        return;
    }
    
    // Search Google
    if (lower.startsWith("search for ") || lower.startsWith("search ")) {
        let query = lower.replace(/search for |search /, "");
        if (query) {
            window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, "_blank");
            speak(`Searching for ${query}`);
            addMessage(`🔍 Searching "${query}" on Google`, false);
        } else {
            speak("What should I search?");
            addMessage("❓ Please specify a search term", false);
        }
        return;
    }
    
    // Time & Date
    if (lower.includes("time") && (lower === "time" || lower.includes("what"))) {
        let now = new Date();
        let timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        let dateStr = now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
        speak(`The time is ${timeStr} on ${dateStr}`);
        addMessage(`⏱️ ${dateStr} — ${timeStr}`, false);
        return;
    }
    
    // Jokes
    if (lower.includes("joke")) {
        const jokes = [
            "Why do programmers prefer dark mode? Because light attracts bugs.",
            "What's a computer's favorite beat? An algorithm.",
            "Why did the AI go to art school? To learn how to draw neural networks.",
            "I asked my computer for a joke, and it said: 'You're the joke.' Ouch."
        ];
        let joke = jokes[Math.floor(Math.random() * jokes.length)];
        speak(joke);
        addMessage(`😂 ${joke}`, false);
        return;
    }
    
    // Weather (simulated)
    if (lower.includes("weather")) {
        let conditions = ["☀️ Sunny", "🌤️ Partly cloudy", "🌧️ Light rain", "❄️ Snow flurries", "🌙 Clear night"];
        let temps = [18, 22, 25, 15, 20];
        let idx = Math.floor(Math.random() * conditions.length);
        let msg = `${conditions[idx]}, ${temps[idx]}°C. Feels like cyberpunk weather.`;
        speak(msg);
        addMessage(`🌡️ ${msg}`, false);
        return;
    }
    
    // Notes
    if (lower.startsWith("note ")) {
        let noteText = lower.replace("note ", "");
        notes.push(noteText);
        localStorage.setItem('emergentNotes', JSON.stringify(notes));
        addMessage(`📝 Note saved: "${noteText}"`, false);
        speak("Note saved");
        return;
    }
    if (lower === "notes") {
        if (notes.length === 0) addMessage("📭 No notes yet. Use 'note ...'", false);
        else notes.forEach((n, i) => addMessage(`${i+1}. ${n}`, false));
        speak(`You have ${notes.length} notes`);
        return;
    }
    if (lower === "clear notes") {
        notes = [];
        localStorage.setItem('emergentNotes', '[]');
        addMessage("🗑️ All notes cleared.", false);
        speak("Notes cleared");
        return;
    }
    
    // Reminders
    if (lower.startsWith("remind me to ")) {
        let reminder = lower.replace("remind me to ", "");
        reminders.push(reminder);
        localStorage.setItem('emergentReminders', JSON.stringify(reminders));
        addMessage(`⏰ Reminder set: "${reminder}"`, false);
        speak(`I'll remind you: ${reminder}`);
        return;
    }
    if (lower === "reminders") {
        if (reminders.length === 0) addMessage("📭 No reminders set.", false);
        else reminders.forEach((r, i) => addMessage(`${i+1}. ${r}`, false));
        speak(`You have ${reminders.length} reminders`);
        return;
    }
    if (lower === "clear reminders") {
        reminders = [];
        localStorage.setItem('emergentReminders', '[]');
        addMessage("🗑️ All reminders cleared.", false);
        speak("Reminders cleared");
        return;
    }
    
    // Calculator
    if (lower.startsWith("calculate ") || lower.startsWith("calc ")) {
        let expr = lower.replace(/^calculate |^calc /, "");
        let result = evaluateMath(expr);
        if (result !== null) {
            addMessage(`🧮 ${expr} = ${result}`, false);
            speak(`Result is ${result}`);
        } else {
            addMessage("Invalid math expression. Use + - * / and parentheses.", false);
            speak("Could not calculate that.");
        }
        return;
    }
    
    // Random fact
    if (lower.includes("fact")) {
        const facts = [
            "The first computer programmer was Ada Lovelace.",
            "The Internet was originally called ARPANET.",
            "A group of owls is called a parliament.",
            "Octopuses have three hearts.",
            "Honey never spoils."
        ];
        let fact = facts[Math.floor(Math.random() * facts.length)];
        addMessage(`🧠 Did you know? ${fact}`, false);
        speak(fact);
        return;
    }
    
    // Inspirational quote
    if (lower.includes("quote") || lower === "inspire me") {
        const quotes = [
            "The future is built by those who dare to imagine.",
            "Code is poetry written in logic.",
            "Every expert was once a beginner.",
            "Stay curious, stay humble.",
            "Your only limit is your mind."
        ];
        let quote = quotes[Math.floor(Math.random() * quotes.length)];
        addMessage(`✨ "${quote}"`, false);
        speak(quote);
        return;
    }
    
    // Wikipedia
    if (lower.startsWith("wiki ")) {
        let topic = lower.replace("wiki ", "");
        addMessage(`Searching Wikipedia for "${topic}"...`, false);
        let summary = await fetchWikiSummary(topic);
        addMessage(summary.length > 500 ? summary.slice(0, 500) + "..." : summary, false);
        speak(`Here's what I found about ${topic}`);
        return;
    }
    
    // Help
    if (lower === "help" || lower === "commands") {
        let helpMsg = `Available commands:
        • open <site> – opens a website
        • search for <query> – Google search
        • time – current time and date
        • joke – tells a random joke
        • weather – simulated forecast
        • note <text> / notes / clear notes
        • remind me to <task> / reminders / clear reminders
        • calculate <expression> – e.g. calculate 5*8+2
        • fact – random fun fact
        • quote / inspire me – inspirational message
        • wiki <topic> – Wikipedia summary
        • help – shows this menu`;
        addMessage(helpMsg, false);
        speak("Check the chat for all available commands.");
        return;
    }
    
    // Fallback
    addMessage("❓ Command not recognized. Type 'help' to see what I can do.", false);
    speak("Command not recognized. Type help for options.");
}

// Event listeners
sendBtn.addEventListener('click', () => {
    let text = commandInput.value.trim();
    if (text) processCommand(text);
    commandInput.value = '';
});
commandInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendBtn.click();
});

// Voice recognition
let recognition = null;
if ('webkitSpeechRecognition' in window) {
    const SpeechRecognition = window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    
    micBtn.addEventListener('click', () => {
        statusSpan.innerText = "listening...";
        micBtn.classList.add('listening');
        recognition.start();
    });
    
    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        statusSpan.innerText = "command captured";
        micBtn.classList.remove('listening');
        processCommand(transcript);
        setTimeout(() => { statusSpan.innerText = "neural link active"; }, 1500);
    };
    recognition.onerror = () => {
        statusSpan.innerText = "mic error";
        micBtn.classList.remove('listening');
        setTimeout(() => { statusSpan.innerText = "neural link active"; }, 1500);
    };
    recognition.onend = () => {
        micBtn.classList.remove('listening');
        if (statusSpan.innerText === "listening...") statusSpan.innerText = "neural link active";
    };
} else {
    micBtn.disabled = true;
    statusSpan.innerText = "voice not supported";
    addMessage("⚠️ Your browser does not support speech recognition. Please use text commands.", false);
}

// Welcome message
addMessage("✨ System online. I'm your 3D Emergent AI. Try 'help' for commands.", false);
speak("System online. I am your Emergent AI.");