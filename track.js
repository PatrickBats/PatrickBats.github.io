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

// One-way hash so we can group repeat visitors without storing the real IP
async function hashIp(ip) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
    return Array.from(new Uint8Array(buf))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
        .slice(0, 12);
}

(async function trackVisitor() {
    try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();

        if (data.latitude && data.longitude) {
            const visitorId = data.ip ? await hashIp(data.ip) : 'unknown';
            db.ref('visits').push({
                visitorId: visitorId,
                lat: data.latitude,
                lon: data.longitude,
                city: data.city || 'Unknown',
                country: data.country_name || 'Unknown',
                timestamp: Date.now()
            });
        }
    } catch (e) {
        // Silently fail — don't break the site
    }
})();
