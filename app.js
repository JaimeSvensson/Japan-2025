// js/app.js
import { auth } from './firebase.js';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

const view = document.getElementById('view');

// Routes
const routes = {
  '/login': renderLogin,
  '/trips': authGuard(renderTrips)
};

function navigate(hash){
  const path = (hash || location.hash || '#/login').replace('#','');
  (routes[path] || renderNotFound)();
}
window.addEventListener('hashchange', () => navigate());

// Auth state → show user + guard
onAuthStateChanged(auth, (user) => {
  const userArea = document.getElementById('userArea');
  const userName = document.getElementById('userName');
  if (user) {
    userArea.classList.remove('hidden');
    userName.textContent = user.displayName || user.email || 'Inloggad';
    if (location.hash === '' || location.hash === '#/login') location.replace('#/trips');
  } else {
    userArea.classList.add('hidden');
    if (location.hash !== '#/login') location.replace('#/login');
  }
  navigate();
});

function authGuard(viewFn){
  return () => {
    if (!auth.currentUser) return renderLogin();
    return viewFn();
  }
}

function swapContent(html){
  view.innerHTML = '';
  view.appendChild(html);
}

function renderLogin(){
  const wrap = document.createElement('div');
  wrap.className = 'min-h-[60vh] grid place-items-center';
  wrap.innerHTML = `
    <section class="w-full max-w-sm bg-white rounded-2xl shadow p-6">
      <h2 class="text-xl font-semibold mb-1">Logga in</h2>
      <p class="text-sm text-gray-600 mb-4">E‑post/lösenord eller Google.</p>
      <form id="emailForm" class="space-y-2">
        <label class="block text-sm">E‑post
          <input id="email" type="email" required class="mt-1 w-full rounded-xl border px-3 py-2" />
        </label>
        <label class="block text-sm">Lösenord
          <input id="password" type="password" required class="mt-1 w-full rounded-xl border px-3 py-2" />
        </label>
        <div class="flex gap-2 pt-2">
          <button class="flex-1 py-2 rounded-xl bg-black text-white" type="submit">Logga in</button>
          <button id="registerBtn" class="flex-1 py-2 rounded-xl border" type="button">Registrera</button>
        </div>
      </form>
      <div class="my-4 flex items-center gap-2 text-xs text-gray-500">
        <span class="h-px flex-1 bg-gray-200"></span><span>eller</span><span class="h-px flex-1 bg-gray-200"></span>
      </div>
      <button id="googleBtn" class="w-full py-2 rounded-xl border">Fortsätt med Google</button>
      <p id="authMsg" class="text-sm text-red-600 mt-3"></p>
    </section>`;

  const msg = wrap.querySelector('#authMsg');
  const emailForm = wrap.querySelector('#emailForm');
  const email = wrap.querySelector('#email');
  const password = wrap.querySelector('#password');
  const registerBtn = wrap.querySelector('#registerBtn');
  const googleBtn = wrap.querySelector('#googleBtn');

  emailForm.addEventListener('submit', async (e) => {
    e.preventDefault(); msg.textContent = '';
    try {
      await signInWithEmailAndPassword(auth, email.value, password.value);
      location.hash = '#/trips';
    } catch (err) { msg.textContent = err.message; }
  });
  registerBtn.addEventListener('click', async () => {
    msg.textContent = '';
    try {
      await createUserWithEmailAndPassword(auth, email.value, password.value);
      location.hash = '#/trips';
    } catch (err) { msg.textContent = err.message; }
  });
  googleBtn.addEventListener('click', async () => {
    msg.textContent = '';
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      location.hash = '#/trips';
    } catch (err) { msg.textContent = err.message; }
  });

  swapContent(wrap);
}

function renderTrips(){
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <section class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-semibold">Dina resor</h2>
        <button id="newTripBtn" class="px-3 py-2 rounded-xl bg-black text-white">Ny resa</button>
      </div>
      <ul id="tripList" class="grid gap-2"></ul>
      <p class="text-sm text-gray-500">(M0-placeholder) Nästa steg: koppla Firestore.</p>
    </section>`;

  const list = wrap.querySelector('#tripList');
  const li = document.createElement('li');
  li.className = 'p-4 rounded-xl border bg-white';
  li.textContent = 'Tokyo & Kansai – Sep/Oct 2025 (exempel)';
  list.appendChild(li);

  const btn = wrap.querySelector('#newTripBtn');
  btn.addEventListener('click', () => alert('M1 kommer: Skapa resa i Firestore'));

  const signOutBtn = document.getElementById('signOutBtn');
  signOutBtn.onclick = async () => { await signOut(auth); location.hash = '#/login'; };

  swapContent(wrap);
}

function renderNotFound(){
  const wrap = document.createElement('div');
  wrap.className = 'min-h-[40vh] grid place-items-center text-center';
  wrap.innerHTML = `
    <div>
      <h2 class="text-2xl font-semibold mb-2">Sidan kunde inte hittas</h2>
      <p class="text-gray-600 mb-4">Gå till startsidan.</p>
      <a href="/#/trips" class="px-3 py-2 rounded-xl bg-black text-white">Till appen</a>
    </div>`;
  swapContent(wrap);
}
