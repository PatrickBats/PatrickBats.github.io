(async function trackVisitor() {
    try {
        if (!window.ANALYTICS_API) return;
        await fetch(`${window.ANALYTICS_API}/visit`, {
            method: 'POST',
            keepalive: true
        });
    } catch (e) {
        // Silently fail — don't break the site
    }
})();
