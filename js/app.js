// js/app.js — FINAL router hotfix
import { auth, db } from './firebase.js';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const view = document.getElementById('view');

// ---- Router (robust) ----
const routes = {
  '/login': renderLogin,
  '/trips': authGuard(renderTrips),
  '/join': authGuard(renderJoin)
};

function parseRoute(){
  // Examples handled: "#/trips", "#trips", "trips", "//#/trips?x=1"
  const raw = (location.hash || '#/login').replace(/^#+/, '');
  const [pathRaw, qsRaw] = raw.split('?');
  const normalized = '/' + pathRaw.replace(/^\/*/, ''); // ensure single leading '/'
  return { path: normalized, qs: new URLSearchParams(qsRaw) };
}

function navigate(){
  const { path, qs } = parseRoute();
  (routes[path] || renderNotFound)({ qs });
}
window.addEventListener('hashchange', navigate);

// Auth state → show user + guard
onAuthStateChanged(auth, (user) => {
  const userArea = document.getElementById('userArea');
  const userName = document.getElementById('userName');
  if (user) {
    userArea.classList.remove('hidden');
    userName.textContent = user.displayName || user.email || 'Inloggad';
    if (!location.hash || location.hash === '#/login') location.replace('#/trips');
  } else {
    userArea.classList.add('hidden');
    if (location.hash !== '#/login') location.replace('#/login');
  }
  navigate();
});

function authGuard(viewFn){
  return (ctx={}) => {
    if (!auth.currentUser) return renderLogin();
    return viewFn(ctx);
  };
}

function swapContent(node){
  view.innerHTML = '';
  view.appendChild(node);
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
    </section>`;

  const list = wrap.querySelector('#tripList');
  const uid = auth.currentUser.uid;

  const qTrips = query(collection(db, 'trips'), where('members', 'array-contains', uid));
  const unsub = onSnapshot(qTrips, (snap) => {
    list.innerHTML = '';
    if (snap.empty) {
      const li = document.createElement('li');
      li.className = 'p-4 rounded-xl border bg-white text-sm text-gray-600';
      li.innerHTML = 'Inga resor ännu. Klicka <strong>Ny resa</strong> för att skapa en.';
      list.appendChild(li);
      return;
    }
    snap.forEach(docSnap => {
      const t = docSnap.data();
      const li = document.createElement('li');
      li.className = 'p-4 rounded-xl border bg-white flex items-center justify-between gap-3';
      li.innerHTML = `
        <div>
          <div class="font-medium">${t.name ?? 'Namnlös resa'}</div>
          <div class="text-xs text-gray-500">Valuta: ${t.currency || 'SEK'} · TZ: ${t.timezone || 'Asia/Tokyo'}</div>
        </div>
        <div class="flex items-center gap-2">
          <button class="copyInvite px-3 py-1 rounded-xl border text-sm" data-id="${docSnap.id}">Kopiera inbjudan</button>
        </div>`;
      list.appendChild(li);
    });

    list.querySelectorAll('.copyInvite').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const ref = doc(db, 'trips', id);
        const snap2 = await getDoc(ref);
        const t = snap2.data();
        let token = t.inviteToken;
        if (!token) {
          token = randomToken();
          await updateDoc(ref, { inviteToken: token, updatedAt: serverTimestamp() });
        }
        const inviteUrl = `${location.origin}${location.pathname}#/join?trip=${id}&token=${token}`;
        await navigator.clipboard.writeText(inviteUrl);
        alert('Inbjudningslänk kopierad!\n' + inviteUrl);
      });
    });
  });

  wrap.querySelector('#newTripBtn').addEventListener('click', async () => {
    const name = prompt('Resans namn? (ex. Tokyo & Kansai – Sep/Oct 2025)');
    if (!name) return;
    const currency = prompt('Standardvaluta? Skriv SEK eller JPY', 'SEK')?.toUpperCase() === 'JPY' ? 'JPY' : 'SEK';
    const timezone = 'Asia/Tokyo';
    const token = randomToken();
    await addDoc(collection(db, 'trips'), {
      name, currency, timezone,
      admins: [uid],
      members: [uid],
      inviteToken: token,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  });

  const signOutBtn = document.getElementById('signOutBtn');
  signOutBtn.onclick = async () => { await signOut(auth); location.hash = '#/login'; };

  swapContent(wrap);
}

async function renderJoin({ qs }){
  const wrap = document.createElement('div');
  wrap.className = 'min-h-[50vh] grid place-items-center';
  const tripId = qs.get('trip');
  const token = qs.get('token');

  if (!tripId || !token) {
    wrap.innerHTML = `<div class="text-center"><h2 class="text-xl font-semibold mb-2">Ogiltig inbjudan</h2><p class="text-gray-600">Parametrar saknas.</p></div>`;
    return swapContent(wrap);
  }

  const ref = doc(db, 'trips', tripId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    wrap.innerHTML = `<div class="text-center"><h2 class="text-xl font-semibold mb-2">Hittar inte resan</h2></div>`;
    return swapContent(wrap);
  }
  const t = snap.data();
  if (t.inviteToken !== token) {
    wrap.innerHTML = `<div class="text-center"><h2 class="text-xl font-semibold mb-2">Fel inbjudningslänk</h2><p class="text-gray-600">Token stämmer inte.</p></div>`;
    return swapContent(wrap);
  }

  const uid = auth.currentUser.uid;
  if (!t.members?.includes(uid)) {
    await updateDoc(ref, { members: arrayUnion(uid), updatedAt: serverTimestamp() });
  }

  wrap.innerHTML = `<div class="text-center"><h2 class="text-xl font-semibold mb-2">Du har gått med i: ${t.name}</h2><a href="#/trips" class="mt-3 inline-block px-3 py-2 rounded-xl bg-black text-white">Till resor</a></div>`;
  swapContent(wrap);
}

function renderNotFound(){
  const wrap = document.createElement('div');
  wrap.className = 'min-h-[40vh] grid place-items-center text-center';
  wrap.innerHTML = `
    <div>
      <h2 class="text-2xl font-semibold mb-2">Sidan kunde inte hittas</h2>
      <p class="text-gray-600 mb-4">Gå till startsidan.</p>
      <a href="#/trips" class="px-3 py-2 rounded-xl bg-black text-white">Till appen</a>
    </div>`;
  swapContent(wrap);
}

function randomToken(n = 16){
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2,'0')).join('');
}
