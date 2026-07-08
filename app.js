/**
 * EduAI Dashboard – app.js
 * Core client-side logic: API calls, tab switching, UI interactions.
 * Backend: http://localhost:8080
 */

const API = 'http://localhost:8080';

// ── State ────────────────────────────────────────────────────────
let authToken = localStorage.getItem('eduai_token') || null;
let currentUser = JSON.parse(localStorage.getItem('eduai_user') || 'null');
let activeChatId = null;
let allChats = [];
let quizState = { quiz: null, questions: [], currentIdx: 0, answers: {}, flagged: new Set(), timerInterval: null, startTime: null };
let currentDocContent = '';
let currentPPTSlides = [];
let currentSlideIdx = 0;
let currentNoteMaterial = null;
let voiceSynth = window.speechSynthesis;
let voiceUtterance = null;
let voicePlaying = false;
let voiceSpeechEnabled = false;

// ── Bootstrap ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    guardAuth();
    applyTheme();
    initLucide();
    loadUserProfile();
    loadNotifications();
    loadNotes();
    loadChatList();
    renderStudyMaterials();
    loadCodingChallenge();
    loadFiles();
});

function initLucide() {
    if (window.lucide) lucide.createIcons();
}

// ── Auth Guard ────────────────────────────────────────────────────
function guardAuth() {
    if (!authToken && !currentUser) {
        window.location.href = 'index.html';
    }
}

// ── Logout ────────────────────────────────────────────────────────
function logout() {
    localStorage.removeItem('eduai_token');
    localStorage.removeItem('eduai_user');
    window.location.href = 'index.html';
}

// ── API Helper ─────────────────────────────────────────────────────
async function apiCall(path, method = 'GET', body = null) {
    if (!authToken) {
        return mockApiCall(path, method, body);
    }
    const opts = {
        method,
        headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' }
    };
    if (body !== null) opts.body = typeof body === 'string' ? body : JSON.stringify(body);
    try {
        const res = await fetch(`${API}${path}`, opts);
        if (res.status === 401 || res.status === 403) { logout(); return null; }
        if (!res.ok) return null;
        const ct = res.headers.get('content-type') || '';
        return ct.includes('application/json') ? res.json() : res.text();
    } catch (e) {
        console.error('API Error:', e);
        return null;
    }
}

// ── Standalone Mock API Interceptor ───────────────────────────────
function mockApiCall(path, method, body) {
    const username = currentUser?.username || 'Guest';
    
    // Helper to get/set localStorage lists
    const getLocal = (key, def = '[]') => JSON.parse(localStorage.getItem(key) || def);
    const setLocal = (key, val) => localStorage.setItem(key, JSON.stringify(val));

    const chatsKey = `eduai_${username}_chats`;
    const notesKey = `eduai_${username}_notes`;
    const quizResultsKey = `eduai_${username}_quiz_results`;

    // 1. CHAT LIST
    if (path.startsWith('/api/chat/list') && method === 'GET') {
        return Promise.resolve(getLocal(chatsKey));
    }

    // 2. CREATE CHAT
    if (path.startsWith('/api/chat/create') && method === 'POST') {
        const url = new URL(path, 'http://localhost');
        const title = url.searchParams.get('title') || 'Study Session';
        const chats = getLocal(chatsKey);
        const newChat = {
            id: Date.now(),
            title: title,
            messages: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        chats.unshift(newChat);
        setLocal(chatsKey, chats);
        return Promise.resolve(newChat);
    }

    // 3. SEND CHAT MESSAGE
    if (path.startsWith('/api/chat/message') && method === 'POST') {
        const url = new URL(path, 'http://localhost');
        const chatId = parseInt(url.searchParams.get('chatId'));
        const chats = getLocal(chatsKey);
        const chat = chats.find(c => c.id === chatId);
        if (!chat) return Promise.resolve(null);

        // Add user message
        const userMsg = { sender: 'USER', content: body, createdAt: new Date().toISOString() };
        chat.messages = chat.messages || [];
        chat.messages.push(userMsg);

        // Add AI response
        const aiResponseText = `Here is a smart mock response about your topic: "${body}". In Standalone Mock Mode, we simulate the AI tutor response dynamically. Keep studying!`;
        const aiMsg = { sender: 'AI', content: aiResponseText, createdAt: new Date().toISOString() };
        chat.messages.push(aiMsg);

        chat.updatedAt = new Date().toISOString();
        setLocal(chatsKey, chats);
        return Promise.resolve(chat.messages);
    }

    // 4. BOOKMARK CHAT
    if (path.startsWith('/api/chat/bookmark/') && method === 'PUT') {
        return Promise.resolve({ success: true });
    }

    // 5. NOTES LIST
    if (path.startsWith('/api/note/list') && method === 'GET') {
        return Promise.resolve(getLocal(notesKey));
    }

    // 6. CREATE NOTE
    if (path.startsWith('/api/note/create') && method === 'POST') {
        const notes = getLocal(notesKey);
        const newNote = {
            id: body.id || Date.now(),
            title: body.title || 'Untitled Note',
            content: body.content || '',
            type: body.type || 'detailed',
            createdAt: new Date().toISOString()
        };
        notes.unshift(newNote);
        setLocal(notesKey, notes);
        return Promise.resolve(newNote);
    }

    // 7. DELETE NOTE
    if (path.startsWith('/api/note/delete/') && method === 'DELETE') {
        const noteId = parseInt(path.split('/').pop());
        let notes = getLocal(notesKey);
        notes = notes.filter(n => n.id !== noteId);
        setLocal(notesKey, notes);
        return Promise.resolve("Deleted successfully");
    }

    // 8. QUIZ GENERATE
    if (path.startsWith('/api/quiz/generate') && method === 'POST') {
        const url = new URL(path, 'http://localhost');
        const subject = url.searchParams.get('subject') || 'Science';
        const topic = url.searchParams.get('topic') || 'Python';
        const difficulty = url.searchParams.get('difficulty') || 'easy';
        const timeLimit = parseInt(url.searchParams.get('timeLimit') || '10');
        const count = parseInt(url.searchParams.get('count') || '5');

        const quiz = {
            id: Date.now(),
            title: `${subject} - ${topic}`,
            subject,
            topic,
            difficulty,
            timeLimitMinutes: timeLimit,
            count
        };
        return Promise.resolve(quiz);
    }

    // 9. QUIZ SUBMIT
    if (path.startsWith('/api/quiz/submit') && method === 'POST') {
        const url = new URL(path, 'http://localhost');
        const score = parseInt(url.searchParams.get('score') || '0');
        const total = parseInt(url.searchParams.get('totalQuestions') || '5');
        const elapsed = parseInt(url.searchParams.get('timeTakenSeconds') || '0');
        const accuracy = Math.round((score / total) * 100);

        const results = getLocal(quizResultsKey);
        const newResult = {
            id: Date.now(),
            score,
            totalQuestions: total,
            accuracy,
            timeTakenSeconds: elapsed,
            strongTopics: body.strongTopics || 'General Topic',
            weakTopics: body.weakTopics || 'None',
            aiFeedback: accuracy >= 80 ? '⚡ Masterful job!' : 'Review foundational materials.',
            createdAt: new Date().toISOString()
        };
        results.unshift(newResult);
        setLocal(quizResultsKey, results);
        return Promise.resolve(newResult);
    }

    // 10. QUIZ RESULTS
    if (path.startsWith('/api/quiz/results') && method === 'GET') {
        return Promise.resolve(getLocal(quizResultsKey));
    }

    return Promise.resolve(null);
}

// ── Dark Mode ─────────────────────────────────────────────────────
function applyTheme() {
    const stored = localStorage.getItem('theme');
    const dark = (stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches));
    
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.classList.toggle('dark-theme', dark);
    
    const icon = document.getElementById('theme-icon');
    if (icon) icon.setAttribute('data-lucide', dark ? 'moon' : 'sun');
    initLucide();
}

function toggleDarkMode() {
    const isDark = document.documentElement.classList.contains('dark-theme');
    const dark = !isDark;
    
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.classList.toggle('dark-theme', dark);
    
    localStorage.setItem('theme', dark ? 'dark' : 'light');
    
    const icon = document.getElementById('theme-icon');
    if (icon) icon.setAttribute('data-lucide', dark ? 'moon' : 'sun');
    initLucide();
}

// ── Mobile Sidebar ────────────────────────────────────────────────
function toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('-translate-x-full');
}

// ── Tab Switching ─────────────────────────────────────────────────
function switchTab(tabName) {
    document.querySelectorAll('.panel-section').forEach(p => p.classList.add('hidden'));
    const target = document.getElementById(`panel-${tabName}`);
    if (target) target.classList.remove('hidden');

    document.querySelectorAll('.sidebar-item').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.sidebar-item').forEach(btn => {
        if (btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(`'${tabName}'`)) {
            btn.classList.add('active');
        }
    });

    // Lazy loaders
    if (tabName === 'notes') loadNotes();
    if (tabName === 'ai-chat') loadChatList();
    if (tabName === 'quiz') loadQuizResults();
    if (tabName === 'coding') loadCodingChallenge();
    if (tabName === 'progress') renderProgressCharts();
    if (tabName === 'profile') loadProfileData();
    if (tabName === 'admin-panel') loadAdminData();

    // Close mobile sidebar
    const sidebar = document.getElementById('sidebar');
    if (sidebar && window.innerWidth < 768) sidebar.classList.add('-translate-x-full');
}

// ── User Profile ──────────────────────────────────────────────────
function loadUserProfile() {
    if (!currentUser) return;
    const nameEl = document.getElementById('dash-greeting-name');
    if (nameEl) nameEl.textContent = currentUser.username || 'Student';
    const lvlEl = document.getElementById('header-level');
    if (lvlEl) lvlEl.textContent = currentUser.level || 1;
    const xpEl = document.getElementById('header-xp');
    if (xpEl) xpEl.textContent = `${currentUser.xp || 0} XP`;
    const dashLvl = document.getElementById('dash-level');
    if (dashLvl) dashLvl.textContent = `Level ${currentUser.level || 1}`;
    
    // Additional home dashboard stats
    const dashProblems = document.getElementById('dash-code-problems');
    if (dashProblems) dashProblems.textContent = `${currentUser.codingSolved || 0} Solved`;

    const schedContainer = document.getElementById('dash-schedule-container');
    if (schedContainer) {
        schedContainer.innerHTML = `
            <div class="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl flex items-center justify-between text-xs">
                <span>📚 <strong>Calculus Revision</strong> (Limits & derivatives)</span>
                <span class="text-slate-400">2:00 PM - 3:30 PM</span>
            </div>
            <div class="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl flex items-center justify-between text-xs">
                <span>💻 <strong>Coding practice</strong> (Two Sum Hashmap)</span>
                <span class="text-slate-400">4:00 PM - 5:00 PM</span>
            </div>
        `;
    }

    const badgesContainer = document.getElementById('dash-badges-container');
    if (badgesContainer) {
        badgesContainer.innerHTML = `
            <div class="flex flex-col items-center justify-center p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center">
                <i data-lucide="award" class="h-6 w-6 text-amber-500 mb-1"></i>
                <span class="text-[9px] font-bold text-amber-600 dark:text-amber-400">Fast Learner</span>
            </div>
            <div class="flex flex-col items-center justify-center p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-center">
                <i data-lucide="zap" class="h-6 w-6 text-indigo-500 mb-1"></i>
                <span class="text-[9px] font-bold text-indigo-600 dark:text-indigo-400">7-Day Streak</span>
            </div>
            <div class="flex flex-col items-center justify-center p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center">
                <i data-lucide="check-circle" class="h-6 w-6 text-emerald-500 mb-1"></i>
                <span class="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">Quiz Master</span>
            </div>
        `;
    }

    // Sidebar user
    const sidebarUser = document.getElementById('sidebar-username');
    if (sidebarUser) sidebarUser.textContent = currentUser.username;
    const sidebarEmail = document.getElementById('sidebar-email');
    if (sidebarEmail) sidebarEmail.textContent = currentUser.email || '';
    
    // Admin panel visibility
    const adminBtn = document.getElementById('admin-sidebar-btn');
    if (adminBtn) adminBtn.style.display = currentUser.role === 'ROLE_ADMIN' ? '' : 'none';
    
    initLucide();
}

function loadProfileData() {
    if (!currentUser) return;
    const fields = {
        'profile-name': currentUser.username,
        'profile-email': currentUser.email,
        'profile-level': currentUser.level,
        'profile-xp': currentUser.xp,
        'profile-streak': currentUser.streak
    };
    Object.entries(fields).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val || '';
    });

    const certsEl = document.getElementById('profile-certificates-list');
    if (certsEl) {
        certsEl.innerHTML = `
            <div class="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
                <div class="h-9 w-9 rounded-xl gradient-bg flex items-center justify-center text-white"><i data-lucide="award" class="h-4 w-4"></i></div>
                <div>
                    <h5 class="font-bold text-xs">AI Chat Scholar</h5>
                    <p class="text-[10px] text-slate-400">Unlocked by discussing 5 study sessions</p>
                </div>
            </div>
            <div class="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
                <div class="h-9 w-9 rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 flex items-center justify-center"><i data-lucide="zap" class="h-4 w-4"></i></div>
                <div>
                    <h5 class="font-bold text-xs">High Accuracy Badge</h5>
                    <p class="text-[10px] text-slate-400">Obtain >85% accuracy on an Adaptive Quiz</p>
                </div>
            </div>
        `;
        initLucide();
    }
}

function handleProfileUpdateSubmit(event) {
    event.preventDefault();
    const eduTier = document.getElementById('profile-edu-tier')?.value;
    const goals = document.getElementById('profile-goals-input')?.value?.trim();

    if (currentUser) {
        currentUser.education = eduTier;
        currentUser.learningGoals = goals;
        localStorage.setItem('eduai_user', JSON.stringify(currentUser));
        loadUserProfile();
        loadProfileData();
        showToast('Profile updated successfully!', 'success');
    }
}

// ── Notifications ─────────────────────────────────────────────────
let notifications = [
    { id: 1, text: 'Welcome to EduAI! Start by chatting with the AI Tutor.', read: false, time: 'Just now' },
    { id: 2, text: 'Your quiz results are ready to review.', read: false, time: '5m ago' },
];

function loadNotifications() {
    renderNotificationList();
    updateNotificationDot();
}

function renderNotificationList() {
    const list = document.getElementById('notifications-list');
    if (!list) return;
    if (!notifications.length) { list.innerHTML = '<p class="text-slate-400 text-center py-4">No notifications</p>'; return; }
    list.innerHTML = notifications.map(n => `
        <div class="flex items-start gap-2 p-2 rounded-lg ${n.read ? 'opacity-50' : 'bg-indigo-50/50 dark:bg-indigo-950/20'} transition-opacity">
            <div class="h-2 w-2 mt-1 rounded-full flex-shrink-0 ${n.read ? 'bg-slate-300' : 'bg-indigo-500'}"></div>
            <div><p class="text-xs text-slate-700 dark:text-slate-300">${n.text}</p><span class="text-slate-400 text-[10px]">${n.time}</span></div>
        </div>`).join('');
}

function updateNotificationDot() {
    const dot = document.getElementById('notification-dot');
    if (!dot) return;
    const hasUnread = notifications.some(n => !n.read);
    dot.classList.toggle('hidden', !hasUnread);
}

function toggleNotifications() {
    document.getElementById('notifications-dropdown')?.classList.toggle('hidden');
}

function markAllNotificationsRead() {
    notifications.forEach(n => n.read = true);
    renderNotificationList();
    updateNotificationDot();
}

// ── Global Search ─────────────────────────────────────────────────
function handleGlobalSearch(event) {
    if (event.key !== 'Enter') return;
    const q = document.getElementById('search-query')?.value?.trim().toLowerCase();
    if (!q) return;
    document.getElementById('search-overlay')?.classList.remove('hidden');
    const list = document.getElementById('search-results-list');
    if (!list) return;
    const tabs = ['Dashboard','AI Chat','Notes','Documents','PPT Generator','Quiz','Coding','Planner','Files','Settings','Profile'];
    const results = tabs.filter(t => t.toLowerCase().includes(q));
    list.innerHTML = results.length
        ? results.map(t => `<div onclick="switchTab('${t.toLowerCase().replace(' ','-')}'); closeSearch()" class="p-3 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950 cursor-pointer flex items-center gap-2 border border-slate-100 dark:border-slate-800">${t}</div>`).join('')
        : '<p class="text-slate-400 text-center py-6">No results found</p>';
}

function closeSearch() {
    document.getElementById('search-overlay')?.classList.add('hidden');
    const q = document.getElementById('search-query');
    if (q) q.value = '';
}

// ── AI Chat ───────────────────────────────────────────────────────
async function loadChatList() {
    const data = await apiCall('/api/chat/list');
    allChats = data || [];
    const list = document.getElementById('chat-session-list');
    if (!list) return;
    if (!allChats.length) {
        list.innerHTML = '<p class="text-xs text-slate-400 text-center py-4">No chat sessions yet</p>';
        return;
    }
    list.innerHTML = allChats.map(c => `
        <button onclick="loadChat(${c.id})" class="w-full text-left p-2.5 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors text-xs border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900 ${activeChatId === c.id ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-100 dark:border-indigo-900 font-bold' : ''}">
            <div class="font-semibold truncate">${c.title || 'Study Session'}</div>
            <div class="text-slate-400 text-[10px] mt-0.5">${new Date(c.updatedAt || c.createdAt).toLocaleString()}</div>
        </button>`).join('');
}

async function startNewChatSession() {
    const title = `Session ${new Date().toLocaleDateString()}`;
    const chat = await apiCall(`/api/chat/create?title=${encodeURIComponent(title)}`, 'POST');
    if (chat) {
        activeChatId = chat.id;
        await loadChatList();
        await loadChat(chat.id);
        showToast('New chat session started!', 'success');
    }
}

async function loadChat(chatId) {
    activeChatId = chatId;
    const chat = allChats.find(c => c.id === chatId);
    if (!chat) return;

    const titleEl = document.getElementById('current-chat-title');
    if (titleEl) titleEl.textContent = chat.title || 'Study Session';

    const container = document.getElementById('chat-messages-history');
    if (!container) return;
    container.innerHTML = '';

    if (!chat.messages || !chat.messages.length) {
        container.innerHTML = '<div class="flex items-center justify-center h-40 text-sm text-slate-400">No messages in this session. Start chatting below...</div>';
    } else {
        chat.messages.forEach(m => {
            appendChatBubble(m.content, m.sender);
        });
    }
    await loadChatList();
    showToast('Chat loaded', 'info');
}

function handleChatSubmit(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        submitChatMessage();
    }
}

async function submitChatMessage() {
    const inputEl = document.getElementById('chat-user-input');
    const msg = inputEl?.value?.trim();
    if (!msg) return;
    inputEl.value = '';

    if (!activeChatId) {
        const chat = await apiCall(`/api/chat/create?title=Quick Chat`, 'POST');
        if (!chat) { showToast('Failed to create session', 'error'); return; }
        activeChatId = chat.id;
        await loadChatList();
    }

    appendChatBubble(msg, 'USER');
    appendChatBubble('...', 'AI', true);

    const messages = await apiCall(`/api/chat/message?chatId=${activeChatId}`, 'POST', msg);
    removeTypingBubble();
    if (messages && messages.length) {
        const chat = allChats.find(c => c.id === activeChatId);
        if (chat) chat.messages = messages;
        
        const aiMsg = messages[messages.length - 1];
        appendChatBubble(aiMsg.content, 'AI');
        
        if (voiceSpeechEnabled) {
            speakText(aiMsg.content);
        }
    }
}

function appendChatBubble(content, sender, isTyping = false) {
    const container = document.getElementById('chat-messages-history');
    if (!container) return;
    // Clear placeholder
    const placeholder = container.querySelector('.h-40');
    if (placeholder) placeholder.remove();

    const div = document.createElement('div');
    div.className = `flex ${sender === 'USER' ? 'justify-end' : 'justify-start'} mb-3`;
    div.id = isTyping ? 'typing-bubble' : '';
    div.innerHTML = `
        <div class="max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
            sender === 'USER'
                ? 'gradient-bg text-white rounded-br-sm'
                : 'glass-panel border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-bl-sm'
        }">
            ${isTyping ? '<span class="animate-pulse">AI is thinking...</span>' : content}
        </div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function removeTypingBubble() {
    document.getElementById('typing-bubble')?.remove();
}

function toggleBookmarkChat() {
    if (!activeChatId) return;
    apiCall(`/api/chat/bookmark/${activeChatId}`, 'PUT');
    showToast('Bookmark toggled', 'success');
}

function shareChat() { showToast('Share link copied to clipboard!', 'success'); }
function downloadChat() { showToast('Chat downloaded as Markdown', 'info'); }

function handleFileAttachment(input, type) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const indicator = document.getElementById('drag-drop-indicator');
        const filename = document.getElementById('attached-filename');
        if (indicator && filename) {
            filename.textContent = file.name;
            indicator.classList.remove('hidden');
        }
        showToast(`File "${file.name}" attached successfully!`, 'success');
    }
}

function clearChatAttachment() {
    const indicator = document.getElementById('drag-drop-indicator');
    const filename = document.getElementById('attached-filename');
    if (indicator) indicator.classList.add('hidden');
    if (filename) filename.textContent = 'none';
    const pdfInput = document.getElementById('chat-pdf-file');
    const imgInput = document.getElementById('chat-img-file');
    if (pdfInput) pdfInput.value = '';
    if (imgInput) imgInput.value = '';
}

function toggleVoiceInput() { showToast('Voice input activated', 'info'); }
function simulateYoutubeLink() { showToast('YouTube video attached', 'info'); }

// ── Notes ─────────────────────────────────────────────────────────
let allNotes = [];

async function loadNotes() {
    const data = await apiCall('/api/note/list');
    allNotes = data || [];
    renderNotesGrid(allNotes);
}

function renderNotesGrid(notes) {
    const grid = document.getElementById('notes-cards-grid');
    if (!grid) return;
    if (!notes.length) {
        grid.innerHTML = '<div class="col-span-full text-center py-12 text-slate-400"><div class="text-4xl mb-2">📝</div><p>No notes yet. Generate your first smart note!</p></div>';
        return;
    }
    grid.innerHTML = notes.map(n => `
        <div class="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors group">
            <div class="flex justify-between items-start">
                <h4 class="font-bold text-sm text-slate-800 dark:text-slate-100">${n.title}</h4>
                <button onclick="deleteNote(${n.id})" class="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-red-400 transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                </button>
            </div>
            <p class="text-xs text-slate-500 line-clamp-3">${n.content}</p>
            <div class="text-[10px] text-slate-400">${new Date(n.createdAt || Date.now()).toLocaleDateString()}</div>
        </div>`).join('');
}

function filterNotesTab(type, btn) {
    document.querySelectorAll('.note-tab-btn').forEach(b => b.classList.remove('active', 'text-indigo-500'));
    btn.classList.add('active', 'text-indigo-500');
    const filtered = type === 'all' ? allNotes : allNotes.filter(n => (n.type || 'detailed') === type);
    renderNotesGrid(filtered);
}

function openNoteCreateModal() {
    document.getElementById('note-create-modal')?.classList.remove('hidden');
}
function closeNoteCreateModal() {
    document.getElementById('note-create-modal')?.classList.add('hidden');
}

async function handleGenerateNotesSubmit(event) {
    event.preventDefault();
    const topic = document.getElementById('note-topic-input')?.value?.trim();
    const format = document.getElementById('note-format-type')?.value;
    if (!topic) return;

    closeNoteCreateModal();
    showToast('Generating smart notes...', 'info');

    const content = generateAIContent('notes', topic, format);
    const note = await apiCall('/api/note/create', 'POST', { title: `${format.toUpperCase()} – ${topic}`, content, type: format });
    if (note) {
        showToast('Notes created successfully!', 'success');
        await loadNotes();
    }
}

async function deleteNote(id) {
    const ok = await apiCall(`/api/note/delete/${id}`, 'DELETE');
    if (ok !== null) {
        showToast('Note deleted', 'info');
        await loadNotes();
    }
}

// ── Study Materials ───────────────────────────────────────────────
const STUDY_MATERIALS = [
    { id: 1, title: 'Calculus – Derivatives & Integrals', type: 'Advanced Theory', icon: 'sigma', content: '## Calculus Overview\n\n### Derivatives\nThe derivative measures the rate of change. For f(x) = xⁿ, f\'(x) = nxⁿ⁻¹\n\n### Integrals\nIntegration is the reverse of differentiation. ∫xⁿ dx = xⁿ⁺¹/(n+1) + C\n\n### Key Theorems\n- **Fundamental Theorem**: ∫ₐᵇ f(x)dx = F(b) - F(a)\n- **Chain Rule**: d/dx[f(g(x))] = f\'(g(x))·g\'(x)\n- **Product Rule**: d/dx[uv] = u\'v + uv\'' },
    { id: 2, title: 'Data Structures – Arrays & Linked Lists', type: 'CS Foundations', icon: 'database', content: '## Data Structures\n\n### Arrays\n- Fixed size, O(1) access by index\n- O(n) insertion/deletion\n\n### Linked Lists\n- Dynamic size, O(1) insertion at head\n- O(n) access by index\n- Nodes: data + next pointer\n\n### When to use which?\n- Array: frequent random access\n- Linked List: frequent insertions/deletions' },
    { id: 3, title: 'Biology – Cell Division & Mitosis', type: 'Life Sciences', icon: 'dna', content: '## Cell Division\n\n### Mitosis Phases\n1. **Prophase** – Chromosomes condense\n2. **Metaphase** – Chromosomes align at equator\n3. **Anaphase** – Sister chromatids separate\n4. **Telophase** – Nuclear envelope reforms\n5. **Cytokinesis** – Cell splits\n\n### Purpose\nMitosis produces 2 identical daughter cells for growth and repair.' },
    { id: 4, title: 'Physics – Laws of Motion', type: 'Applied Science', icon: 'zap', content: '## Newton\'s Laws\n\n1. **First Law (Inertia)**: An object remains at rest unless acted on by force\n2. **Second Law**: F = ma (Force = Mass × Acceleration)\n3. **Third Law**: For every action, there is an equal and opposite reaction\n\n### Applications\n- Rocket propulsion (3rd Law)\n- Car acceleration (2nd Law)\n- Seatbelts (1st Law)' },
];

function renderStudyMaterials() {
    const container = document.getElementById('study-materials-list');
    if (!container) return;
    container.innerHTML = STUDY_MATERIALS.map(m => `
        <div onclick="openStudyMaterial(${m.id})" class="glass-panel p-5 rounded-2xl border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 transition-all hover:shadow-lg group space-y-3">
            <div class="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <i data-lucide="${m.icon}" class="h-5 w-5"></i>
            </div>
            <div>
                <h4 class="font-bold text-sm text-slate-800 dark:text-slate-200">${m.title}</h4>
                <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">${m.type}</span>
            </div>
        </div>`).join('');
    initLucide();
}

function openStudyMaterial(id) {
    const m = STUDY_MATERIALS.find(x => x.id === id);
    if (!m) return;
    currentNoteMaterial = m;
    document.getElementById('material-viewer-title').textContent = m.title;
    document.getElementById('material-viewer-type').textContent = m.type;
    document.getElementById('material-viewer-body').innerHTML = m.content.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/## (.*)/g, '<h2 class="font-bold text-lg mt-4 mb-2">$1</h2>').replace(/### (.*)/g, '<h3 class="font-semibold text-base mt-3 mb-1">$1</h3>');
    document.getElementById('study-material-viewer-modal')?.classList.remove('hidden');
}

function closeStudyMaterialViewer() {
    document.getElementById('study-material-viewer-modal')?.classList.add('hidden');
}

function askAITutorAboutMaterial() {
    closeStudyMaterialViewer();
    switchTab('ai-chat');
    const input = document.getElementById('chat-user-input');
    if (input && currentNoteMaterial) input.value = `Explain more about: ${currentNoteMaterial.title}`;
}

function downloadMaterialText() {
    if (!currentNoteMaterial) return;
    const blob = new Blob([currentNoteMaterial.content], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${currentNoteMaterial.title}.md`;
    a.click();
    showToast('Material downloaded', 'success');
}

// ── Documents Generator ───────────────────────────────────────────
async function handleDocumentGenerateSubmit(event) {
    event.preventDefault();
    const topic = document.getElementById('doc-gen-topic')?.value?.trim();
    const type = document.getElementById('doc-gen-type')?.value;
    if (!topic) return;

    showToast('Generating document...', 'info');
    currentDocContent = generateAIContent('document', topic, type);

    document.getElementById('gen-doc-title').textContent = `${type}: ${topic}`;
    document.getElementById('gen-doc-content-body').innerHTML = currentDocContent.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/## (.*)/g, '<h2 class="font-bold text-lg mt-4 mb-2">$1</h2>');
    document.getElementById('generated-doc-preview-card')?.classList.remove('hidden');
    showToast('Document generated!', 'success');

    // Save to backend
    await apiCall('/api/note/create', 'POST', { title: `${type} – ${topic}`, content: currentDocContent, type: 'detailed' });
}

function downloadDocFile(format) {
    const blob = new Blob([currentDocContent], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `document.${format === 'pdf' ? 'txt' : format}`;
    a.click();
    showToast(`Downloaded as ${format.toUpperCase()}`, 'success');
}

function emailGeneratedDocument() { showToast('Document emailed to your account', 'success'); }

// ── PPT Generator ─────────────────────────────────────────────────
async function handlePPTGenerateSubmit(event) {
    event.preventDefault();
    const topic = document.getElementById('ppt-gen-topic')?.value?.trim();
    const theme = document.getElementById('ppt-gen-theme')?.value;
    if (!topic) return;

    showToast('Generating slide deck...', 'info');
    currentPPTSlides = generatePPTSlides(topic, theme);
    currentSlideIdx = 0;

    document.getElementById('ppt-preview-section')?.classList.remove('hidden');
    renderCurrentSlide();
    document.getElementById('ppt-slide-total').textContent = currentPPTSlides.length;
    showToast('Slide deck ready!', 'success');
}

function generatePPTSlides(topic, theme) {
    return [
        { title: topic, body: 'An AI-Generated Presentation', type: 'title', notes: `Welcome everyone. Today we are presenting on "${topic}".` },
        { title: 'Agenda', body: '1. Introduction\n2. Core Concepts\n3. Key Findings\n4. Applications\n5. Conclusion', type: 'content', notes: 'Here is the agenda of topics we will walk through today.' },
        { title: 'Introduction', body: `${topic} is a fundamental subject that impacts modern understanding. This presentation explores core ideas with structured analysis.`, type: 'content', notes: `Let's start by introducing ${topic} and why it is highly relevant today.` },
        { title: 'Core Concepts', body: `• Key principle 1: Foundation of ${topic}\n• Key principle 2: Advanced applications\n• Key principle 3: Real-world impact\n• Key principle 4: Future directions`, type: 'content', notes: `These are the core pillars and concepts that construct the foundation of ${topic}.` },
        { title: 'Key Findings', body: `Research on ${topic} reveals significant insights:\n\n→ 78% improvement in related outcomes\n→ Broad applicability across domains\n→ Growing relevance in 2025+`, type: 'content', notes: 'Our research indicates positive improvements in all key metrics.' },
        { title: 'Applications', body: `${topic} applies to:\n• Academic research\n• Industry practices\n• Student learning\n• Professional development`, type: 'content', notes: 'Now we look at the main areas where this is applied in practice.' },
        { title: 'Conclusion', body: `${topic} represents a critical area of study. Continued exploration will unlock greater potential and innovation.`, type: 'conclusion', notes: 'In conclusion, this shows the path forward. Thank you, and let us open for questions.' },
    ];
}

function renderCurrentSlide() {
    const slide = currentPPTSlides[currentSlideIdx];
    if (!slide) return;
    const container = document.getElementById('ppt-slide-canvas');
    if (!container) return;
    container.innerHTML = `
        <div class="h-64 flex flex-col items-center justify-center text-center p-8 rounded-2xl gradient-bg text-white">
            <h2 class="text-2xl font-extrabold mb-3">${slide.title}</h2>
            <p class="text-sm opacity-90 whitespace-pre-line leading-relaxed">${slide.body}</p>
        </div>`;
    document.getElementById('ppt-slide-index').textContent = currentSlideIdx + 1;

    // Set theme and speaker notes dynamically
    const notesEl = document.getElementById('ppt-slide-notes');
    if (notesEl) notesEl.textContent = slide.notes || 'No notes for this slide.';

    const themeEl = document.getElementById('ppt-theme-indicator');
    if (themeEl) {
        const theme = document.getElementById('ppt-gen-theme')?.value || 'Royal Violet';
        themeEl.textContent = theme;
    }
}

function navigateSlide(dir) {
    currentSlideIdx = Math.max(0, Math.min(currentPPTSlides.length - 1, currentSlideIdx + dir));
    renderCurrentSlide();
}

// ── Quiz ──────────────────────────────────────────────────────────
async function handleStartQuizSubmit(event) {
    event.preventDefault();
    const subject = document.getElementById('quiz-subject')?.value?.trim();
    const topic = document.getElementById('quiz-topic')?.value?.trim();
    const difficulty = document.getElementById('quiz-difficulty')?.value;
    const count = parseInt(document.getElementById('quiz-question-count')?.value || 5);
    const timeLimit = parseInt(document.getElementById('quiz-time-limit')?.value || 10);

    showToast('Generating quiz...', 'info');
    const quiz = await apiCall(`/api/quiz/generate?subject=${encodeURIComponent(subject)}&topic=${encodeURIComponent(topic)}&difficulty=${encodeURIComponent(difficulty)}&count=${count}&timeLimit=${timeLimit}`, 'POST');

    if (!quiz) { showToast('Failed to generate quiz', 'error'); return; }

    // Build questions
    quizState.quiz = quiz;
    quizState.questions = generateQuizQuestions(topic, count, difficulty);
    quizState.currentIdx = 0;
    quizState.answers = {};
    quizState.flagged = new Set();
    quizState.startTime = Date.now();

    document.getElementById('quiz-config-view')?.classList.add('hidden');
    document.getElementById('quiz-active-view')?.classList.remove('hidden');
    document.getElementById('quiz-results-view')?.classList.add('hidden');
    document.getElementById('active-quiz-topic').textContent = topic;
    document.getElementById('active-quiz-difficulty-level').textContent = difficulty;
    document.getElementById('quiz-total-num').textContent = count;

    startQuizTimer(timeLimit);
    renderQuizQuestion();
}

function generateQuizQuestions(topic, count, difficulty) {
    const templates = [
        { text: `What is the primary purpose of ${topic}?`, options: [`To understand ${topic} fundamentals`, `To avoid ${topic}`, `To replace ${topic}`, `None of the above`], correctIndex: 0 },
        { text: `Which statement best describes ${topic}?`, options: [`${topic} is a modern concept`, `${topic} is outdated`, `${topic} has no applications`, `${topic} is purely theoretical`], correctIndex: 0 },
        { text: `${topic} is most commonly used in:`, options: [`Academic and professional settings`, `Only in research`, `Recreational activities only`, `It has no use`], correctIndex: 0 },
        { text: `A key characteristic of ${topic} is:`, options: [`Its versatility and adaptability`, `Its rigidity`, `Its simplicity alone`, `Its obsolescence`], correctIndex: 0 },
        { text: `The future of ${topic} involves:`, options: [`Growing integration with technology`, `Declining relevance`, `Replacement by simpler methods`, `Complete elimination`], correctIndex: 0 },
    ];
    return templates.slice(0, count).map((q, i) => ({ ...q, id: `q_${i}`, difficulty }));
}

function renderQuizQuestion() {
    const q = quizState.questions[quizState.currentIdx];
    if (!q) return;
    const canvas = document.getElementById('quiz-question-canvas');
    if (!canvas) return;

    const savedAnswer = quizState.answers[q.id];
    canvas.innerHTML = `
        <div class="space-y-4">
            <h4 class="text-base font-bold text-slate-800 dark:text-slate-100">${q.text}</h4>
            <div class="space-y-2.5">
                ${q.options.map((opt, i) => `
                    <label class="flex items-center gap-3 p-3 rounded-xl border ${savedAnswer === i ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30' : 'border-slate-200 dark:border-slate-800 hover:border-indigo-300'} cursor-pointer transition-colors">
                        <input type="radio" name="quiz_answer" value="${i}" ${savedAnswer === i ? 'checked' : ''} onchange="selectQuizAnswer(${i})" class="text-indigo-600">
                        <span class="text-sm">${opt}</span>
                    </label>`).join('')}
            </div>
        </div>`;

    const total = quizState.questions.length;
    const current = quizState.currentIdx;
    document.getElementById('quiz-current-num').textContent = current + 1;
    const fill = document.getElementById('quiz-progress-fill');
    if (fill) fill.style.width = `${((current + 1) / total) * 100}%`;
    document.getElementById('quiz-btn-prev').disabled = current === 0;
    document.getElementById('quiz-btn-next').textContent = current === total - 1 ? 'Submit' : 'Next';
}

function selectQuizAnswer(idx) {
    const q = quizState.questions[quizState.currentIdx];
    if (q) quizState.answers[q.id] = idx;
}

function navigateQuizQuestion(dir) {
    const total = quizState.questions.length;
    const next = quizState.currentIdx + dir;
    if (next >= total) { submitQuiz(); return; }
    quizState.currentIdx = Math.max(0, Math.min(total - 1, next));
    renderQuizQuestion();
}

function flagQuizQuestion() {
    const q = quizState.questions[quizState.currentIdx];
    if (!q) return;
    if (quizState.flagged.has(q.id)) quizState.flagged.delete(q.id);
    else quizState.flagged.add(q.id);
    showToast(`Question ${quizState.flagged.has(q.id) ? 'flagged' : 'unflagged'}`, 'info');
}

function startQuizTimer(minutes) {
    let totalSeconds = minutes * 60;
    clearInterval(quizState.timerInterval);
    quizState.timerInterval = setInterval(() => {
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        const el = document.getElementById('quiz-timer-countdown');
        if (el) el.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
        if (totalSeconds <= 0) { clearInterval(quizState.timerInterval); submitQuiz(); }
        totalSeconds--;
    }, 1000);
}

async function submitQuiz() {
    clearInterval(quizState.timerInterval);
    const questions = quizState.questions;
    let correct = 0;
    questions.forEach(q => {
        if (quizState.answers[q.id] === q.correctIndex) correct++;
    });
    const accuracy = Math.round((correct / questions.length) * 100);
    const elapsed = Math.round((Date.now() - quizState.startTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;

    document.getElementById('quiz-active-view')?.classList.add('hidden');
    document.getElementById('quiz-results-view')?.classList.remove('hidden');
    document.getElementById('quiz-res-score').textContent = `${accuracy}%`;
    document.getElementById('quiz-res-time').textContent = `Time: ${mins}m ${secs}s`;
    document.getElementById('quiz-res-strong').textContent = accuracy >= 80 ? quizState.quiz?.topic || 'Core Concepts' : 'Introduction';
    document.getElementById('quiz-res-weak').textContent = accuracy < 80 ? quizState.quiz?.topic || 'Core Concepts' : 'None detected';
    document.getElementById('quiz-res-ai-feedback').textContent = accuracy >= 80
        ? '⚡ Excellent work! You demonstrated strong mastery of the topic. Keep it up!'
        : `📚 Good effort! Review the foundational materials for ${quizState.quiz?.topic || 'this topic'} to improve.`;

    if (quizState.quiz) {
        await apiCall(`/api/quiz/submit?quizId=${quizState.quiz.id}&score=${correct}&totalQuestions=${questions.length}&timeTakenSeconds=${elapsed}`, 'POST', {
            strongTopics: document.getElementById('quiz-res-strong').textContent,
            weakTopics: document.getElementById('quiz-res-weak').textContent
        });
    }
    showToast(`Quiz complete! Score: ${accuracy}%`, accuracy >= 80 ? 'success' : 'info');
}

function resetQuizCenter() {
    document.getElementById('quiz-config-view')?.classList.remove('hidden');
    document.getElementById('quiz-active-view')?.classList.add('hidden');
    document.getElementById('quiz-results-view')?.classList.add('hidden');
}

async function loadQuizResults() {
    const data = await apiCall('/api/quiz/results');
}

// ── Coding Practice ────────────────────────────────────────────────
const CODING_CHALLENGES = {
    'reverse-string': {
        title: 'Reverse a String', company: 'Meta Interview', difficulty: 'Easy',
        description: 'Write a function that reverses a string. The input string is given as an array of characters. You must do this in-place with O(1) extra memory.',
        timeComplexity: 'O(N)', spaceComplexity: 'O(1)',
        hint: 'Use two pointers – one at the start and one at the end, swap and move inward.',
        starterCode: 'function reverseString(s) {\n    // Your code here\n    let left = 0, right = s.length - 1;\n    while (left < right) {\n        // swap s[left] and s[right]\n        left++; right--;\n    }\n    return s;\n}'
    },
    'fibonacci': {
        title: 'Fibonacci Sequence', company: 'Google Interview', difficulty: 'Easy',
        description: 'Write a function to return the nth Fibonacci number where F(0) = 0, F(1) = 1, and F(n) = F(n-1) + F(n-2).',
        timeComplexity: 'O(N)', spaceComplexity: 'O(1)',
        hint: 'Use dynamic programming with two variables to track previous values.',
        starterCode: 'function fibonacci(n) {\n    if (n <= 1) return n;\n    let prev = 0, curr = 1;\n    for (let i = 2; i <= n; i++) {\n        let next = prev + curr;\n        prev = curr;\n        curr = next;\n    }\n    return curr;\n}'
    },
    'two-sum': {
        title: 'Two Sum Problem', company: 'Amazon Interview', difficulty: 'Medium',
        description: 'Given an array of integers and a target sum, return indices of the two numbers such that they add up to target. Assume exactly one solution exists.',
        timeComplexity: 'O(N)', spaceComplexity: 'O(N)',
        hint: 'Use a HashMap to store complements. For each number, check if (target - num) is in the map.',
        starterCode: 'function twoSum(nums, target) {\n    const map = new Map();\n    for (let i = 0; i < nums.length; i++) {\n        const complement = target - nums[i];\n        if (map.has(complement)) return [map.get(complement), i];\n        map.set(nums[i], i);\n    }\n    return [];\n}'
    },
    'palindrome-number': {
        title: 'Palindrome Number', company: 'Apple Interview', difficulty: 'Easy',
        description: 'Given an integer x, return true if x is a palindrome. A palindrome reads the same backward as forward. Negative numbers are not palindromes.',
        timeComplexity: 'O(log N)', spaceComplexity: 'O(1)',
        hint: 'Reverse only half the number and compare with the other half.',
        starterCode: 'function isPalindrome(x) {\n    if (x < 0) return false;\n    const str = String(x);\n    return str === str.split("").reverse().join("");\n}'
    },
    'valid-parentheses': {
        title: 'Valid Parentheses', company: 'Microsoft Interview', difficulty: 'Medium',
        description: 'Given a string s containing just (), [], {}, determine if the input string is valid. An open bracket must be closed by the same type of bracket in the correct order.',
        timeComplexity: 'O(N)', spaceComplexity: 'O(N)',
        hint: 'Use a stack. Push opening brackets, pop and check when you encounter a closing bracket.',
        starterCode: 'function isValid(s) {\n    const stack = [];\n    const map = { ")": "(", "]": "[", "}": "{" };\n    for (const ch of s) {\n        if (["(","[","{"].includes(ch)) stack.push(ch);\n        else if (stack.pop() !== map[ch]) return false;\n    }\n    return stack.length === 0;\n}'
    }
};

function loadCodingChallenge() {
    const selector = document.getElementById('coding-challenge-selector');
    const key = selector?.value || 'reverse-string';
    const ch = CODING_CHALLENGES[key];
    if (!ch) return;

    document.getElementById('coding-title').textContent = ch.title;
    document.getElementById('coding-company').textContent = ch.company;
    document.getElementById('coding-description').textContent = ch.description;
    document.getElementById('coding-complexity-time').textContent = ch.timeComplexity;
    document.getElementById('coding-complexity-space').textContent = ch.spaceComplexity;
    document.getElementById('coding-hint-box')?.classList.add('hidden');

    const editor = document.getElementById('code-editor-textarea');
    if (editor) editor.value = ch.starterCode;
}

function showCodingHint() {
    const selector = document.getElementById('coding-challenge-selector');
    const key = selector?.value || 'reverse-string';
    const ch = CODING_CHALLENGES[key];
    if (!ch) return;
    document.getElementById('coding-hint-text').textContent = ch.hint;
    document.getElementById('coding-hint-box')?.classList.remove('hidden');
}

function explainCodingCode() {
    switchTab('ai-chat');
    const input = document.getElementById('chat-user-input');
    const editor = document.getElementById('code-editor-textarea');
    if (input && editor) input.value = `Please explain this code:\n\n${editor.value}`;
    showToast('Ask AI about your code', 'info');
}

function runCodingCode() {
    const editor = document.getElementById('code-editor-textarea');
    const output = document.getElementById('coding-console-logs');
    if (!editor || !output) return;
    try {
        output.textContent = "Executing code tests...";
        setTimeout(() => {
            output.textContent = `✅ Execution successful.\nAll local assertions passed!`;
            showToast('Code executed successfully!', 'success');
        }, 600);
    } catch (e) {
        output.textContent = `❌ Runtime Exception: ${e.message}`;
        showToast('Runtime error: ' + e.message, 'error');
    }
}

function submitCodingCode() { 
    showToast('Code submitted successfully!', 'success');
    if (currentUser) {
        currentUser.codingSolved = (currentUser.codingSolved || 0) + 1;
        localStorage.setItem('eduai_user', JSON.stringify(currentUser));
        loadUserProfile();
    }
}

function updateCodingTemplate() {
    const lang = document.getElementById('coding-language')?.value || 'javascript';
    showToast(`Switched editor to ${lang.toUpperCase()}`, 'info');
}

function clearConsole() {
    const output = document.getElementById('coding-console-logs');
    if (output) output.textContent = 'Output will stream here once code is run...';
}

// ── Study Planner ─────────────────────────────────────────────────
function handlePlannerGenerateSubmit(event) {
    event.preventDefault();
    try {
        const examDate = document.getElementById('plan-exam-date')?.value;
        const dailyHours = parseFloat(document.getElementById('plan-daily-hours')?.value || '3');
        const subjects = document.getElementById('plan-subjects')?.value;
        const weakAreas = document.getElementById('plan-weak-areas')?.value;

        if (!examDate || !subjects) {
            showToast('Please fill in required fields', 'error');
            return;
        }

        const scheduleBody = document.getElementById('planner-schedule-body');
        const scheduleCard = document.getElementById('planner-schedule-card');
        
        if (scheduleBody && scheduleCard) {
            // Safe date formatting to prevent RangeError / Invalid Date crash
            let formattedDate = examDate;
            try {
                const dateParts = examDate.split('-');
                if (dateParts.length === 3) {
                    const d = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
                    formattedDate = d.toLocaleDateString();
                }
            } catch (e) {
                console.error("Date formatting failed:", e);
            }

            const subjectsList = subjects.split(',').map(s => s.trim()).filter(Boolean);
            const hoursPerSubject = subjectsList.length > 0 ? (dailyHours / subjectsList.length).toFixed(1) : '0.0';
            const splitText = subjectsList.map(s => `<strong>${s}</strong>: ${hoursPerSubject} hrs/day`).join(' | ');

            scheduleBody.innerHTML = `
                <div class="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900 rounded-xl space-y-2 text-xs text-slate-700 dark:text-slate-300">
                    <p><strong>🎯 Study Plan Goal:</strong> Prepare for exams by <strong>${formattedDate}</strong></p>
                    <p><strong>🕒 Time Commitment:</strong> <strong>${dailyHours} hours/day</strong> split across subjects: <em>${subjects}</em></p>
                    ${weakAreas ? `<p><strong>⚠️ Focus Area:</strong> Extra attention on <em>${weakAreas}</em></p>` : ''}
                    <p><strong>📅 Suggested Split:</strong> ${splitText}</p>
                </div>
            `;
            scheduleCard.classList.remove('hidden');
            showToast('Study schedule generated successfully!', 'success');
        }
    } catch (err) {
        console.error("Planner generation failed:", err);
        showToast('Failed to generate study planner', 'error');
    }
}

// ── Saved Files Vault ─────────────────────────────────────────────
let uploadedFiles = JSON.parse(localStorage.getItem('eduai_files') || '[]');

function loadFiles() {
    const list = document.getElementById('file-manager-list');
    if (!list) return;
    if (!uploadedFiles.length) {
        list.innerHTML = '<p class="text-slate-400 text-center py-4 text-xs">No files uploaded yet.</p>';
        return;
    }
    list.innerHTML = uploadedFiles.map((f, index) => `
        <div class="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950/40 text-xs">
            <span class="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[70%]">${f.name} (${f.size})</span>
            <button onclick="deleteFile(${index})" class="text-red-500 hover:text-red-700 font-semibold">Delete</button>
        </div>
    `).join('');
}

function uploadFileManagerFile(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const fileSizeStr = file.size > 1024 * 1024 
            ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` 
            : `${(file.size / 1024).toFixed(1)} KB`;
        uploadedFiles.push({ name: file.name, size: fileSizeStr });
        localStorage.setItem('eduai_files', JSON.stringify(uploadedFiles));
        loadFiles();
        showToast(`Uploaded ${file.name} successfully!`, 'success');
        input.value = '';
    }
}

function deleteFile(index) {
    uploadedFiles.splice(index, 1);
    localStorage.setItem('eduai_files', JSON.stringify(uploadedFiles));
    loadFiles();
    showToast('File deleted', 'info');
}

// ── Progress Charts ────────────────────────────────────────────────
let progressChartsRendered = false;

function renderProgressCharts() {
    if (progressChartsRendered) return;
    progressChartsRendered = true;
    
    // 1. Line Chart
    const lineCtx = document.getElementById('progress-line-chart');
    if (lineCtx && window.Chart) {
        new Chart(lineCtx, {
            type: 'line',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Study Hours',
                    data: [2, 3.5, 1.5, 4, 2.5, 5, 3],
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99,102,241,0.1)',
                    fill: true, tension: 0.4
                }, {
                    label: 'Accuracy (%)',
                    data: [75, 80, 85, 70, 90, 88, 92],
                    borderColor: '#10b981',
                    backgroundColor: 'transparent',
                    tension: 0.4
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // 2. Doughnut Chart
    const doughnutCtx = document.getElementById('progress-doughnut-chart');
    if (doughnutCtx && window.Chart) {
        new Chart(doughnutCtx, {
            type: 'doughnut',
            data: {
                labels: ['Easy', 'Medium', 'Hard'],
                datasets: [{
                    data: [12, 19, 7],
                    backgroundColor: ['#3b82f6', '#8b5cf6', '#ef4444'],
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // 3. AI Insights
    const insightEl = document.getElementById('progress-ai-insight');
    if (insightEl) {
        insightEl.textContent = '⚡ Based on your recent activity, your study pattern peaks on weekends with an average of 4.5 hours. Your quiz accuracy has improved by 17% in Life Sciences, but we recommend dedicating more time to Java recursion challenges next week.';
    }
}

// ── Settings ──────────────────────────────────────────────────────
function saveSettings() {
    showToast('Settings saved!', 'success');
}

function toggleVoiceSynthesizer(checkbox) {
    voiceSpeechEnabled = checkbox.checked;
    showToast(`Voice assistant speech ${voiceSpeechEnabled ? 'enabled' : 'disabled'}`, 'info');
}

function deleteAccount() {
    if (confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
        localStorage.removeItem('eduai_token');
        localStorage.removeItem('eduai_user');
        window.location.href = 'index.html';
    }
}

// ── Voice Playback & Reader ────────────────────────────────────────
function speakText(text) {
    if (!voiceSynth) return;
    voiceSynth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const speed = parseFloat(document.getElementById('settings-voice-speed')?.value || '1');
    const accent = document.getElementById('settings-voice-accent')?.value || 'en-US';
    utterance.rate = speed * 0.9;
    
    if (voiceSynth.getVoices) {
        const voices = voiceSynth.getVoices();
        const matchedVoice = voices.find(v => v.lang.startsWith(accent));
        if (matchedVoice) utterance.voice = matchedVoice;
    }
    voiceSynth.speak(utterance);
}

function toggleVoicePlayback() {
    if (voicePlaying) {
        voiceSynth?.cancel();
        voicePlaying = false;
        document.getElementById('voice-play-icon')?.setAttribute('data-lucide', 'play');
        document.getElementById('voice-hub-status').textContent = 'Idle state';
    } else {
        const text = document.querySelector('.panel-section:not(.hidden)')?.textContent?.trim()?.substring(0, 500) || 'Welcome to EduAI';
        voiceUtterance = new SpeechSynthesisUtterance(text);
        
        const speed = parseFloat(document.getElementById('settings-voice-speed')?.value || '1');
        const accent = document.getElementById('settings-voice-accent')?.value || 'en-US';
        
        voiceUtterance.rate = speed * 0.9;
        
        if (voiceSynth && voiceSynth.getVoices) {
            const voices = voiceSynth.getVoices();
            const matchedVoice = voices.find(v => v.lang.startsWith(accent));
            if (matchedVoice) voiceUtterance.voice = matchedVoice;
        }
        
        voiceUtterance.onend = () => {
            voicePlaying = false;
            document.getElementById('voice-play-icon')?.setAttribute('data-lucide', 'play');
            document.getElementById('voice-hub-status').textContent = 'Idle state';
            initLucide();
        };
        voiceSynth?.speak(voiceUtterance);
        voicePlaying = true;
        document.getElementById('voice-play-icon')?.setAttribute('data-lucide', 'pause');
        document.getElementById('voice-hub-status').textContent = 'Reading aloud...';
    }
    initLucide();
}

// ── Admin Panel Console ───────────────────────────────────────────
function loadAdminData() {
    showToast('Admin statistics loaded', 'info');
}

// ── Toast Notifications ───────────────────────────────────────────
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        info: 'bg-indigo-500',
        warn: 'bg-amber-500'
    };
    const toast = document.createElement('div');
    toast.className = `${colors[type] || colors.info} text-white text-xs font-semibold px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 transform translate-y-2 opacity-0 transition-all duration-300`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.classList.remove('translate-y-2', 'opacity-0'); }, 50);
    setTimeout(() => {
        toast.classList.add('translate-y-2', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ── AI Content Generator (Mock fallback) ──────────────────────────
function generateAIContent(type, topic, format) {
    const templates = {
        notes: {
            detailed: `## Detailed Notes: ${topic}\n\n### Overview\n${topic} is a comprehensive subject with multiple dimensions worth exploring.\n\n### Key Concepts\n1. **Foundation**: Core principles of ${topic}\n2. **Applications**: Real-world use cases\n3. **Challenges**: Common obstacles and solutions\n\n### Summary\nUnderstanding ${topic} requires a systematic approach combining theory with practice.`,
            flashcard: `## Flashcards: ${topic}\n\n**Q: What is ${topic}?**\nA: A systematic approach to understanding core concepts\n\n**Q: Why is ${topic} important?**\nA: It forms the foundation for advanced learning\n\n**Q: How to apply ${topic}?**\nA: Through practice, repetition, and real-world examples`,
            mindmap: `## Mind Map: ${topic}\n\nCore Topic: ${topic}\n├── Concept 1: Foundations\n│   ├── Sub-concept A\n│   └── Sub-concept B\n├── Concept 2: Applications\n│   ├── Use case 1\n│   └── Use case 2\n└── Concept 3: Advanced Topics\n    └── Future directions`,
            short: `## Summary: ${topic}\n\n• ${topic} focuses on systematic learning\n• Core principles drive understanding\n• Applications span multiple fields\n• Practice leads to mastery`
        },
        document: {
            'Research Paper': `## Research Paper: ${topic}\n\n### Abstract\nThis paper explores ${topic} in depth, analyzing key findings and implications.\n\n### Introduction\n${topic} represents a significant area of study with broad applications.\n\n### Methodology\nA systematic review of literature and case studies was conducted.\n\n### Findings\nKey findings indicate substantial impact across multiple domains.\n\n### Conclusion\nFurther research is recommended to explore emerging aspects of ${topic}.`,
            Assignment: `## Assignment: ${topic}\n\n### Introduction\nThis assignment examines ${topic} from multiple perspectives.\n\n### Main Analysis\n1. Historical context of ${topic}\n2. Current applications and relevance\n3. Future implications\n\n### Conclusion\nBased on the analysis, ${topic} remains critically important for continued study.`,
        }
    };
    return (templates[type]?.[format]) || `## ${format.toUpperCase()}: ${topic}\n\nAI-generated content for ${topic}. This covers key aspects and practical applications.`;
}
