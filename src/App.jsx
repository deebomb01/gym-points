import { useState, useEffect, useCallback } from "react";
import {
  doc, getDoc, setDoc, updateDoc, onSnapshot,
  collection, addDoc, serverTimestamp, arrayUnion
} from "firebase/firestore";
import { db } from "./firebase";

// ─── Constants ───────────────────────────────────────────
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const TIER_1 = 40, TIER_2 = 80, TIER_3 = 120;
const REWARDS = [
  { pts: 40,  label: "$20 Reward", icon: "🎁", color: "#e07b54" },
  { pts: 80,  label: "$40 Reward", icon: "🏆", color: "#c0392b" },
  { pts: 120, label: "$60 Reward", icon: "👑", color: "#8e44ad" },
];
const EMOJIS = ["💪","⭐","🔥","🏃","🦁","⚡","🎯","🥊","🚀","🌟"];
const COLORS = ["#e07b54","#5b8dd9","#2ecc71","#f1c40f","#e91e63","#00bcd4","#ff9800","#9c27b0"];

// ─── Helpers ─────────────────────────────────────────────
function getWeekKey() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  return `${monday.getFullYear()}-${monday.getMonth()}-${monday.getDate()}`;
}

function generateGameCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function generatePlayerId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ─── Styles ──────────────────────────────────────────────
const S = {
  app: {
    minHeight: "100vh",
    background: "#0d0d0d",
    color: "#fff",
    fontFamily: "'Segoe UI', system-ui, sans-serif",
    paddingBottom: 60,
  },
  header: {
    background: "linear-gradient(180deg, #161616 0%, #0d0d0d 100%)",
    borderBottom: "1px solid #1e1e1e",
    padding: "env(safe-area-inset-top, 16px) 20px 16px",
    textAlign: "center",
  },
  title: {
    fontFamily: "'Bebas Neue', 'Arial Black', sans-serif",
    fontSize: 36,
    letterSpacing: 4,
    background: "linear-gradient(135deg, #e07b54, #5b8dd9)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    lineHeight: 1,
  },
  subtitle: {
    fontSize: 11,
    color: "#555",
    fontFamily: "monospace",
    marginTop: 4,
    letterSpacing: 2,
  },
  container: {
    maxWidth: 480,
    margin: "0 auto",
    padding: "0 16px",
  },
  card: {
    background: "#161616",
    border: "1px solid #222",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
  },
  btn: (color = "#e07b54", outline = false) => ({
    padding: "13px 20px",
    borderRadius: 12,
    border: outline ? `1.5px solid ${color}` : "none",
    background: outline ? "transparent" : color,
    color: outline ? color : "#fff",
    fontFamily: "monospace",
    fontSize: 13,
    fontWeight: "bold",
    cursor: "pointer",
    width: "100%",
    letterSpacing: 1,
    transition: "opacity 0.15s",
    WebkitTapHighlightColor: "transparent",
  }),
  input: {
    width: "100%",
    padding: "13px 16px",
    borderRadius: 12,
    border: "1.5px solid #2a2a2a",
    background: "#111",
    color: "#fff",
    fontSize: 15,
    fontFamily: "monospace",
    outline: "none",
    letterSpacing: 1,
  },
  label: {
    fontSize: 11,
    color: "#666",
    fontFamily: "monospace",
    letterSpacing: 1,
    display: "block",
    marginBottom: 6,
  },
  fieldGroup: { marginBottom: 14 },
};

// ─── Sub-components ───────────────────────────────────────

function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div style={{
      position: "fixed", top: 24, left: "50%", transform: "translateX(-50%)",
      background: "#1e1e1e", border: "1px solid #333", borderRadius: 12,
      padding: "10px 24px", fontFamily: "monospace", fontSize: 13, color: "#fff",
      zIndex: 999, boxShadow: "0 8px 40px #000a",
      whiteSpace: "nowrap", maxWidth: "90vw",
    }}>{msg}</div>
  );
}

function EmojiPicker({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {EMOJIS.map(e => (
        <button key={e} onClick={() => onChange(e)} style={{
          fontSize: 22, padding: 6, borderRadius: 10,
          background: value === e ? "#2a2a2a" : "transparent",
          border: `1.5px solid ${value === e ? "#555" : "transparent"}`,
          cursor: "pointer",
        }}>{e}</button>
      ))}
    </div>
  );
}

function ColorPicker({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {COLORS.map(c => (
        <button key={c} onClick={() => onChange(c)} style={{
          width: 28, height: 28, borderRadius: "50%",
          background: c, border: `2.5px solid ${value === c ? "#fff" : "transparent"}`,
          cursor: "pointer",
        }} />
      ))}
    </div>
  );
}

function ProgressBar({ points }) {
  const pct = Math.min((points / TIER_3) * 100, 100);
  const tier = points >= TIER_3 ? 2 : points >= TIER_2 ? 1 : points >= TIER_1 ? 0 : -1;
  const barColor = tier >= 0 ? REWARDS[tier].color : "#444";
  return (
    <div>
      <div style={{ height: 16, borderRadius: 8, background: "#1e1e1e", overflow: "hidden", position: "relative" }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          background: barColor,
          borderRadius: 8,
          transition: "width 0.5s cubic-bezier(.4,2,.6,1)",
          boxShadow: tier >= 0 ? `0 0 12px ${barColor}66` : "none",
        }} />
        {[TIER_1, TIER_2].map(t => (
          <div key={t} style={{
            position: "absolute", top: 0, bottom: 0,
            left: `${(t / TIER_3) * 100}%`, width: 2, background: "#333",
          }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 9, fontFamily: "monospace" }}>
        {[0, 40, 80, 120].map((v, i) => (
          <span key={v} style={{ color: i === 0 ? "#555" : REWARDS[i - 1]?.color }}>{v}</span>
        ))}
      </div>
    </div>
  );
}

function PlayerCard({ player, isMe, onCheckin, onClaim, gameId }) {
  const wk = getWeekKey();
  const checkins = player.weekKey === wk ? (player.checkins || {}) : {};
  const points = player.points || 0;
  const claimed = player.claimed || [];

  const claimable = REWARDS.find(r => r.pts <= points && !claimed.includes(r.pts));
  const nextReward = REWARDS.find(r => r.pts > points && !claimed.includes(r.pts));

  return (
    <div style={{
      ...S.card,
      border: isMe ? `1px solid ${player.color}55` : "1px solid #222",
      position: "relative",
      overflow: "hidden",
    }}>
      {isMe && (
        <div style={{
          position: "absolute", top: 0, right: 0,
          background: player.color,
          fontSize: 9, fontFamily: "monospace", padding: "3px 10px",
          borderBottomLeftRadius: 8, color: "#fff", letterSpacing: 1,
        }}>YOU</div>
      )}

      {/* Glow */}
      <div style={{
        position: "absolute", top: -50, right: -50, width: 140, height: 140,
        borderRadius: "50%", background: `${player.color}10`, filter: "blur(40px)",
        pointerEvents: "none",
      }} />

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 26 }}>{player.emoji || "💪"}</span>
          <div>
            <div style={{
              fontFamily: "'Bebas Neue', 'Arial Black', sans-serif",
              fontSize: 22, color: player.color || "#fff", letterSpacing: 1.5, lineHeight: 1,
            }}>{player.name}</div>
            <div style={{ fontSize: 10, color: "#555", fontFamily: "monospace", marginTop: 2 }}>
              {(() => {
                const sec = points >= TIER_2 ? 2 : points >= TIER_1 ? 1 : 0;
                const inSec = points - sec * 40;
                return `SECTION ${sec + 1} · ${inSec}/40 pts`;
              })()}
            </div>
          </div>
        </div>
        <div style={{
          fontFamily: "'Bebas Neue', 'Arial Black', sans-serif",
          fontSize: 52, color: player.color || "#fff", lineHeight: 1,
          textShadow: `0 0 24px ${player.color || "#fff"}44`,
        }}>{points}</div>
      </div>

      <ProgressBar points={points} />

      {/* Section progress bars */}
      <div style={{ display: "flex", gap: 6, margin: "14px 0" }}>
        {REWARDS.map((r, i) => {
          const secStart = i * 40;
          const filled = Math.min(Math.max(points - secStart, 0), 40);
          const isDone = points >= r.pts;
          const isActive = !isDone && Math.floor(points / 40) === i;
          return (
            <div key={r.pts} style={{ flex: 1 }}>
              <div style={{ fontSize: 9, fontFamily: "monospace", color: isDone ? r.color : "#444", textAlign: "center", marginBottom: 3 }}>
                {r.label}
              </div>
              <div style={{
                height: 6, borderRadius: 3, background: "#1e1e1e",
                border: `1px solid ${isActive ? r.color + "44" : "#222"}`,
                overflow: "hidden",
              }}>
                <div style={{
                  height: "100%", width: `${(filled / 40) * 100}%`,
                  background: r.color, borderRadius: 3,
                  transition: "width 0.4s ease",
                }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Claimable reward */}
      {claimable && isMe && (
        <button onClick={() => onClaim(claimable.pts)} style={{
          width: "100%", padding: "10px 16px", borderRadius: 12, marginBottom: 12,
          background: `linear-gradient(135deg, ${claimable.color}22, ${claimable.color}11)`,
          border: `1px solid ${claimable.color}66`,
          color: "#fff", cursor: "pointer", textAlign: "left",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 13, fontFamily: "monospace" }}>
            {claimable.icon} {claimable.label} UNLOCKED!
          </span>
          <span style={{
            fontSize: 11, background: claimable.color, borderRadius: 6,
            padding: "2px 10px", fontFamily: "monospace",
          }}>CLAIM →</span>
        </button>
      )}

      {/* Day buttons — only show for "me" */}
      {isMe && (
        <div style={{ display: "flex", gap: 5 }}>
          {DAYS.map(day => {
            const key = `${wk}-${day}`;
            const checked = !!checkins[key];
            return (
              <button key={day} onClick={() => !checked && onCheckin(day, 5)} style={{
                flex: 1, padding: "9px 2px",
                borderRadius: 10, cursor: checked ? "default" : "pointer",
                border: `1.5px solid ${checked ? (player.color || "#e07b54") : "#2a2a2a"}`,
                background: checked ? `${player.color || "#e07b54"}22` : "#111",
                color: checked ? (player.color || "#e07b54") : "#444",
                fontFamily: "monospace", fontSize: 10,
                WebkitTapHighlightColor: "transparent",
              }}>
                <div>{day}</div>
                <div style={{ marginTop: 2 }}>{checked ? "✓" : "+5"}</div>
              </button>
            );
          })}
          {(() => {
            const key = `${wk}-Sat`;
            const checked = !!checkins[key];
            return (
              <button onClick={() => !checked && onCheckin("Sat", 10)} style={{
                flex: 1, padding: "9px 2px",
                borderRadius: 10, cursor: checked ? "default" : "pointer",
                border: `1.5px solid ${checked ? "#f1c40f" : "#2a2a2a"}`,
                background: checked ? "#f1c40f22" : "#111",
                color: checked ? "#f1c40f" : "#444",
                fontFamily: "monospace", fontSize: 10,
                WebkitTapHighlightColor: "transparent",
              }}>
                <div>⭐Sat</div>
                <div style={{ marginTop: 2 }}>{checked ? "✓" : "+10"}</div>
              </button>
            );
          })()}
        </div>
      )}

      {/* For other players — show their days as read-only */}
      {!isMe && (
        <div style={{ display: "flex", gap: 5 }}>
          {[...DAYS, "Sat"].map(day => {
            const key = `${wk}-${day}`;
            const checked = !!checkins[key];
            return (
              <div key={day} style={{
                flex: 1, padding: "7px 2px", borderRadius: 10, textAlign: "center",
                background: checked ? `${player.color || "#e07b54"}22` : "#111",
                border: `1px solid ${checked ? (player.color || "#e07b54") + "44" : "#1e1e1e"}`,
                fontSize: 10, fontFamily: "monospace",
                color: checked ? (player.color || "#e07b54") : "#333",
              }}>
                <div>{day}</div>
                <div style={{ marginTop: 2 }}>{checked ? "✓" : "·"}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", gap: 16, marginTop: 10, justifyContent: "space-between", alignItems: "center" }}>
        {nextReward ? (
          <div style={{ fontSize: 10, color: "#555", fontFamily: "monospace" }}>
            {nextReward.icon} {nextReward.pts - points} pts to {nextReward.label}
          </div>
        ) : (
          <div style={{ fontSize: 10, color: "#8e44ad", fontFamily: "monospace" }}>👑 MAX REACHED!</div>
        )}
        {claimed.length > 0 && (
          <div style={{ fontSize: 10, color: "#444", fontFamily: "monospace" }}>
            Claimed: {claimed.map(p => REWARDS.find(r => r.pts === p)?.icon).join("")}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Screens ──────────────────────────────────────────────

function WelcomeScreen({ onCreateGame, onJoinGame }) {
  return (
    <div style={{ paddingTop: 40 }}>
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ fontSize: 64, marginBottom: 12 }}>💪</div>
        <div style={{ fontSize: 14, color: "#666", fontFamily: "monospace", maxWidth: 280, margin: "0 auto", lineHeight: 1.6 }}>
          Collect gym points, earn real rewards. Play with friends & family.
        </div>
      </div>
      <div style={S.fieldGroup}>
        <button onClick={onCreateGame} style={S.btn("#e07b54")}>
          🏋️ CREATE A NEW GAME
        </button>
      </div>
      <div style={{ textAlign: "center", color: "#444", fontFamily: "monospace", fontSize: 12, margin: "8px 0" }}>or</div>
      <div style={S.fieldGroup}>
        <button onClick={onJoinGame} style={S.btn("#5b8dd9", true)}>
          🔗 JOIN WITH A CODE
        </button>
      </div>
      <div style={{ marginTop: 40, ...S.card }}>
        <div style={{ fontSize: 11, fontFamily: "monospace", color: "#555", marginBottom: 10, letterSpacing: 1 }}>HOW IT WORKS</div>
        {[
          ["🏋️", "Mon–Fri earns +5 pts each"],
          ["⭐", "Saturday bonus earns +10 pts"],
          ["🎁", "40 pts → $20 · 80 pts → $40 · 120 pts → $60"],
          ["🔗", "Share your game code with friends"],
          ["📱", "Works on iPhone & Android"],
        ].map(([icon, text]) => (
          <div key={text} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
            <span style={{ fontSize: 14 }}>{icon}</span>
            <span style={{ fontSize: 12, color: "#888", fontFamily: "monospace", lineHeight: 1.5 }}>{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CreateGameScreen({ onBack, onCreated }) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("💪");
  const [color, setColor] = useState(COLORS[0]);
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const gameCode = generateGameCode();
      const playerId = generatePlayerId();
      const gameRef = doc(db, "games", gameCode);
      const player = {
        id: playerId, name: name.trim(), emoji, color,
        points: 0, claimed: [], checkins: {}, weekKey: getWeekKey(),
        joinedAt: Date.now(),
      };
      await setDoc(gameRef, {
        code: gameCode,
        createdAt: serverTimestamp(),
        resetAt: Date.now(),
        players: { [playerId]: player },
      });
      // Save my identity to localStorage
      localStorage.setItem("gymPoints_player", JSON.stringify({ playerId, gameCode }));
      onCreated(gameCode, playerId);
    } catch (e) {
      console.error(e);
      alert("Error creating game. Check your Firebase config.");
    }
    setLoading(false);
  }

  return (
    <div style={{ paddingTop: 24 }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#666", fontFamily: "monospace", fontSize: 12, cursor: "pointer", marginBottom: 20 }}>
        ← BACK
      </button>
      <div style={{ fontSize: 18, fontFamily: "monospace", color: "#fff", marginBottom: 24, letterSpacing: 1 }}>
        CREATE GAME
      </div>
      <div style={S.card}>
        <div style={S.fieldGroup}>
          <label style={S.label}>YOUR NAME</label>
          <input
            style={S.input} value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. Sis, Coach, Dee..."
            maxLength={20}
          />
        </div>
        <div style={S.fieldGroup}>
          <label style={S.label}>PICK YOUR EMOJI</label>
          <EmojiPicker value={emoji} onChange={setEmoji} />
        </div>
        <div style={S.fieldGroup}>
          <label style={S.label}>PICK YOUR COLOR</label>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        <button onClick={handleCreate} disabled={!name.trim() || loading} style={{
          ...S.btn(color),
          opacity: !name.trim() || loading ? 0.5 : 1,
        }}>
          {loading ? "CREATING..." : "🏋️ LET'S GO!"}
        </button>
      </div>
    </div>
  );
}

function JoinGameScreen({ onBack, onJoined, prefillCode }) {
  const [code, setCode] = useState(prefillCode || "");
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("⭐");
  const [color, setColor] = useState(COLORS[1]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(prefillCode ? 2 : 1);
  const [gameExists, setGameExists] = useState(false);

  async function handleCheckCode() {
    if (code.trim().length < 4) return;
    setLoading(true);
    const gameRef = doc(db, "games", code.trim().toUpperCase());
    const snap = await getDoc(gameRef);
    setLoading(false);
    if (snap.exists()) {
      setGameExists(true);
      setStep(2);
    } else {
      alert("Game code not found. Check the code and try again.");
    }
  }

  async function handleJoin() {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const playerId = generatePlayerId();
      const gameRef = doc(db, "games", code.trim().toUpperCase());
      const player = {
        id: playerId, name: name.trim(), emoji, color,
        points: 0, claimed: [], checkins: {}, weekKey: getWeekKey(),
        joinedAt: Date.now(),
      };
      await updateDoc(gameRef, { [`players.${playerId}`]: player });
      localStorage.setItem("gymPoints_player", JSON.stringify({ playerId, gameCode: code.trim().toUpperCase() }));
      onJoined(code.trim().toUpperCase(), playerId);
    } catch (e) {
      console.error(e);
      alert("Error joining game.");
    }
    setLoading(false);
  }

  return (
    <div style={{ paddingTop: 24 }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#666", fontFamily: "monospace", fontSize: 12, cursor: "pointer", marginBottom: 20 }}>
        ← BACK
      </button>
      <div style={{ fontSize: 18, fontFamily: "monospace", color: "#fff", marginBottom: 24, letterSpacing: 1 }}>
        JOIN GAME
      </div>

      {step === 1 && (
        <div style={S.card}>
          <div style={S.fieldGroup}>
            <label style={S.label}>GAME CODE</label>
            <input
              style={{ ...S.input, textTransform: "uppercase", letterSpacing: 4, fontSize: 20, textAlign: "center" }}
              value={code} onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="XXXXXX" maxLength={6}
            />
          </div>
          <button onClick={handleCheckCode} disabled={code.trim().length < 4 || loading} style={{
            ...S.btn("#5b8dd9"), opacity: code.trim().length < 4 || loading ? 0.5 : 1,
          }}>
            {loading ? "CHECKING..." : "FIND GAME →"}
          </button>
        </div>
      )}

      {step === 2 && (
        <div style={S.card}>
          <div style={{ fontSize: 11, color: "#2ecc71", fontFamily: "monospace", marginBottom: 16, letterSpacing: 1 }}>
            ✓ GAME FOUND · CODE: {code.toUpperCase()}
          </div>
          <div style={S.fieldGroup}>
            <label style={S.label}>YOUR NAME</label>
            <input style={S.input} value={name} onChange={e => setName(e.target.value)} placeholder="Your name..." maxLength={20} />
          </div>
          <div style={S.fieldGroup}>
            <label style={S.label}>PICK YOUR EMOJI</label>
            <EmojiPicker value={emoji} onChange={setEmoji} />
          </div>
          <div style={S.fieldGroup}>
            <label style={S.label}>PICK YOUR COLOR</label>
            <ColorPicker value={color} onChange={setColor} />
          </div>
          <button onClick={handleJoin} disabled={!name.trim() || loading} style={{
            ...S.btn(color), opacity: !name.trim() || loading ? 0.5 : 1,
          }}>
            {loading ? "JOINING..." : "💪 JOIN THE GAME!"}
          </button>
        </div>
      )}
    </div>
  );
}

function GameScreen({ gameCode, playerId, onLeave }) {
  const [gameData, setGameData] = useState(null);
  const [toast, setToast] = useState(null);
  const [showShare, setShowShare] = useState(false);
  const [showReset, setShowReset] = useState(false);

  function showToastMsg(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  // Live listener
  useEffect(() => {
    const gameRef = doc(db, "games", gameCode);
    const unsub = onSnapshot(gameRef, snap => {
      if (snap.exists()) setGameData(snap.data());
    });
    return () => unsub();
  }, [gameCode]);

  const handleCheckin = useCallback(async (day, pts) => {
    const wk = getWeekKey();
    const key = `${wk}-${day}`;
    const gameRef = doc(db, "games", gameCode);
    const snap = await getDoc(gameRef);
    if (!snap.exists()) return;
    const players = snap.data().players;
    const me = players[playerId];
    if (!me) return;

    const currentCheckins = me.weekKey === wk ? (me.checkins || {}) : {};
    if (currentCheckins[key]) return;

    const newPoints = Math.min((me.points || 0) + pts, TIER_3);
    const newCheckins = { ...currentCheckins, [key]: true };

    await updateDoc(gameRef, {
      [`players.${playerId}.points`]: newPoints,
      [`players.${playerId}.checkins`]: newCheckins,
      [`players.${playerId}.weekKey`]: wk,
    });
    showToastMsg(`${day} logged! +${pts} pts 🔥`);
  }, [gameCode, playerId]);

  const handleClaim = useCallback(async (pts) => {
    const gameRef = doc(db, "games", gameCode);
    const snap = await getDoc(gameRef);
    if (!snap.exists()) return;
    const me = snap.data().players[playerId];
    if (!me || (me.claimed || []).includes(pts)) return;
    const newClaimed = [...(me.claimed || []), pts];
    await updateDoc(gameRef, { [`players.${playerId}.claimed`]: newClaimed });
    const reward = REWARDS.find(r => r.pts === pts);
    showToastMsg(`${reward.icon} ${reward.label} claimed! Go collect! 🎉`);
  }, [gameCode, playerId]);

  const handleReset = useCallback(async () => {
    const gameRef = doc(db, "games", gameCode);
    const snap = await getDoc(gameRef);
    if (!snap.exists()) return;
    const players = snap.data().players;
    const updates = {};
    Object.keys(players).forEach(pid => {
      updates[`players.${pid}.points`] = 0;
      updates[`players.${pid}.claimed`] = [];
      updates[`players.${pid}.checkins`] = {};
      updates[`players.${pid}.weekKey`] = getWeekKey();
    });
    updates["resetAt"] = Date.now();
    await updateDoc(gameRef, updates);
    setShowReset(false);
    showToastMsg("Game reset! New cycle started 🏁");
  }, [gameCode]);

  const shareUrl = `${window.location.origin}${window.location.pathname}?code=${gameCode}`;

  function handleShare() {
    if (navigator.share) {
      navigator.share({ title: "Join my Gym Points game!", text: `Use code ${gameCode} to join!`, url: shareUrl })
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl).then(() => showToastMsg("Link copied! 📋"));
      setShowShare(true);
    }
  }

  if (!gameData) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "50vh" }}>
        <div style={{ fontFamily: "monospace", color: "#555", fontSize: 13, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          Loading game...
        </div>
      </div>
    );
  }

  const players = Object.values(gameData.players || {}).sort((a, b) => (b.points || 0) - (a.points || 0));

  return (
    <div>
      <Toast msg={toast} />

      {/* Game header bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 16px", marginBottom: 8,
        background: "#111", borderBottom: "1px solid #1e1e1e",
      }}>
        <div>
          <div style={{ fontSize: 10, fontFamily: "monospace", color: "#555", letterSpacing: 1 }}>GAME CODE</div>
          <div style={{ fontFamily: "monospace", fontSize: 18, color: "#fff", letterSpacing: 4 }}>{gameCode}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleShare} style={{
            padding: "8px 14px", borderRadius: 10, background: "#1e1e1e",
            border: "1px solid #2a2a2a", color: "#aaa", fontFamily: "monospace",
            fontSize: 11, cursor: "pointer",
          }}>🔗 Invite</button>
          <button onClick={onLeave} style={{
            padding: "8px 14px", borderRadius: 10, background: "#1e1e1e",
            border: "1px solid #2a2a2a", color: "#666", fontFamily: "monospace",
            fontSize: 11, cursor: "pointer",
          }}>Exit</button>
        </div>
      </div>

      {/* Share panel */}
      {showShare && (
        <div style={{ ...S.card, marginBottom: 8, background: "#1a1a1a", border: "1px solid #2a2a2a" }}>
          <div style={{ fontSize: 11, color: "#666", fontFamily: "monospace", marginBottom: 8 }}>SHARE THIS LINK OR CODE</div>
          <div style={{
            background: "#111", borderRadius: 10, padding: "10px 14px",
            fontFamily: "monospace", fontSize: 12, color: "#aaa",
            wordBreak: "break-all", marginBottom: 10,
          }}>{shareUrl}</div>
          <div style={{ fontFamily: "monospace", fontSize: 12, color: "#555" }}>
            Or share the code: <span style={{ color: "#fff", letterSpacing: 3 }}>{gameCode}</span>
          </div>
          <button onClick={() => { navigator.clipboard.writeText(shareUrl); showToastMsg("Copied! 📋"); }} style={{
            ...S.btn("#5b8dd9"), marginTop: 12,
          }}>COPY LINK</button>
        </div>
      )}

      {/* Rewards legend */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {REWARDS.map(r => (
          <div key={r.pts} style={{
            flex: 1, textAlign: "center", background: "#161616",
            borderRadius: 12, border: `1px solid ${r.color}33`, padding: "8px 4px",
          }}>
            <div style={{ fontSize: 16 }}>{r.icon}</div>
            <div style={{ fontFamily: "monospace", fontSize: 9, color: r.color, marginTop: 2 }}>{r.pts} PTS</div>
            <div style={{ fontFamily: "monospace", fontSize: 9, color: "#555" }}>{r.label}</div>
          </div>
        ))}
      </div>

      {/* Player cards */}
      {players.map(player => (
        <PlayerCard
          key={player.id}
          player={player}
          isMe={player.id === playerId}
          onCheckin={handleCheckin}
          onClaim={handleClaim}
          gameId={gameCode}
        />
      ))}

      {/* Rules */}
      <div style={{ ...S.card, marginTop: 8 }}>
        <div style={{ fontFamily: "monospace", fontSize: 11, color: "#555", letterSpacing: 1, marginBottom: 10 }}>RULES</div>
        {[
          "Mon–Fri: +5 pts · Saturday bonus: +10 pts",
          "Must complete each section before starting the next",
          "Game resets at 120 pts or every 3 months",
          "Tap your days to log your gym visit",
          "Each player claims their own rewards",
        ].map((r, i) => (
          <div key={i} style={{ fontFamily: "monospace", fontSize: 11, color: "#555", marginBottom: 5 }}>
            · {r}
          </div>
        ))}
      </div>

      {/* Reset */}
      <div style={{ marginTop: 12 }}>
        {!showReset ? (
          <button onClick={() => setShowReset(true)} style={{
            width: "100%", padding: 12, borderRadius: 12,
            background: "transparent", border: "1px solid #1e1e1e",
            color: "#444", fontFamily: "monospace", fontSize: 11, cursor: "pointer",
          }}>Reset Game (All Players)</button>
        ) : (
          <div style={{ ...S.card, border: "1px solid #c0392b44", textAlign: "center" }}>
            <div style={{ color: "#aaa", fontFamily: "monospace", fontSize: 12, marginBottom: 12 }}>
              Reset ALL players' points and check-ins?
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowReset(false)} style={{ ...S.btn("#333", true), flex: 1, width: "auto" }}>Cancel</button>
              <button onClick={handleReset} style={{
                flex: 1, padding: 12, borderRadius: 12,
                background: "#c0392b22", border: "1px solid #c0392b66",
                color: "#c0392b", fontFamily: "monospace", fontSize: 12, cursor: "pointer",
              }}>Yes, Reset</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("loading");
  const [gameCode, setGameCode] = useState(null);
  const [playerId, setPlayerId] = useState(null);

  useEffect(() => {
    // Check URL for game code (from share link)
    const params = new URLSearchParams(window.location.search);
    const urlCode = params.get("code");

    // Check localStorage for saved session
    const saved = localStorage.getItem("gymPoints_player");
    if (saved) {
      try {
        const { playerId: pid, gameCode: gc } = JSON.parse(saved);
        // Verify the game still exists
        getDoc(doc(db, "games", gc)).then(snap => {
          if (snap.exists() && snap.data().players?.[pid]) {
            setGameCode(gc);
            setPlayerId(pid);
            setScreen("game");
          } else {
            localStorage.removeItem("gymPoints_player");
            setScreen(urlCode ? "join" : "welcome");
          }
        }).catch(() => setScreen(urlCode ? "join" : "welcome"));
        if (urlCode) setScreen("join");
        return;
      } catch { localStorage.removeItem("gymPoints_player"); }
    }

    setScreen(urlCode ? "join" : "welcome");
  }, []);

  function handleCreated(gc, pid) {
    setGameCode(gc);
    setPlayerId(pid);
    setScreen("game");
  }

  function handleJoined(gc, pid) {
    setGameCode(gc);
    setPlayerId(pid);
    setScreen("game");
  }

  function handleLeave() {
    localStorage.removeItem("gymPoints_player");
    setGameCode(null);
    setPlayerId(null);
    setScreen("welcome");
  }

  // Get URL code for join screen
  const urlCode = new URLSearchParams(window.location.search).get("code") || "";

  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap');
        * { -webkit-tap-highlight-color: transparent; }
        input::placeholder { color: #444; }
        button:active { opacity: 0.75; }
      `}</style>

      <div style={S.header}>
        <div style={S.title}>GYM POINTS 💪</div>
        <div style={S.subtitle}>EARN · COLLECT · WIN</div>
      </div>

      <div style={S.container}>
        {screen === "loading" && (
          <div style={{ textAlign: "center", paddingTop: 80, fontFamily: "monospace", color: "#555" }}>Loading...</div>
        )}
        {screen === "welcome" && (
          <WelcomeScreen
            onCreateGame={() => setScreen("create")}
            onJoinGame={() => setScreen("join")}
          />
        )}
        {screen === "create" && (
          <CreateGameScreen onBack={() => setScreen("welcome")} onCreated={handleCreated} />
        )}
        {screen === "join" && (
          <JoinGameScreen onBack={() => setScreen("welcome")} onJoined={handleJoined} prefillCode={urlCode} />
        )}
        {screen === "game" && gameCode && playerId && (
          <GameScreen gameCode={gameCode} playerId={playerId} onLeave={handleLeave} />
        )}
      </div>
    </div>
  );
}
