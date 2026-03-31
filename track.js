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

(async function trackVisitor() {
    try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();

        if (data.latitude && data.longitude) {
            db.ref('visits').push({
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
