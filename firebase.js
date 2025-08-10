// js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// 🔐 NEW CONFIG from your new Firebase project
export const firebaseConfig = {
  apiKey: "AIzaSyA33va8PBth6HP7r1clA8QVvO08axEaOLo",
  authDomain: "japan2025-92e9d.firebaseapp.com",
  projectId: "japan2025-92e9d",
  storageBucket: "japan2025-92e9d.firebasestorage.app",
  messagingSenderId: "740917127797",
  appId: "1:740917127797:web:4be3c227b0287e2624263c"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
await setPersistence(auth, browserLocalPersistence);
