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
  arrayUnion,
  orderBy,
  deleteDoc,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const view = document.getElementById('view');

// ---- Router ----
const routes = {
  '/login': renderLogin,
  '/trips': authGuard(renderTrips),
  '/join': authGuard(renderJoin),
  '/planner': authGuard(renderPlanner)
};
function parseRoute(){
  const raw = (location.hash || '#/login').replace(/^#+/, '');
  const [pathRaw, qsRaw] = raw.split('?');
  const normalized = '/' + pathRaw.replace(/^\/*/, '');
  return { path: normalized, qs: new URLSearchParams(qsRaw) };
}
function navigate(){
  const { path, qs } = parseRoute();
  (routes[path] || renderNotFound)({ qs });
}
window.addEventListener('hashchange', navigate);

// ---- Auth state ----
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
function swapContent(node){ view.innerHTML = ''; view.appendChild(node); }

// ---- Login ----
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
    try { await signInWithEmailAndPassword(auth, email.value, password.value); location.hash = '#/trips'; }
    catch (err) { msg.textContent = err.message; }
  });
  registerBtn.addEventListener('click', async () => {
    msg.textContent = '';
    try { await createUserWithEmailAndPassword(auth, email.value, password.value); location.hash = '#/trips'; }
    catch (err) { msg.textContent = err.message; }
  });
  googleBtn.addEventListener('click', async () => {
    msg.textContent = '';
    try { await signInWithPopup(auth, new GoogleAuthProvider()); location.hash = '#/trips'; }
    catch (err) { msg.textContent = err.message; }
  });

  swapContent(wrap);
}

// ---- Trips ----
function renderTrips(){
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <section class="space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-semibold">Dina resor</h2>
        <button id="newTripBtn" class="px-3 py-2 rounded-xl bg-black text-white">Ny resa</button>
      </div>
      <ul id="tripList" class="grid gap-3"></ul>
      <p id="tripMsg" class="text-sm text-red-600"></p>
    </section>`;

  const list = wrap.querySelector('#tripList');
  const msg = wrap.querySelector('#tripMsg');
  const uid = auth.currentUser.uid;

  const qTrips = query(collection(db, 'trips'), where('members', 'array-contains', uid));
  onSnapshot(qTrips, (snap) => {
    list.innerHTML = '';
    if (snap.empty) {
      const li = document.createElement('li');
      li.className = 'p-4 rounded-2xl border bg-white text-sm text-gray-600';
      li.innerHTML = 'Inga resor ännu. Klicka <strong>Ny resa</strong> för att skapa en.';
      list.appendChild(li); return;
    }
    snap.forEach(docSnap => {
      const t = docSnap.data();
      const li = document.createElement('li');
      li.className = 'p-4 rounded-2xl border bg-white flex items-center justify-between gap-3';
      li.innerHTML = `
        <div class="min-w-0">
          <a class="font-medium hover:underline block truncate" href="#/planner?trip=${docSnap.id}">${t.name ?? 'Namnlös resa'}</a>
          <div class="text-xs text-gray-500">Valuta: ${t.currency || 'SEK'} · TZ: ${t.timezone || 'Asia/Tokyo'}</div>
        </div>
        <div class="flex items-center gap-2">
          <button class="copyInvite px-3 py-1 rounded-xl border text-sm" data-id="${docSnap.id}">Kopiera inbjudan</button>
        </div>`;
      list.appendChild(li);
    });

    list.querySelectorAll('.copyInvite').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        try {
          const id = e.currentTarget.getAttribute('data-id');
          const ref = doc(db, 'trips', id);
          const snap2 = await getDoc(ref);
          const t = snap2.data();
          let token = t.inviteToken; if (!token) { token = randomToken(); await updateDoc(ref, { inviteToken: token, updatedAt: serverTimestamp() }); }
          const inviteUrl = `${location.origin}${location.pathname}#/join?trip=${id}&token=${token}`;
          await navigator.clipboard.writeText(inviteUrl);
          alert('Inbjudningslänk kopierad!\n' + inviteUrl);
        } catch (err) { msg.textContent = err.message; console.error(err); }
      });
    });
  }, (err) => { msg.textContent = `${err.code || 'error'} – ${err.message}`; console.error('Trips read error:', err); });

  wrap.querySelector('#newTripBtn').addEventListener('click', async () => {
    msg.textContent = '';
    try {
      const name = prompt('Resans namn? (ex. Tokyo & Kansai – Sep/Oct 2025)'); if (!name) return;
      const currency = prompt('Standardvaluta? Skriv SEK eller JPY', 'SEK')?.toUpperCase() === 'JPY' ? 'JPY' : 'SEK';
      const timezone = 'Asia/Tokyo';
      const token = randomToken();
      await addDoc(collection(db, 'trips'), { name, currency, timezone, admins: [uid], members: [uid], inviteToken: token, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    } catch (err) { msg.textContent = `${err.code || 'error'} – ${err.message}`; console.error(err); }
  });

  const signOutBtn = document.getElementById('signOutBtn');
  signOutBtn.onclick = async () => { await signOut(auth); location.hash = '#/login'; };

  swapContent(wrap);
}

// ---- Join ----
async function renderJoin({ qs }){
  const wrap = document.createElement('div'); wrap.className = 'min-h-[50vh] grid place-items-center';
  const tripId = qs.get('trip'); const token = qs.get('token');
  if (!tripId || !token) { wrap.innerHTML = `<div class="text-center"><h2 class="text-xl font-semibold mb-2">Ogiltig inbjudan</h2></div>`; return swapContent(wrap); }
  const ref = doc(db, 'trips', tripId); const snap = await getDoc(ref);
  if (!snap.exists()) { wrap.innerHTML = `<div class="text-center"><h2 class="text-xl font-semibold mb-2">Hittar inte resan</h2></div>`; return swapContent(wrap); }
  const t = snap.data(); if (t.inviteToken !== token) { wrap.innerHTML = `<div class="text-center"><h2 class="text-xl font-semibold mb-2">Fel inbjudningslänk</h2></div>`; return swapContent(wrap); }
  const uid = auth.currentUser.uid; if (!t.members?.includes(uid)) { await updateDoc(ref, { members: arrayUnion(uid), updatedAt: serverTimestamp() }); }
  wrap.innerHTML = `<div class="text-center"><h2 class="text-xl font-semibold mb-2">Du har gått med i: ${t.name}</h2><a href="#/trips" class="mt-3 inline-block px-3 py-2 rounded-xl bg-black text-white">Till resor</a></div>`;
  swapContent(wrap);
}

// ---- Planner (M2) ----
async function renderPlanner({ qs }){
  const tripId = qs.get('trip');
  const wrap = document.createElement('div');
  if (!tripId) { wrap.innerHTML = '<p>Ingen trip angiven.</p>'; return swapContent(wrap); }

  // Load trip meta
  const tref = doc(db, 'trips', tripId);
  const tsnap = await getDoc(tref);
  if (!tsnap.exists()) { wrap.innerHTML = '<p>Trip saknas.</p>'; return swapContent(wrap); }
  const trip = tsnap.data();
  const TZ = trip.timezone || 'Asia/Tokyo';

  // UI shell
  wrap.innerHTML = `
    <section class="space-y-4">
      <div class="flex items-center justify-between">
        <a href="#/trips" class="text-sm text-gray-600 hover:underline">← Tillbaka</a>
        <h2 class="text-xl font-semibold">${trip.name || 'Resa'}</h2>
        <span></span>
      </div>

      <div class="bg-white rounded-2xl border p-4 space-y-3">
        <h3 class="font-medium">Lägg till/ändra aktivitet</h3>
        <form id="actForm" class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label class="text-sm">Typ
            <select id="type" class="mt-1 w-full rounded-xl border px-3 py-2">
              <option value="train">Tåg</option>
              <option value="flight">Flyg</option>
              <option value="event">Event</option>
              <option value="other">Annat</option>
            </select>
          </label>
          <label class="text-sm">Titel
            <input id="title" class="mt-1 w-full rounded-xl border px-3 py-2" placeholder="t.ex. Shinkansen till Kyoto" />
          </label>
          <label class="text-sm">Datum
            <input id="date" type="date" class="mt-1 w-full rounded-xl border px-3 py-2" />
          </label>
          <div class="grid grid-cols-2 gap-3">
            <label class="text-sm">Starttid
              <input id="start" type="time" class="mt-1 w-full rounded-xl border px-3 py-2" />
            </label>
            <label class="text-sm">Sluttid (valfritt)
              <input id="end" type="time" class="mt-1 w-full rounded-xl border px-3 py-2" />
            </label>
          </div>
          <label class="text-sm md:col-span-2">Plats
            <input id="location" class="mt-1 w-full rounded-xl border px-3 py-2" placeholder="t.ex. Tokyo Station" />
          </label>
          <label class="text-sm md:col-span-2">Anteckningar
            <textarea id="notes" rows="2" class="mt-1 w-full rounded-xl border px-3 py-2"></textarea>
          </label>
          <input type="hidden" id="editingId" />
          <div class="md:col-span-2 flex gap-2">
            <button id="saveBtn" class="px-3 py-2 rounded-xl bg-black text-white" type="submit">Spara aktivitet</button>
            <button id="cancelEdit" class="px-3 py-2 rounded-xl border hidden" type="button">Avbryt</button>
            <span class="text-xs text-gray-500 self-center">Tidszon: ${TZ}</span>
          </div>
          <p id="formMsg" class="md:col-span-2 text-sm text-red-600"></p>
        </form>
      </div>

      <div id="days" class="space-y-6"></div>
    </section>`;

  // Pre-fill date to today in trip TZ
  const todayTZ = dayjs().tz(TZ).format('YYYY-MM-DD');
  wrap.querySelector('#date').value = todayTZ;

  // Helpers
  const toTs = (d, t) => {
    if (!d || !t) return null;
    const dt = dayjs.tz(`${d} ${t}`, 'YYYY-MM-DD HH:mm', TZ).toDate();
    return Timestamp.fromDate(dt);
  };
  const fmtTime = (ts) => ts ? dayjs(ts.toDate()).tz(TZ).format('HH:mm') : '';
  const dayKey = (ts) => dayjs(ts.toDate()).tz(TZ).format('YYYY-MM-DD');
  const dayLabel = (k) => dayjs.tz(k, 'YYYY-MM-DD', TZ).format('dddd D MMMM YYYY');
  const icon = (type) => ({ flight:'✈️', train:'🚄', event:'🎫', other:'📍' }[type] || '📍');

  // Save / Update
  const form = wrap.querySelector('#actForm');
  const formMsg = wrap.querySelector('#formMsg');
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); formMsg.textContent = '';
    try{
      const idEditing = wrap.querySelector('#editingId').value || null;
      const type = wrap.querySelector('#type').value;
      const title = wrap.querySelector('#title').value?.trim();
      const date = wrap.querySelector('#date').value;
      const start = wrap.querySelector('#start').value;
      const end = wrap.querySelector('#end').value;
      const location = wrap.querySelector('#location').value?.trim();
      const notes = wrap.querySelector('#notes').value?.trim();
      if (!title || !date || !start) throw new Error('Titel, datum och starttid krävs.');
      const payload = {
        type, title,
        start: toTs(date, start),
        end: end ? toTs(date, end) : null,
        location, notes,
        createdBy: auth.currentUser.uid,
        updatedAt: serverTimestamp(),
      };
      if (idEditing) {
        await updateDoc(doc(db, 'trips', tripId, 'activities', idEditing), payload);
      } else {
        await addDoc(collection(db, 'trips', tripId, 'activities'), { ...payload, createdAt: serverTimestamp() });
      }
      form.reset();
      wrap.querySelector('#date').value = todayTZ; // keep today
      wrap.querySelector('#editingId').value = '';
      wrap.querySelector('#cancelEdit').classList.add('hidden');
      wrap.querySelector('#saveBtn').textContent = 'Spara aktivitet';
    } catch(err){ formMsg.textContent = err.message; console.error(err); }
  });
  wrap.querySelector('#cancelEdit').addEventListener('click', () => {
    form.reset(); wrap.querySelector('#date').value = todayTZ; wrap.querySelector('#editingId').value = '';
    wrap.querySelector('#cancelEdit').classList.add('hidden');
    wrap.querySelector('#saveBtn').textContent = 'Spara aktivitet';
  });

  // List activities grouped by day
  const daysEl = wrap.querySelector('#days');
  const qActs = query(collection(db, 'trips', tripId, 'activities'), orderBy('start', 'asc'));
  onSnapshot(qActs, (snap) => {
    const groups = {};
    snap.forEach(docSnap => {
      const a = docSnap.data(); a.id = docSnap.id;
      if (!a.start) return; // guard
      const k = dayKey(a.start);
      (groups[k] ||= []).push(a);
    });
    daysEl.innerHTML = '';
    Object.keys(groups).sort().forEach(k => {
      const section = document.createElement('section');
      section.innerHTML = `<h3 class="font-semibold text-lg mb-2">${dayLabel(k)}</h3>`;
      const ul = document.createElement('ul'); ul.className = 'grid gap-2';
      groups[k].forEach(a => {
        const li = document.createElement('li');
        li.className = 'p-3 rounded-2xl border bg-white flex items-center justify-between gap-3';
        li.innerHTML = `
          <div class="min-w-0">
            <div class="font-medium truncate">${icon(a.type)} ${a.title}</div>
            <div class="text-xs text-gray-500">${fmtTime(a.start)}${a.end ? '–'+fmtTime(a.end) : ''}${a.location ? ' · ' + a.location : ''}</div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <button class="edit px-3 py-1 rounded-xl border text-sm" data-id="${a.id}">📝</button>
            <button class="del px-3 py-1 rounded-xl border text-sm" data-id="${a.id}">🗑️</button>
          </div>`;
        ul.appendChild(li);
      });
      section.appendChild(ul);
      daysEl.appendChild(section);
    });

    // Wire edit/delete
    daysEl.querySelectorAll('button.edit').forEach(btn => btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      const ref = doc(db, 'trips', tripId, 'activities', id);
      const s = await getDoc(ref); const a = s.data();
      wrap.querySelector('#editingId').value = id;
      wrap.querySelector('#type').value = a.type || 'other';
      wrap.querySelector('#title').value = a.title || '';
      const d = dayKey(a.start); // YYYY-MM-DD in TZ
      wrap.querySelector('#date').value = d;
      wrap.querySelector('#start').value = fmtTime(a.start);
      wrap.querySelector('#end').value = a.end ? fmtTime(a.end) : '';
      wrap.querySelector('#location').value = a.location || '';
      wrap.querySelector('#notes').value = a.notes || '';
      wrap.querySelector('#saveBtn').textContent = 'Spara ändringar';
      wrap.querySelector('#cancelEdit').classList.remove('hidden');
    }));
    daysEl.querySelectorAll('button.del').forEach(btn => btn.addEventListener('click', async (e) => {
      const id = e.currentTarget.dataset.id;
      if (!confirm('Ta bort aktiviteten?')) return;
      await deleteDoc(doc(db, 'trips', tripId, 'activities', id));
    }));
  });

  // Sign out wiring
  const signOutBtn = document.getElementById('signOutBtn');
  signOutBtn.onclick = async () => { await signOut(auth); location.hash = '#/login'; };

  swapContent(wrap);
}

// ---- Not Found ----
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

function randomToken(n = 16){ const bytes = new Uint8Array(n); crypto.getRandomValues(bytes); return Array.from(bytes).map(b => b.toString(16).padStart(2,'0')).join(''); }
