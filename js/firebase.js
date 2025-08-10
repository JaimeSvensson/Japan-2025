// Firebase init (modular CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyA33va8PBth6HP7r1clA8QVvO08axEaOLo",
  authDomain: "japan2025-92e9d.firebaseapp.com",
  projectId: "japan2025-92e9d",
  storageBucket: "japan2025-92e9d.firebasestorage.app",
  messagingSenderId: "740917127797",
  appId: "1:740917127797:web:4be3c227b0287e2624263c",
  measurementId: "G-P951ZJX13R"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
await setPersistence(auth, browserLocalPersistence);
export const db = getFirestore(app);
