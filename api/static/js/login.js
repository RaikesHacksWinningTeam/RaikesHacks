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

document.getElementById('btn-google-login').addEventListener('click', () => {
    signInWithPopup(auth, provider)
        .then((result) => result.user.getIdToken())
        .then((idToken) => {
            return fetch('/api/auth/google', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken: idToken })
            });
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                window.location.href = '/';
            } else {
                alert("Auth failed: " + data.message);
            }
        })
        .catch((error) => console.error("Firebase Error:", error));
});