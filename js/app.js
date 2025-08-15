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
  setDoc,
  serverTimestamp,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  arrayUnion,
  orderBy,
  deleteDoc,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = (id) => document.getElementById(id);
const addClassSafe = (id, cls) => { const el = $(id); if (el) el.classList.add(cls); };
const removeClassSafe = (id, cls) => { const el = $(id); if (el) el.classList.remove(cls); };
const getNext = () => sessionStorage.getItem('next') || '#/trips';
const setNext = (hash) => sessionStorage.setItem('next', hash?.startsWith('#') ? hash : `#${hash || '/trips'}`);
const readNext = () => {
  const raw = (location.hash || '').replace(/^#+/, '');
  const qs  = new URLSearchParams(raw.split('?')[1] || '');
  const fromUrl = qs.get('next');
  if (fromUrl) return decodeURIComponent(fromUrl);
  return sessionStorage.getItem('next') || '#/trips';
};
// >>> PATCH: capture join target on boot
if (!auth.currentUser && location.hash.startsWith('#/join')) {
  // Spara målet så login kan hoppa tillbaka hit
  sessionStorage.setItem('next', location.hash);
}
// <<< PATCH

function toast(message, type = 'success', ms = 2800){
  const host = document.getElementById('toaster');
  if(!host) return alert(message);
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  host.appendChild(el);
  requestAnimationFrame(()=> el.classList.add('show'));
  setTimeout(()=>{
    el.classList.remove('show');
    el.addEventListener('transitionend', ()=> el.remove(), { once:true });
  }, ms);
}
const view = document.getElementById('view');

// ---- Router ----
// >>> PATCH: make /join public so we can capture it, and self-guard inside renderJoin
const routes = {
  '/login': renderLogin,
  '/trips': authGuard(renderTrips),
  '/join': renderJoin,                // <— no authGuard here
  '/planner': authGuard(renderPlanner),
  '/expenses': authGuard(renderExpenses),
  '/members': authGuard(renderMembers)
};
// <<< PATCH

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
navigate();

// ---- Auth state ----
// Alltid prioritera sparad "next" efter login
onAuthStateChanged(auth, (user) => {
  const nameEl = $('userName');
  if (nameEl) nameEl.textContent = user?.displayName || user?.email || 'Inloggad';

  const raw = (location.hash || '#/login').replace(/^#+/, '');
  const currentPath = '/' + raw.split('?')[0].replace(/^\/*/, '');

  if (!user) {
    if (currentPath !== '/login') {
      const want = location.hash || '#/trips';
      sessionStorage.setItem('next', want);
      location.replace(`#/login?next=${encodeURIComponent(want)}`);
      return;
    }
  } else {
    // INLOGGAD → hoppa ALLTID till sparad "next" om den finns, oavsett nuvarande path
    const qs     = new URLSearchParams(raw.split('?')[1] || '');
    const fromUrl = qs.get('next');
    const saved   = fromUrl ? decodeURIComponent(fromUrl) : sessionStorage.getItem('next');

    if (saved && saved !== '#/trips') {
      sessionStorage.removeItem('next');
      location.replace(saved);
      return;
    }

    // Ingen "next" → om vi står kvar på /login, gå till /trips
    if (currentPath === '/login') {
      location.replace('#/trips');
      return;
    }
  }

  navigate();
});

// >>> PATCH: authGuard remembers target
function authGuard(viewFn){
  return (ctx = {}) => {
    if (!auth.currentUser) {
      setNext(location.hash || '#/trips'); // <- kom ihåg join-länken
      return renderLogin();
    }
    return viewFn(ctx);
  };
}
// <<< PATCH
function swapContent(node){ view.innerHTML=''; view.appendChild(node); }

// ---- Utils ----
const dec = (c) => c === 'JPY' ? 0 : 2;
const toMinor = (amountStr, c) => { if (!amountStr) return 0; const n = Number(String(amountStr).replace(',','.')); return Math.round(n * Math.pow(10, dec(c))); };
const fmtMoney = (minor, c) => { const d = dec(c); const v = (minor / Math.pow(10, d)).toFixed(d); return `${v}\u00A0${c}`; };
const byId = (id) => document.getElementById(id);

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
  wrap.querySelector('#emailForm').addEventListener('submit', async (e)=>{
  e.preventDefault(); msg.textContent='';
  try {
    await signInWithEmailAndPassword(auth, byId('email').value, byId('password').value);
    // Ingen redirect här. onAuthStateChanged sköter omdirigeringen.
    msg.textContent = 'Inloggad – omdirigerar...';
  } catch(err){ msg.textContent = err.message; }
});
 wrap.querySelector('#registerBtn').addEventListener('click', async ()=>{
  msg.textContent='';
  try{
    await createUserWithEmailAndPassword(auth, byId('email').value, byId('password').value);
    // Ingen redirect här. onAuthStateChanged sköter omdirigeringen.
    msg.textContent = 'Konto skapat – omdirigerar...';
  }catch(err){ msg.textContent = err.message; }
});
 wrap.querySelector('#googleBtn').addEventListener('click', async ()=>{
  msg.textContent='';
  try{
    await signInWithPopup(auth, new GoogleAuthProvider());
    // Ingen redirect här. onAuthStateChanged sköter omdirigeringen.
    msg.textContent = 'Inloggad – omdirigerar...';
  }catch(err){ msg.textContent = err.message; }
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
      li.className='p-4 rounded-2xl border bg-white text-sm text-gray-600';
      li.innerHTML='Inga resor ännu. Klicka <strong>Ny resa</strong> för att skapa en.';
      list.appendChild(li); return;
    }

    snap.forEach(docSnap => {
      const t = docSnap.data();
      const canManage = (t.admins||[]).includes(uid) || t.createdBy === uid; // creator/admin only
      const li = document.createElement('li');
      li.className = 'p-4 rounded-2xl border bg-white flex items-center justify-between gap-3';
      li.innerHTML = `
        <div class="min-w-0">
          <a class="font-medium hover:underline block truncate" href="#/planner?trip=${docSnap.id}">${t.name ?? 'Namnlös resa'}</a>
          <div class="text-xs text-gray-500">Valuta: ${t.currency || 'SEK'} · TZ: ${t.timezone || 'Asia/Tokyo'}</div>
        </div>
        <div class="flex items-center gap-2">
          <a class="px-3 py-1 rounded-xl border text-sm" href="#/expenses?trip=${docSnap.id}">Utgifter</a>
          <a class="px-3 py-1 rounded-xl border text-sm" href="#/members?trip=${docSnap.id}">Medlemmar</a>
          ${canManage ? `<button class="renameTrip px-3 py-1 rounded-xl border text-sm" data-id="${docSnap.id}">Byt namn</button>
                         <button class="delTrip px-3 py-1 rounded-xl border text-sm" data-id="${docSnap.id}">Ta bort</button>` : ''}
          <button class="copyInvite px-3 py-1 rounded-xl border text-sm" data-id="${docSnap.id}">Kopiera inbjudan</button>
        </div>`;
      list.appendChild(li);
    });

    // copy invite (unchanged)
    list.querySelectorAll('.copyInvite').forEach(btn => btn.addEventListener('click', async (e)=>{
      try{
        const id = e.currentTarget.getAttribute('data-id');
        const ref = doc(db,'trips',id);
        const snap2 = await getDoc(ref);
        const t=snap2.data();
        let token=t.inviteToken;
        if(!token){
          token = crypto.getRandomValues(new Uint8Array(8)).reduce((s,b)=>s+b.toString(16).padStart(2,'0'),'');
          await updateDoc(ref,{inviteToken:token,updatedAt:serverTimestamp()});
        }
        const inviteUrl = `${location.origin}${location.pathname}#/join?trip=${id}&token=${token}`;
        await navigator.clipboard.writeText(inviteUrl);
        alert('Inbjudningslänk kopierad!\n'+inviteUrl);
      }catch(err){ msg.textContent = err.message; console.error(err); }
    }));

    // rename
    list.querySelectorAll('.renameTrip').forEach(btn => btn.addEventListener('click', async (e)=>{
      const id = e.currentTarget.getAttribute('data-id');
      const ref = doc(db,'trips',id);
      const snap = await getDoc(ref); const t = snap.data();
      const next = prompt('Nytt namn för resan:', t.name || '');
      if(!next) return;
      try{ await updateDoc(ref, { name: next.trim(), updatedAt: serverTimestamp() }); }
      catch(err){ alert(err.message); }
    }));

    // delete
    list.querySelectorAll('.delTrip').forEach(btn => btn.addEventListener('click', async (e)=>{
      const id = e.currentTarget.getAttribute('data-id');
      if(!confirm('Ta bort resan permanent? Alla aktiviteter/utgifter/regleringar raderas.')) return;
      try { await deleteTripCascade(id); }
      catch(err){ alert(err.message); }
    }));
  }, (err)=>{ msg.textContent = `${err.code||'error'} – ${err.message}`; console.error(err); });

  // create new
  wrap.querySelector('#newTripBtn').addEventListener('click', async ()=>{
    msg.textContent='';
    try{
      const name = prompt('Resans namn?'); if(!name) return;
      const currency = prompt('Standardvaluta? Skriv SEK eller JPY','SEK')?.toUpperCase()==='JPY'?'JPY':'SEK';
      const timezone='Asia/Tokyo';
      const token = crypto.getRandomValues(new Uint8Array(8)).reduce((s,b)=>s+b.toString(16).padStart(2,'0'),'');
      await addDoc(collection(db,'trips'),{
        name,
        currency,
        timezone,
        admins:[uid],      // admin = creator
        members:[uid],
        createdBy: uid,    // set creator for clarity
        inviteToken:token,
        createdAt:serverTimestamp(),
        updatedAt:serverTimestamp()
      });
    }catch(err){ msg.textContent = `${err.code||'error'} – ${err.message}`; console.error(err); }
  });

  // header sign out
  const signOutBtn = $('signOutBtn');
  if (signOutBtn) signOutBtn.onclick = async ()=>{ await signOut(auth); location.hash='#/login'; };

  swapContent(wrap);
}
// ---- Join ----
// >>> PATCH: renderJoin – self-guard + write-then-read
async function renderJoin({ qs }){
  const wrap = document.createElement('div');
  wrap.className = 'min-h-[50vh] grid place-items-center';

  const tripId = qs.get('trip');
  const token  = qs.get('token');

  if (!tripId || !token) {
    wrap.innerHTML = '<div class="text-center">Ogiltig inbjudan</div>';
    return swapContent(wrap);
  }

  // Not logged in? send to login and carry next in URL + session
  if (!auth.currentUser) {
    const want = `#/join?trip=${encodeURIComponent(tripId)}&token=${encodeURIComponent(token)}`;
    setNext(want);
    location.replace(`#/login?next=${encodeURIComponent(want)}`);
    return;
  }

  try {
    const ref = doc(db, 'trips', tripId);
    const uid = auth.currentUser.uid;

    // Write first: add self using the URL token (rules compare against resource.inviteToken)
    await updateDoc(ref, {
      members: arrayUnion(uid),
      inviteToken: token,
      updatedAt: serverTimestamp()
    });

    // Now read (you are a member)
    const snap = await getDoc(ref);
    const t = snap.exists() ? snap.data() : { name: 'Resa' };

    wrap.innerHTML = `
      <div class="text-center">
        <h2 class="text-xl font-semibold mb-2">Du har gått med i: ${t.name || 'Resa'}</h2>
        <a href="#/trips" class="mt-3 inline-block px-3 py-2 rounded-xl bg-black text-white">Till resor</a>
      </div>`;
  } catch (err) {
    console.error(err);
    wrap.innerHTML = `
      <div class="text-center">
        <p class="text-red-600 mb-2">Kunde inte gå med i resan: ${err.code || ''} ${err.message || ''}</p>
        <a href="#/trips" class="inline-block px-3 py-2 rounded-xl border">Till resor</a>
      </div>`;
  }

  swapContent(wrap);
}
// <<< PATCH

async function renderPlanner({ qs }) {
  const tripId = qs.get('trip');
  const wrap = document.createElement('div');
  if (!tripId) { wrap.innerHTML = '<p>Ingen trip angiven.</p>'; return swapContent(wrap); }

  const tref = doc(db, 'trips', tripId);
  const tsnap = await getDoc(tref);
  if (!tsnap.exists()) { wrap.innerHTML = '<p>Trip saknas.</p>'; return swapContent(wrap); }

  const trip = tsnap.data();
  const TZ = trip.timezone || 'Asia/Tokyo';

  // --- build UI first
  wrap.innerHTML = `
    <section class="space-y-4">
      <div class="flex items-center justify-between">
        <a href="#/trips" class="text-sm text-gray-600 hover:underline">← Tillbaka</a>
        <h2 class="text-xl font-semibold">${trip.name || 'Resa'}</h2>
        <a href="#/expenses?trip=${tripId}" class="text-sm px-3 py-1 rounded-xl border">Utgifter</a>
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
          <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
          <label class="text-sm md:col-span-2">Från – datum
            <input id="dateFrom" type="date" class="mt-1 w-full rounded-xl border px-3 py-2" />
          </label>
          <label class="text-sm md:col-span-2">Från – tid
            <input id="timeFrom" type="time" class="mt-1 w-full rounded-xl border px-3 py-2" />
          </label>
          <label class="text-sm md:col-span-2">Till – datum (valfritt)
            <input id="dateTo" type="date" class="mt-1 w-full rounded-xl border px-3 py-2" />
          </label>
          <label class="text-sm md:col-span-2">Till – tid (valfritt)
            <input id="timeTo" type="time" class="mt-1 w-full rounded-xl border px-3 py-2" />
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

  // ATTACH NOW so #ids exist in the DOM
  swapContent(wrap);

  // --- helpers
  const todayTZ = dayjs().tz(TZ).format('YYYY-MM-DD');
  byId('dateFrom').value = todayTZ;
  const toTs = (d,t)=>{ if(!d||!t) return null; const dt = dayjs.tz(`${d} ${t}`,'YYYY-MM-DD HH:mm',TZ).toDate(); return Timestamp.fromDate(dt); };
  const fmtTime = (ts)=> ts ? dayjs(ts.toDate()).tz(TZ).format('HH:mm') : '';
  const fmtDate = (ts) => ts ? dayjs(ts.toDate()).tz(TZ).format('ddd D MMM') : '';
  const fmtRange = (start, end) => {
    if (!start) return '';
    if (!end) return `${fmtTime(start)}`;
    const sameDay = dayKey(start) === dayKey(end);
    return sameDay
      ? `${fmtTime(start)}–${fmtTime(end)}`
      : `${fmtTime(start)} → ${fmtDate(end)} ${fmtTime(end)}`;
  };
  const dayKey = (ts)=> dayjs(ts.toDate()).tz(TZ).format('YYYY-MM-DD');
  const dayLabel = (k)=> dayjs.tz(k,'YYYY-MM-DD',TZ).format('dddd D MMMM YYYY');
  const icon = (type)=> ({flight:'✈️',train:'🚄',event:'🎫',other:'📍'}[type]||'📍');
  const esc = (s) => String(s || '').replace(/[&<>"']/g, m =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;'}[m]));

  const form = byId('actForm');
  const formMsg = byId('formMsg');
  form.addEventListener('submit', async (e)=>{
    e.preventDefault(); formMsg.textContent='';
    try{
      const idEditing = byId('editingId').value||null;
      const type=byId('type').value;
      const title=byId('title').value?.trim();
      const dateFrom = byId('dateFrom').value;
      const timeFrom = byId('timeFrom').value;
      const dateTo   = byId('dateTo').value;
      const timeTo   = byId('timeTo').value;
      const location=byId('location').value?.trim();
      const notes=byId('notes').value?.trim();
      if (!title || !dateFrom || !timeFrom) {
        throw new Error('Titel, från-datum och från-tid krävs.');
      }
      const startTs = toTs(dateFrom, timeFrom);
      let endTs = null;
      
      if (dateTo || timeTo) {
        if (!dateTo || !timeTo) {
          throw new Error('Ange både till-datum och till-tid (eller lämna båda tomma).');
        }
        endTs = toTs(dateTo, timeTo);
        if (endTs.toDate() < startTs.toDate()) {
          throw new Error('Sluttiden måste vara efter starttiden.');
        }
      }
      
      const payload = {
        type, title,
        start: startTs,
        end: endTs,
        location, notes,
        createdBy: auth.currentUser.uid,
        updatedAt: serverTimestamp()
      };
      if(idEditing){ await updateDoc(doc(db,'trips',tripId,'activities',idEditing),payload);} else { await addDoc(collection(db,'trips',tripId,'activities'),{...payload,createdAt:serverTimestamp()}); }
      form.reset();
      byId('dateFrom').value = todayTZ;
      byId('editingId').value = '';
      byId('cancelEdit').classList.add('hidden');
      byId('saveBtn').textContent = 'Spara aktivitet';
    }catch(err){ formMsg.textContent=err.message; console.error(err);} });
  byId('cancelEdit').addEventListener('click',()=>{
  form.reset();
  byId('dateFrom').value = todayTZ;
  byId('editingId').value = '';
  byId('cancelEdit').classList.add('hidden');
  byId('saveBtn').textContent = 'Spara aktivitet';
});
  const daysEl = byId('days');
  const qActs = query(collection(db,'trips',tripId,'activities'), orderBy('start','asc'));
  onSnapshot(qActs,(snap)=>{
    const groups={};
    snap.forEach(ds=>{ const a=ds.data(); a.id=ds.id; if(!a.start) return; const k=dayKey(a.start); (groups[k] ||= []).push(a);});
    daysEl.innerHTML='';
    Object.keys(groups).sort().forEach(k=>{
      const section=document.createElement('section');
      section.innerHTML=`<h3 class="font-semibold text-lg mb-2">${dayLabel(k)}</h3>`;
      const ul=document.createElement('ul'); ul.className='grid gap-2';
      groups[k].forEach(a=>{
        const li=document.createElement('li');
        li.className='p-3 rounded-2xl border bg-white flex items-center justify-between gap-3';
        li.innerHTML = `
  <div class="min-w-0">
    <div class="font-medium truncate">${icon(a.type)} ${a.title}</div>
    <div class="text-xs text-gray-500">
      ${fmtRange(a.start, a.end)}${a.location ? ' · ' + a.location : ''}
    </div>
    ${a.notes ? `<div class="mt-1 text-xs text-gray-600 whitespace-pre-line">${esc(a.notes)}</div>` : ''}
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
    daysEl.querySelectorAll('button.edit').forEach(btn =>
  btn.addEventListener('click', async (e) => {
    const id  = e.currentTarget.dataset.id;
    const ref = doc(db, 'trips', tripId, 'activities', id);
    const s   = await getDoc(ref);
    const a   = s.data();

    byId('editingId').value = id;
    byId('type').value      = a.type || 'other';
    byId('title').value     = a.title || '';

    // Nya fält (från/till)
    byId('dateFrom').value  = dayKey(a.start);
    byId('timeFrom').value  = fmtTime(a.start);

    if (a.end) {
      byId('dateTo').value = dayKey(a.end);
      byId('timeTo').value = fmtTime(a.end);
    } else {
      byId('dateTo').value = '';
      byId('timeTo').value = '';
    }

    byId('location').value  = a.location || '';
    byId('notes').value     = a.notes || '';

    byId('saveBtn').textContent = 'Spara ändringar';
    byId('cancelEdit').classList.remove('hidden');

    // Scrolla upp till formuläret för bättre UX
    window.scrollTo({ top: 0, behavior: 'smooth' });
  })
);
    daysEl.querySelectorAll('button.del').forEach(btn=>btn.addEventListener('click', async(e)=>{ const id=e.currentTarget.dataset.id; if(!confirm('Ta bort aktiviteten?')) return; await deleteDoc(doc(db,'trips',tripId,'activities',id)); }));
  });

  const signOutBtn = $('signOutBtn');
  if (signOutBtn) signOutBtn.onclick = async ()=>{ await signOut(auth); location.hash='#/login'; };
}
async function deleteTripCascade(tripId) {
  const colls = ['activities', 'expenses', 'settlements', 'members'];
  for (const c of colls) {
    const snap = await getDocs(collection(db, 'trips', tripId, c));
    const deletions = snap.docs.map(d => deleteDoc(doc(db, 'trips', tripId, c, d.id)));
    await Promise.all(deletions);
  }
  await deleteDoc(doc(db, 'trips', tripId));
}

// ---- Members (trip-local display names) ----
async function renderMembers({ qs }){
  const tripId = qs.get('trip');
  const wrap = document.createElement('div'); if(!tripId){ wrap.innerHTML='<p>Ingen trip angiven.</p>'; return swapContent(wrap); }
  const tref=doc(db,'trips',tripId); const ts=await getDoc(tref); if(!ts.exists()){ wrap.innerHTML='<p>Trip saknas.</p>'; return swapContent(wrap);} const trip=ts.data();
  wrap.innerHTML = `
    <section class="space-y-4">
      <div class="flex items-center justify-between">
        <a href="#/trips" class="text-sm text-gray-600 hover:underline">← Resor</a>
        <h2 class="text-xl font-semibold">${trip.name || 'Resa'} – Medlemmar</h2>
        <span></span>
      </div>
      <ul id="list" class="grid gap-2"></ul>
      <p class="text-xs text-gray-500">Namnen gäller bara i denna resa. Varje användare kan ändra sitt eget namn.</p>
    </section>`;

  const list = wrap.querySelector('#list');
  const uid = auth.currentUser.uid;
  const memberIds = trip.members || [];

  function renderRows(map){
    list.innerHTML='';
    memberIds.forEach(muid=>{
      const data = map[muid] || { displayName: '', email: '' };
      const li = document.createElement('li');
      li.className='p-3 rounded-2xl border bg-white flex items-center justify-between gap-3';
      const canEdit = (muid===uid) || (trip.admins||[]).includes(uid);
      li.innerHTML = `
        <div class="min-w-0">
          <div class="text-sm text-gray-500 truncate">${data.email || ''}</div>
          <div class="font-medium truncate">${data.displayName || '(namn saknas)'}${muid===uid?' (du)':''}</div>
        </div>
        <div class="shrink-0">
          ${canEdit?`<button class="edit px-3 py-1 rounded-xl border text-sm" data-uid="${muid}">Ändra</button>`:''}
        </div>`;
      list.appendChild(li);
    });
    list.querySelectorAll('button.edit').forEach(btn=>btn.addEventListener('click', async(e)=>{
      const tUid=e.currentTarget.dataset.uid; const current=rowsMap[tUid]?.displayName||''; const name=prompt('Nytt visningsnamn:', current)||''; if(name.trim()==='') return; await setDoc(doc(db,'trips',tripId,'members',tUid),{ displayName:name.trim(), email: rowsMap[tUid]?.email || '', updatedAt: serverTimestamp() }, { merge:true });
    }));
  }

  const rowsMap = {}; // uid -> {displayName,email}
  // live listen for member docs
  onSnapshot(collection(db,'trips',tripId,'members'), (snap)=>{
    snap.forEach(ds=>{ rowsMap[ds.id] = ds.data(); });
    // auto-create current user's member doc if missing
    if(!rowsMap[uid]){
      const u = auth.currentUser;
      setDoc(doc(db,'trips',tripId,'members',uid),{ displayName: u.displayName||u.email||'Du', email: u.email||'', createdAt: serverTimestamp() },{ merge:true });
    }
    renderRows(rowsMap);
  });

  swapContent(wrap);
}

// ---- Expenses (Edit + Balances + Settle Up) ----
async function renderExpenses({ qs }) {
  const tripId = qs.get('trip');
  const wrap = document.createElement('div');
  if (!tripId) { wrap.innerHTML = '<p>Ingen trip angiven.</p>'; return swapContent(wrap); }

  const tref = doc(db, 'trips', tripId);
  const tsnap = await getDoc(tref);
  if (!tsnap.exists()) { wrap.innerHTML = '<p>Trip saknas.</p>'; return swapContent(wrap); }

  const trip = tsnap.data();
  const members = trip.members || [auth.currentUser.uid];
  const baseC = trip.currency || 'SEK';
  const TZ = trip.timezone || 'Asia/Tokyo';

  // names map (filled later)
  const nameMap = {};
  const nameOf = (uid)=> nameMap[uid] || (uid===auth.currentUser.uid?'Du':`Medlem ${members.indexOf(uid)+1}`);

  // --- build UI first
  wrap.innerHTML = `
    <section class="space-y-4">
      <div class="flex items-center justify-between">
        <a href="#/trips" class="text-sm text-gray-600 hover:underline">← Resor</a>
        <h2 class="text-xl font-semibold">${trip.name || 'Resa'} – Utgifter</h2>
        <div class="flex items-center gap-2">
          <a href="#/planner?trip=${tripId}" class="text-sm px-3 py-1 rounded-xl border">Planner</a>
          <a href="#/members?trip=${tripId}" class="text-sm px-3 py-1 rounded-xl border">Medlemmar</a>
        </div>
      </div>
      <div class="bg-white rounded-2xl border p-4 space-y-3">
        <h3 class="font-medium">Nytt utlägg</h3>
        <form id="expForm" class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input type="hidden" id="editingExpId" />
          <label class="text-sm">Titel
            <input id="title" class="mt-1 w-full rounded-xl border px-3 py-2" placeholder="t.ex. Lunch" />
          </label>
          <label class="text-sm">Datum
            <input id="date" type="date" class="mt-1 w-full rounded-xl border px-3 py-2" />
          </label>
          <div class="grid grid-cols-3 gap-3 md:col-span-2">
            <label class="text-sm col-span-1">Belopp
              <input id="amount" type="number" step="0.01" class="mt-1 w-full rounded-xl border px-3 py-2" />
            </label>
            <label class="text-sm col-span-1">Valuta
              <select id="curr" class="mt-1 w-full rounded-xl border px-3 py-2">
                <option value="${baseC}">${baseC}</option>
                <option value="${baseC==='SEK'?'JPY':'SEK'}">${baseC==='SEK'?'JPY':'SEK'}</option>
              </select>
            </label>
            <label class="text-sm col-span-1">Kurs (<span id="rateLabel"></span>)
              <input id="rate" type="number" step="0.001" class="mt-1 w-full rounded-xl border px-3 py-2" placeholder="t.ex. 0.073" />
            </label>
          </div>
          <label class="text-sm">Betalare
            <select id="paidBy" class="mt-1 w-full rounded-xl border px-3 py-2"></select>
          </label>
          <div class="md:col-span-2">
            <div class="text-sm mb-1">Inblandade</div>
            <div id="involved" class="flex flex-wrap gap-2"></div>
          </div>
          <div class="md:col-span-2">
            <div class="flex items-center justify-between">
              <div class="text-sm">Delning
                <select id="mode" class="ml-2 rounded-xl border px-2 py-1 text-sm">
                  <option value="exact">Exakta belopp</option>
                </select>
                <button id="equalBtn" type="button" class="ml-2 px-2 py-1 rounded-xl border text-sm">Dela lika</button>
                <button id="cancelEditBtn" type="button" class="ml-2 px-2 py-1 rounded-xl border text-sm hidden">Avbryt ändring</button>
              </div>
              <div id="basePreview" class="text-xs text-gray-500"></div>
            </div>
            <div id="splitArea" class="mt-2 grid gap-2"></div>
          </div>
          <label class="text-sm md:col-span-2">Anteckningar
            <textarea id="notes" rows="2" class="mt-1 w-full rounded-xl border px-3 py-2"></textarea>
          </label>
          <div class="md:col-span-2 flex gap-2">
            <button class="px-3 py-2 rounded-xl bg-black text-white" type="submit">Spara</button>
            <span class="text-xs text-gray-500 self-center">Huvudvaluta: ${baseC}</span>
          </div>
          <p id="formMsg" class="md:col-span-2 text-sm text-red-600"></p>
        </form>
      </div>
      <div class="bg-white rounded-2xl border p-4 space-y-3">
        <h3 class="font-medium">Utlägg</h3>
        <ul id="expList" class="grid gap-2"></ul>
      </div>
      <div class="bg-white rounded-2xl border p-4 space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="font-medium">Skulder</h3>
          <button id="suggestBtn" class="px-3 py-1 rounded-xl border text-sm">Föreslå överföringar</button>
        </div>
        <div id="balances" class="flex flex-wrap gap-2"></div>
        <div id="suggestions" class="grid gap-2"></div>
        <div>
          <h4 class="font-medium mt-2">Regleringar</h4>
          <ul id="settlementsList" class="grid gap-1 text-sm"></ul>
        </div>
      </div>
    </section>`;

  // ATTACH NOW so #ids exist in the DOM
  swapContent(wrap);

  // --- DOM refs & helpers (safe now) ---
  const dateInput = byId('date');
  const paidBySel = byId('paidBy');
  const involvedEl = byId('involved');
  const currSel = byId('curr');
  const rateInput = byId('rate');
  const rateLabel = byId('rateLabel');
  const basePreview = byId('basePreview');
  const amountInput = byId('amount');
  const modeSel = byId('mode');
  const splitArea = byId('splitArea');
  const formMsg = byId('formMsg');
  const expList = byId('expList');
  const balancesEl = byId('balances');
  const settlementsList = byId('settlementsList');
  const suggestionsEl = byId('suggestions');

  function updateRateLabel(){
    const c = currSel.value;
  
    if (c === baseC) {
      rateLabel.textContent = '1:1';
      rateInput.disabled = true;
      rateInput.value = '';
    } else {
      rateInput.disabled = false;
      if (c === 'JPY' && baseC === 'SEK') {
        rateLabel.textContent = '1 JPY → SEK';
      } else if (c === 'SEK' && baseC === 'JPY') {
        rateLabel.textContent = '1 SEK → JPY';
      } else {
        rateLabel.textContent = `1 ${c} → ${baseC}`;
      }
    }
  
    previewBase();
  }

  function previewBase(){ const c=currSel.value; const amt=toMinor(amountInput.value,c); let baseMinor=amt; if(c!==baseC){ const r=Number(rateInput.value||'0'); if(r>0){ const major=amt/Math.pow(10,dec(c)); baseMinor=Math.round(major*r*Math.pow(10,dec(baseC))); } } basePreview.textContent = amt?`≈ ${fmtMoney(baseMinor,baseC)} i ${baseC}`:''; return baseMinor; }
  function getSelectedMembers(){ return Array.from(involvedEl.querySelectorAll('input[type=checkbox]:checked')).map(cb=>cb.value);} 
  // --- JPY -> SEK via öppet API (dagscache i localStorage) ---
  async function fetchJPYtoSEK() {
    const today = dayjs().format('YYYY-MM-DD');
    const key = `JPY_SEK_${today}`;
    const cached = localStorage.getItem(key);
    if (cached) return Number(cached);
  
    const res = await fetch('https://api.frankfurter.app/latest?from=JPY&to=SEK', { cache: 'no-store' });    if (!res.ok) throw new Error('Kunde inte hämta kurs (API).');
    const data = await res.json();
    const rate = data && data.rates && typeof data.rates.SEK === 'number' ? data.rates.SEK : null;
    if (!rate) throw new Error('Oväntat svar från kurs-API.');
  
    // rensa äldre cache-nycklar för JPY_SEK_
    Object.keys(localStorage).forEach(k => { if (k.startsWith('JPY_SEK_') && k !== key) localStorage.removeItem(k); });
    localStorage.setItem(key, String(rate));
    return rate;
  }
  function renderSplitInputs(){
  splitArea.innerHTML='';
  const sel=getSelectedMembers();
  if(sel.length===0){ splitArea.innerHTML='<p class="text-sm text-gray-500">Välj minst en person.</p>'; return;}
  sel.forEach(uid=>{
    const row=document.createElement('div');
    row.className='grid grid-cols-3 items-center gap-2';
    const label=document.createElement('div'); label.className='text-sm'; label.textContent=nameOf(uid); row.appendChild(label);
    const input=document.createElement('input');
    input.className='col-span-2 rounded-xl border px-3 py-2';
    input.type='number';
    input.dataset.uid = uid;                          
    input.step = dec(baseC) === 0 ? '1' : '0.01';     
    input.placeholder = `${baseC}`;  
    row.appendChild(input);
    splitArea.appendChild(row);
  });
}
function equalize(){
  const sel = getSelectedMembers();
  const inputs = Array.from(splitArea.querySelectorAll('input'));
  if (sel.length === 0) return;

  const baseMinor = previewBase();
  const share = Math.floor(baseMinor / sel.length);
  const r = baseMinor - share * sel.length;

  inputs.forEach((i, idx) => {
    const minor = share + (idx < r ? 1 : 0);
    i.value = (minor / Math.pow(10, dec(baseC))).toFixed(dec(baseC));
  });
}
 function populateMembersUI(){ paidBySel.innerHTML=''; members.forEach(uid=>{ const opt=document.createElement('option'); opt.value=uid; opt.textContent=nameOf(uid); paidBySel.appendChild(opt); }); involvedEl.innerHTML=''; members.forEach(uid=>{ const lbl=document.createElement('label'); lbl.className='px-2 py-1 rounded-xl border text-sm flex items-center gap-2'; lbl.innerHTML=`<input type="checkbox" value="${uid}" class="peer"> <span>${nameOf(uid)}</span>`; involvedEl.appendChild(lbl); }); involvedEl.querySelectorAll('input[type=checkbox]').forEach(cb=>{ if(cb.value===auth.currentUser.uid) cb.checked=true; }); }

  // Prefill + wire
  const todayTZ = dayjs().tz(TZ).format('YYYY-MM-DD');
  dateInput.value = todayTZ;
  currSel.addEventListener('change', async () => {
  updateRateLabel();
  if (baseC === 'SEK' && currSel.value === 'JPY') {
    try {
      const rate = await fetchJPYtoSEK();
      const rounded = Math.round(rate * 1000) / 1000;
      rateInput.value = String(rounded);
      previewBase();
    } catch (err) {
      console.error(err);
      // Låt manuell inmatning gälla om hämtningen misslyckas
    }
  }
});
  rateInput.addEventListener('input',previewBase);
  amountInput.addEventListener('input',previewBase);
  modeSel.addEventListener('change',renderSplitInputs);
  involvedEl.addEventListener('change',renderSplitInputs);
  byId('equalBtn').addEventListener('click',equalize);
  updateRateLabel();

  if (baseC === 'SEK' && currSel.value === 'JPY') {
  fetchJPYtoSEK()
    .then(rate => {
      const rounded = Math.round(rate * 1000) / 1000;
      rateInput.value = String(rounded);
      previewBase();
    })
    .catch(() => {/* tyst fallback till manuell kurs */});
}

  // Names live
  onSnapshot(collection(db,'trips',tripId,'members'), (snap)=>{ snap.forEach(ds=>{ const d=ds.data(); if(d?.displayName) nameMap[ds.id]=d.displayName; }); populateMembersUI(); renderSplitInputs(); });

  // Data live
  let expensesCache=[]; let settlementsCache=[];
  onSnapshot(query(collection(db,'trips',tripId,'expenses'), orderBy('dateTs','desc')),(snap)=>{ expensesCache=[]; snap.forEach(ds=>{ const e=ds.data(); e.id=ds.id; expensesCache.push(e); }); renderExpList(); renderBalances(); });
  onSnapshot(query(collection(db,'trips',tripId,'settlements'), orderBy('createdAt','desc')),(snap)=>{ settlementsCache=[]; snap.forEach(ds=>{ const s=ds.data(); s.id=ds.id; settlementsCache.push(s); }); renderSettlements(); renderBalances(); });

  // Save / Update
  byId('expForm').addEventListener('submit', async (e)=>{
    e.preventDefault(); formMsg.textContent='';
    try{
      const editingId = byId('editingExpId').value || null;
      const title = byId('title').value?.trim() || 'Utgift';
      const dateStr = dateInput.value; if(!dateStr) throw new Error('Datum krävs.');
      const amountMajor = Number(String(amountInput.value).replace(',','.')) || 0; if(amountMajor<=0) throw new Error('Belopp måste vara > 0');
      const expenseC = currSel.value; const baseMinor = previewBase(); if(baseMinor<=0) throw new Error('Sätt korrekt kurs/belopp.');
      const paidBy = paidBySel.value; const inv = getSelectedMembers(); if(inv.length===0) throw new Error('Välj inblandade.');
      const mode = modeSel.value;
      let split={}; const inputs=Array.from(splitArea.querySelectorAll('input'));
      if(mode==='exact'){ let sum=0; inputs.forEach(i=>{ const uid=i.dataset.uid; const m=toMinor(i.value,baseC); split[uid]=m; sum+=m; }); if(sum!==baseMinor) throw new Error('Summan av exakta belopp måste vara lika med totalsumman.'); }
      const dateTs = Timestamp.fromDate(dayjs.tz(dateStr,'YYYY-MM-DD',TZ).toDate());
      const expense={ title, dateTs, expenseCurrency: expenseC, amountOriginalMinor: toMinor(amountInput.value,expenseC), baseCurrency: baseC, baseAmountMinor: baseMinor, rateToBase: expenseC===baseC?1:Number(rateInput.value||'0'), paidBy, involved: inv, splitMode: mode, splitBase: split, notes: byId('notes').value?.trim()||'', createdBy: auth.currentUser.uid, updatedAt: serverTimestamp() };
      if(editingId){ await updateDoc(doc(db,'trips',tripId,'expenses',editingId), expense);} else { await addDoc(collection(db,'trips',tripId,'expenses'), { ...expense, createdAt: serverTimestamp() }); }
      e.target.reset(); updateRateLabel(); renderSplitInputs(); basePreview.textContent=''; dateInput.value=todayTZ; byId('editingExpId').value=''; byId('cancelEditBtn').classList.add('hidden');
    }catch(err){ formMsg.textContent=err.message; console.error(err); }
  });
  byId('cancelEditBtn').addEventListener('click',()=>{ byId('expForm').reset(); dateInput.value=todayTZ; byId('editingExpId').value=''; byId('cancelEditBtn').classList.add('hidden'); updateRateLabel(); renderSplitInputs(); });

  // List + balances + settlements
  function renderExpList(){
    expList.innerHTML='';
    expensesCache.forEach(e=>{
      const li=document.createElement('li'); li.className='p-3 rounded-2xl border bg-white flex items-center justify-between gap-3';
      const dateStr = e.dateTs ? dayjs(e.dateTs.toDate()).tz(TZ).format('YYYY-MM-DD') : '';
      li.innerHTML = `
        <div class="min-w-0">
          <div class="font-medium truncate">${e.title || 'Utgift'}</div>
          <div class="text-xs text-gray-500">${dateStr} · Betalat: ${nameOf(e.paidBy)} · Summa: ${fmtMoney(e.baseAmountMinor, baseC)} ${e.expenseCurrency!==baseC?`(orig ${fmtMoney(e.amountOriginalMinor,e.expenseCurrency)} @${e.rateToBase})`:''}</div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button class="editExp px-3 py-1 rounded-xl border text-sm" data-id="${e.id}">📝</button>
          <button class="delExp px-3 py-1 rounded-xl border text-sm" data-id="${e.id}">🗑️</button>
        </div>`;
      expList.appendChild(li);
    });
    expList.querySelectorAll('button.delExp').forEach(btn=>btn.addEventListener('click', async(ev)=>{ const id=ev.currentTarget.dataset.id; if(!confirm('Ta bort utgiften?')) return; await deleteDoc(doc(db,'trips',tripId,'expenses',id)); }));
    expList.querySelectorAll('button.editExp').forEach(btn =>
      btn.addEventListener('click', async (ev) => {
        const id = ev.currentTarget.dataset.id;
        const s = await getDoc(doc(db, 'trips', tripId, 'expenses', id));
        const e = s.data();
    
        byId('editingExpId').value = id;
        byId('title').value = e.title || '';
        dateInput.value = dayjs(e.dateTs.toDate()).tz(TZ).format('YYYY-MM-DD');
        byId('curr').value = e.expenseCurrency || baseC;
    
        byId('amount').value = (
          e.amountOriginalMinor / Math.pow(10, dec(e.expenseCurrency || baseC))
        ).toFixed(dec(e.expenseCurrency || baseC));
    
        byId('rate').value = (typeof e.rateToBase === 'number')
          ? String(Math.round(e.rateToBase * 1000) / 1000)
          : (e.rateToBase || '')
        paidBySel.value = e.paidBy;
    
        // Markera inblandade
        involvedEl.querySelectorAll('input[type=checkbox]').forEach(cb => {
          cb.checked = (e.involved || []).includes(cb.value);
        });
    
        // Läge: endast "exakt"
        modeSel.value = e.splitMode || 'exact';
    
        // Bygg split-inputs och fyll med exakta belopp
        renderSplitInputs();
        const inputs = Array.from(splitArea.querySelectorAll('input'));
        inputs.forEach(i => {
          const uid = i.dataset.uid;
          const m = (e.splitBase || {})[uid] || 0; // minor i baseC
          i.value = (m / Math.pow(10, dec(baseC))).toFixed(dec(baseC));
        });
    
        byId('notes').value = e.notes || '';
        byId('cancelEditBtn').classList.remove('hidden');
    
        window.scrollTo({ top: 0, behavior: 'smooth' });
      })
    );
  }
  function renderSettlements(){
    settlementsList.innerHTML='';
    settlementsCache.forEach(s=>{ const li=document.createElement('li'); li.innerHTML=`${nameOf(s.from)} → ${nameOf(s.to)}: <strong>${fmtMoney(s.amountMinor||0, s.currency||baseC)}</strong> <button data-id="${s.id}" class="ml-2 px-2 py-0.5 rounded-xl border text-xs delSet">Ta bort</button>`; settlementsList.appendChild(li); });
    settlementsList.querySelectorAll('button.delSet').forEach(btn=>btn.addEventListener('click', async(e)=>{ const id=e.currentTarget.dataset.id; if(!confirm('Ta bort regleringen?')) return; await deleteDoc(doc(db,'trips',tripId,'settlements',id)); }));
  }
  function renderBalances(){
    const net={}; members.forEach(u=>net[u]=0);
    expensesCache.forEach(e=>{ net[e.paidBy]=(net[e.paidBy]||0)+(e.baseAmountMinor||0); if(e.splitBase) Object.entries(e.splitBase).forEach(([u,share])=>{ net[u]=(net[u]||0)-share; }); });
    settlementsCache.forEach(s=>{ const amt=s.amountMinor||0; net[s.from]=(net[s.from]||0)+amt; net[s.to]=(net[s.to]||0)-amt; });
    balancesEl.innerHTML=''; members.forEach(u=>{ const v=net[u]||0; const chip=document.createElement('span'); chip.className=`px-3 py-1 rounded-full text-sm border ${v>0?'bg-green-50 text-green-700 border-green-200':(v<0?'bg-red-50 text-red-700 border-red-200':'bg-gray-50 text-gray-600 border-gray-200')}`; chip.textContent=`${nameOf(u)}: ${fmtMoney(Math.abs(v),baseC)} ${v>=0?'+':'-'}`; balancesEl.appendChild(chip); });
    renderBalances.net = net;
  }

  byId('suggestBtn').addEventListener('click',()=>{
    const net={...(renderBalances.net||{})};
    const creditors=Object.entries(net).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
    const debtors=Object.entries(net).filter(([,v])=>v<0).sort((a,b)=>a[1]-b[1]);
    const suggestions=[]; let i=0,j=0;
    while(i<creditors.length && j<debtors.length){ const [cu,cv]=creditors[i]; const [du,dv]=debtors[j]; const give=Math.min(cv,-dv); suggestions.push({from:du,to:cu,amount:give}); creditors[i][1]-=give; debtors[j][1]+=give; if(creditors[i][1]===0) i++; if(debtors[j][1]===0) j++; }
    renderSuggestions(suggestions);
  });
  function renderSuggestions(list){ suggestionsEl.innerHTML=''; if(list.length===0){ suggestionsEl.textContent='Inga överföringar föreslagna – alla är kvitt.'; return; } list.forEach(s=>{ const row=document.createElement('div'); row.className='flex items-center justify-between rounded-xl border p-2'; row.innerHTML=`<div>${nameOf(s.from)} → ${nameOf(s.to)}: <strong>${fmtMoney(s.amount,baseC)}</strong></div>`; const btn=document.createElement('button'); btn.className='px-3 py-1 rounded-xl border text-sm'; btn.textContent='Markera som reglerad'; btn.addEventListener('click', async()=>{ await addDoc(collection(db,'trips',tripId,'settlements'),{ from:s.from,to:s.to,amountMinor:s.amount,currency:baseC,createdAt:serverTimestamp(),createdBy:auth.currentUser.uid }); }); row.appendChild(btn); suggestionsEl.appendChild(row); }); }

  const signOutBtn = $('signOutBtn');
  if (signOutBtn) signOutBtn.onclick = async ()=>{ await signOut(auth); location.hash='#/login'; };
}

// ---- Not Found ----
function renderNotFound(){ const wrap=document.createElement('div'); wrap.className='min-h-[40vh] grid place-items-center text-center'; wrap.innerHTML=`<div><h2 class="text-2xl font-semibold mb-2">Sidan kunde inte hittas</h2><p class="text-gray-600 mb-4">Gå till startsidan.</p><a href="#/trips" class="px-3 py-2 rounded-xl bg-black text-white">Till appen</a></div>`; swapContent(wrap); }
