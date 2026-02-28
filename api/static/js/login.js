import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// Grab the config defined in the HTML
const firebaseConfig = JSON.parse(document.getElementById('firebase-config').textContent);

if (!firebaseConfig) {
    console.error("Firebase configuration missing!");
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

document.getElementById('btn-google-login').addEventListener('click', async () => {
    const btn = document.getElementById('btn-google-login');
    const originalHtml = btn.innerHTML;

    try {
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin" style="width: 18px; height: 18px;"></i> Signing in...';
        if (window.lucide) window.lucide.createIcons();

        const result = await signInWithPopup(auth, provider);
        const idToken = await result.user.getIdToken();

        btn.innerHTML = '<i data-lucide="loader-2" class="animate-spin" style="width: 18px; height: 18px;"></i> Creating Session...';
        if (window.lucide) window.lucide.createIcons();

        const response = await fetch('/api/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken })
        });

        const data = await response.json();
        if (data.status === 'success') {
            window.location.href = data.redirect_url || '/';
        } else {
            await auth.signOut();
            alert("Auth failed: " + (data.message || "Unknown error"));
            btn.disabled = false;
            btn.innerHTML = originalHtml;
            if (window.lucide) window.lucide.createIcons();
        }
    } catch (error) {
        console.error("Firebase Error:", error);
        alert("Google Error: " + error.message);
        btn.disabled = false;
        btn.innerHTML = originalHtml;
        if (window.lucide) window.lucide.createIcons();
    }
});