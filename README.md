# 💪 Gym Points

A mobile-friendly web app for tracking gym attendance points and earning rewards. Works on iPhone & Android — no app store required!

---

## 🚀 Setup Guide (30 min, all free)

You need two free accounts: **GitHub** (hosts the app) and **Firebase** (saves everyone's data to the cloud).

---

## Part 1 — Firebase Setup

Firebase stores all the game data so everyone's progress syncs across phones in real time.

### 1A — Create a Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and sign in with a Google account
2. Click **"Create a project"** (or **"Add project"** if you've used Firebase before)
3. Enter a project name — e.g. `gym-points` — and click **Continue**
4. On the **Google Analytics** screen, you can turn it off (toggle it off) — it's not needed. Click **Create project**
5. Wait about 30 seconds while it sets up, then click **Continue** when it appears

You'll land on your **Project Overview** dashboard.

---

### 1B — Create a Firestore Database

This is where all your game data gets stored.

1. In the **left sidebar**, click **Build** to expand it
2. Click **Firestore Database** from the expanded menu
3. Click the **"Create database"** button
4. A setup wizard will open:
   - **Database ID**: Leave it as `(default)`
   - **Location**: Choose the region closest to you (e.g. `us-east1` for East Coast US) → click **Next**
   - **Security rules**: Select **"Start in test mode"** → click **Create**

> ⚠️ Test mode means anyone with your game code can read/write data. That's fine for a family game — but see the Security section at the bottom if you want to lock it down later.

Your database will be ready in about 30 seconds.

---

### 1C — Register a Web App & Get Your Config

This generates the credentials your app uses to connect to Firebase.

1. Click the **Firebase logo** in the top left to return to your Project Overview
2. In the center of the screen under "Get started by adding Firebase to your app", click the **web icon (`</>`)**
3. Enter a nickname — e.g. `gym-points-web` — and click **Register app**
   - You do **not** need to check "Also set up Firebase Hosting"
4. Firebase will display a code block with your `firebaseConfig`. It will look like this:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "gym-points-abc123.firebaseapp.com",
  projectId: "gym-points-abc123",
  storageBucket: "gym-points-abc123.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abc123def456"
};
```

5. **Copy this entire block** — you'll need it next
6. Click **Continue to console**

---

### 1D — Add Your Config to the App

1. Open the file `src/firebase.js` in any text editor
2. Replace the placeholder values with what you just copied:

```js
const firebaseConfig = {
  apiKey: "paste your value here",
  authDomain: "paste your value here",
  projectId: "paste your value here",
  storageBucket: "paste your value here",
  messagingSenderId: "paste your value here",
  appId: "paste your value here",
};
```

3. Save the file

---

## Part 2 — GitHub Setup

GitHub hosts the app for free and automatically rebuilds it whenever you make changes.

### 2A — Create a GitHub Account & Repo

1. Go to [github.com](https://github.com) and create a free account if you don't have one
2. Click the **"+"** icon in the top right → **"New repository"**
3. Name it `gym-points`, set it to **Public**, and click **Create repository**

---

### 2B — Update Your Username in package.json

Open `package.json` and find this line:

```json
"homepage": "https://YOUR_GITHUB_USERNAME.github.io/gym-points",
```

Replace `YOUR_GITHUB_USERNAME` with your actual GitHub username. Save the file.

---

### 2C — Upload the Files to GitHub

**Option A — Using GitHub's website (easiest, no terminal needed):**

1. On your new empty repo page, click **"uploading an existing file"**
2. Drag and drop all the files and folders from this project
3. Scroll down and click **"Commit changes"**

**Option B — Using Terminal/Command Prompt:**

```bash
cd path/to/gym-points-folder
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/gym-points.git
git push -u origin main
```

---

### 2D — Enable GitHub Pages

1. In your repo, click **Settings** (top tab)
2. In the left sidebar, click **Pages**
3. Under **Source**, select **"Deploy from a branch"**
4. Set Branch to **`gh-pages`** and folder to **`/ (root)`** → click **Save**

> The `gh-pages` branch is created automatically by GitHub Actions on your first push. If you don't see it yet, wait 2–3 minutes and refresh.

---

### 2E — Wait for Deployment (~3 minutes)

1. Go to your repo → click the **Actions** tab
2. Watch for the green checkmark ✅ on your workflow
3. Once it's done, your app is live at:

```
https://YOUR_USERNAME.github.io/gym-points
```

---

## 📱 Installing on iPhone

1. Open the app URL in **Safari** (must be Safari, not Chrome)
2. Tap the **Share button** (box with an arrow pointing up) at the bottom of the screen
3. Scroll down and tap **"Add to Home Screen"**
4. Tap **"Add"** in the top right

It appears as an app icon on your home screen — full screen, no browser bar! 🎉

---

## 📱 Installing on Android

1. Open the app URL in **Chrome**
2. Tap the **three-dot menu** (⋮) in the top right
3. Tap **"Add to Home screen"**
4. Tap **"Add"**

---

## 🎮 How to Play

1. **Create a Game** — one person taps "Create a New Game," picks their name/emoji/color, gets a 6-letter code
2. **Invite others** — tap "Invite" in the app to send the link via text or iMessage
3. **Join** — others open the link or enter the code, then pick their own name/emoji/color
4. **Log gym days** — tap Mon–Fri for +5 pts each, Saturday bonus for +10 pts
5. **Earn rewards:**
   - 40 pts → $20 reward 🎁
   - 80 pts → $40 reward 🏆
   - 120 pts → $60 reward 👑
6. **Claim** — when you unlock a tier, a banner appears — tap it to mark it claimed
7. **Reset** — at 120 pts or every 3 months, tap "Reset Game" to start fresh

### Rules
- Each 40-point section must be filled before starting the next
- Mon–Fri: +5 pts per day · Saturday: +10 pts bonus
- Each day can only be checked once per week (resets every Monday)
- Progress saves automatically — close the app anytime

---

## 🔐 Security (Optional — for later)

The database starts in "test mode" (open to anyone with your code). Fine for a private family game. To lock it down later:

1. Firebase Console → **Build** → **Firestore Database** → **Rules** tab
2. Replace with your desired rules (Firebase's docs have good examples)

---

## 📋 File Structure

```
gym-points/
├── src/
│   ├── App.jsx          ← all screens, game logic, and UI
│   ├── firebase.js      ← 🔑 PUT YOUR FIREBASE CONFIG HERE
│   └── index.js         ← app entry point
├── public/
│   ├── index.html       ← PWA-ready HTML
│   └── manifest.json    ← makes it installable on phones
├── .github/workflows/
│   └── deploy.yml       ← auto-deploys on every push
├── package.json         ← ✏️ UPDATE "homepage" with your GitHub username
└── README.md            ← this file
```

---

## 💰 Cost: Completely Free

- **GitHub Pages** — free static hosting
- **Firebase Spark plan** — free tier includes 50,000 reads and 20,000 writes per day, more than enough for a family game

---

Made with 💪 for gym accountability!
