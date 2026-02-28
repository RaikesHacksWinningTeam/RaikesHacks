import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged, signOut, getIdToken } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = window.firebaseConfig;
export let db, auth;

try {
    if (firebaseConfig && firebaseConfig.apiKey) {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
    }
} catch (e) {
    console.error("Firebase initialization error:", e);
}

export {
    collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
    onAuthStateChanged, signOut, getIdToken
};
