// src/firebase.js
// ─────────────────────────────────────────────────────────
//  STEP 1: Go to https://console.firebase.google.com
//  STEP 2: Create a project (e.g. "gym-points")
//  STEP 3: Add a Web App inside the project
//  STEP 4: Copy your firebaseConfig values here
//  STEP 5: In Firebase console → Firestore Database → Create database (start in test mode)
// ─────────────────────────────────────────────────────────

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCCWVQWbpHBZ-WHfcBETQUD7N3Mb8LqbuA",
  authDomain: "gym-points-5a3fc.firebaseapp.com",
  projectId: "gym-points-5a3fc",
  storageBucket: "gym-points-5a3fc.firebasestorage.app",
  messagingSenderId: "944963792602",
  appId: "1:944963792602:web:ca7abeec3cccb886c97fe3"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
