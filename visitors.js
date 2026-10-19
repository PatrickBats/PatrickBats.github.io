firebase.initializeApp({
    apiKey: 'AIzaSyDRrGfze4_GZC68KaLye07jU1B6RDmgKZQ',
    authDomain: 'patrickbatsell-site.firebaseapp.com',
    databaseURL: 'https://patrickbatsell-site-default-rtdb.firebaseio.com',
    projectId: 'patrickbatsell-site'
});
const auth = firebase.auth();
const ownerEmail = 'jbatsell65@gmail.com';
const el = id => document.getElementById(id);
const map = L.map('visitor-map', {center:[20,0],zoom:2,minZoom:2,maxZoom:6,scrollWheelZoom:false});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',maxZoom:19
}).addTo(map);
const markers = L.layerGroup().addTo(map);
let cursor = null;
let generation = 0;
let controller;
function clearPrivateData() {
    generation++;
    controller?.abort();
    markers.clearLayers();
    el('visit-log').replaceChildren();
    el('visitor-count').textContent = '0';
    el('next').disabled = true;
    cursor = null;
}
function render(rows, historical) {
    markers.clearLayers();
    el('visit-log').replaceChildren();
    el('visitor-count').textContent = rows.length;
    for (const v of rows) {
        const entry = document.createElement('div');
        entry.className = 'log-entry';
        const lines = [new Date(v.timestamp).toLocaleString(), `${v.city}, ${v.country}`,
            historical ? 'Historical record — IP was not stored' : `IP: ${v.ip}`,
            historical ? `Visitor ID: ${v.visitorId || 'Not recorded'}` : `Recorded visits from this IP: ${v.repeatCount}`];
        for (const text of lines) {
            const line = document.createElement('div');
            line.textContent = text;
            entry.append(line);
        }
        el('visit-log').append(entry);
        if (typeof v.lat === 'number' && typeof v.lon === 'number' && Number.isFinite(v.lat) && Number.isFinite(v.lon) && Math.abs(v.lat)<=90 && Math.abs(v.lon)<=180) {
            const popup = document.createElement('div');
            popup.textContent = `${v.city}, ${v.country}`;
            L.circleMarker([v.lat,v.lon],{radius:6,color:'#2563eb'}).addTo(markers).bindPopup(popup);
        }
    }
}
async function loadPage(reset = false) {
    const user = auth.currentUser;
    if (!user || user.email !== ownerEmail || !user.emailVerified) return;
    if (reset) cursor = null;
    const current = ++generation;
    controller?.abort();
    controller = new AbortController();
    el('next').disabled = true;
    el('auth-status').textContent = 'Loading private records…';
    try {
        const historical = el('record-source').value === 'legacy';
        let rows, next;
        if (historical) {
            let query = firebase.database().ref('visits').orderByChild('timestamp');
            if (cursor) query = query.endBefore(cursor.timestamp, cursor.key);
            const snapshot = await query.limitToLast(51).once('value');
            rows = [];
            snapshot.forEach(child => rows.push({...child.val(),key:child.key}));
            rows.reverse();
            const more = rows.length > 50;
            rows = rows.slice(0,50);
            next = more ? {timestamp:rows.at(-1).timestamp,key:rows.at(-1).key} : null;
        } else {
            if (!window.ANALYTICS_API) throw new Error('Private logging is awaiting deployment.');
            const token = await user.getIdToken();
            const response = await fetch(`${window.ANALYTICS_API}/visits${cursor ? `?before=${encodeURIComponent(cursor)}` : ''}`, {
                headers:{Authorization:`Bearer ${token}`},signal:controller.signal,cache:'no-store'
            });
            if (!response.ok) throw new Error('Unable to load private records. Check your account or retry.');
            ({visits:rows,next} = await response.json());
        }
        if (current !== generation || auth.currentUser?.uid !== user.uid) return;
        render(rows,historical);
        cursor = next;
        el('next').disabled = !next;
        el('auth-status').textContent = rows.length ? 'Private records loaded.' : 'No visits recorded yet.';
    } catch (error) {
        if (current !== generation) return;
        markers.clearLayers();
        el('visit-log').replaceChildren();
        el('visitor-count').textContent = '0';
        el('auth-status').textContent = error.message;
    }
}
el('sign-in').onclick = async () => {
    el('auth-status').textContent = 'Opening Google sign-in…';
    try {
        await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({prompt:'select_account'});
        await auth.signInWithPopup(provider);
    } catch (error) { el('auth-status').textContent = `Sign-in failed: ${error.message}`; }
};
el('sign-out').onclick = async () => { clearPrivateData(); await auth.signOut(); };
el('next').onclick = () => loadPage();
el('refresh').onclick = () => loadPage(true);
el('record-source').onchange = () => { clearPrivateData(); loadPage(true); };
auth.onAuthStateChanged(user => {
    clearPrivateData();
    const allowed = user?.email === ownerEmail && user.emailVerified;
    el('sign-in').hidden = !!user;
    el('sign-out').hidden = !user;
    el('private-controls').hidden = !allowed;
    el('auth-status').textContent = user ? 'This account does not have access.' : 'Sign in to view private visitor records.';
    if (allowed) loadPage(true);
});
