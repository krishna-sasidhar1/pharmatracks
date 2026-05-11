/* ================================================================
   PHARMATRACK — firebase-config.js
   ▶ Paste YOUR Firebase project config below.
   ▶ Get it from: Firebase Console → Project Settings → Your Apps → Web
   ================================================================ */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth }       from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore }  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── Replace ALL values below with your own Firebase project config ──
const firebaseConfig = {
    apiKey:            "AIzaSyDBdi_yT4Quw5Vs2HhVgt1EofjFt3J7iE0",
    authDomain:        "pharmatrack-76ae4.firebaseapp.com",
    projectId:         "pharmatrack-76ae4",
    storageBucket:     "pharmatrack-76ae4.firebasestorage.app",
    messagingSenderId: "205435349797",
    appId:             "1:205435349797:web:b5f372b875ad19246888cc"
};
// ────────────────────────────────────────────────────────────────

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db   = getFirestore(app);
