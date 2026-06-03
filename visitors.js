// Firebase config - REPLACE with your Firebase project config
const firebaseConfig = {
    apiKey: "AIzaSyDRrGfze4_GZC68KaLye07jU1B6RDmgKZQ",
    authDomain: "patrickbatsell-site.firebaseapp.com",
    databaseURL: "https://patrickbatsell-site-default-rtdb.firebaseio.com",
    projectId: "patrickbatsell-site",
    storageBucket: "patrickbatsell-site.firebasestorage.app",
    messagingSenderId: "225195511755",
    appId: "1:225195511755:web:0ce60580c71c0dd6880b04e",
    measurementId: "G-FB58K6QN89"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// Initialize map
const map = L.map('visitor-map', {
    center: [20, 0],
    zoom: 2,
    minZoom: 2,
    maxZoom: 6,
    scrollWheelZoom: false
});

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(map);

// Escape user-influenced strings before inserting as HTML
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Load and display all visits
db.ref('visits').on('value', (snapshot) => {
    const data = snapshot.val();
    if (!data) {
        document.getElementById('visitor-count').textContent = '0';
        document.getElementById('visit-log').innerHTML = '<p class="log-empty">No visits yet</p>';
        return;
    }

    const visits = Object.values(data);
    document.getElementById('visitor-count').textContent = visits.length.toLocaleString();

    // Render the log feed, newest first
    const logHtml = visits
        .slice()
        .sort((a, b) => b.timestamp - a.timestamp)
        .map(v => {
            const when = new Date(v.timestamp).toLocaleString();
            const where = escapeHtml(`${v.city}, ${v.country}`);
            return `<div class="log-entry"><span class="log-time">${when}</span><span class="log-location">${where}</span></div>`;
        })
        .join('');
    document.getElementById('visit-log').innerHTML = logHtml;

    // Aggregate by location
    const locations = {};
    visits.forEach(v => {
        const key = `${v.lat.toFixed(2)},${v.lon.toFixed(2)}`;
        if (!locations[key]) {
            locations[key] = { lat: v.lat, lon: v.lon, city: v.city, country: v.country, count: 0 };
        }
        locations[key].count++;
    });

    // Clear existing markers
    map.eachLayer(layer => {
        if (layer instanceof L.CircleMarker) map.removeLayer(layer);
    });

    // Add markers
    Object.values(locations).forEach(loc => {
        const radius = Math.min(4 + Math.log2(loc.count) * 3, 20);
        L.circleMarker([loc.lat, loc.lon], {
            radius: radius,
            fillColor: '#2563eb',
            color: '#2563eb',
            weight: 1,
            opacity: 0.8,
            fillOpacity: 0.5
        }).addTo(map).bindPopup(
            `<strong>${loc.city}, ${loc.country}</strong><br>${loc.count} visit${loc.count > 1 ? 's' : ''}`
        );
    });
});
