// Import the required Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// Paste your web app configuration from the Firebase console here
const firebaseConfig = {
  apiKey: "",
  authDomain: "raikeshacks2026.firebaseapp.com",
  projectId: "raikeshacks2026",
  storageBucket: "raikeshacks2026.firebasestorage.app",
  messagingSenderId: "356467242949",
  appId: "1:356467242949:web:939c3079c63341755b7dac",
  measurementId: "G-S06HTHT7ZJ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

document.getElementById('google-signin-btn').addEventListener('click', () => {
    // Trigger the Google Sign-in popup
    signInWithPopup(auth, provider)
        .then((result) => {
            // Grab the secure ID Token
            return result.user.getIdToken();
        })
        .then((idToken) => {
            // Send the token to the Python backend
            return fetch('/api/auth/google', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken: idToken })
            });
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                // The cookie is now set in the browser. 
                // Redirect them to the main app page!
                window.location.href = '/';
            } else {
                console.error("Login failed on server:", data.message);
            }
        })
});