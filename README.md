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
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
