import { useState, useEffect, useCallback, useRef } from "react";
import {
  doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp
} from "firebase/firestore";
import { db } from "./firebase";

// ─── Constants ───────────────────────────────────────────
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const TIER_1 = 40, TIER_2 = 80, TIER_3 = 120;
const CYCLE_DAYS = 90;
const REWARDS = [
  { pts: 40,  label: "$20 Reward", icon: "🎁", color: "#f59e0b" },
  { pts: 80,  label: "$40 Reward", icon: "🏆", color: "#ef4444" },
  { pts: 120, label: "$60 Reward", icon: "👑", color: "#8b5cf6" },
];
const EMOJIS = ["💪","⭐","🔥","🏃","🦁","⚡","🎯","🥊","🚀","🌟"];
const COLORS = ["#f59e0b","#3b82f6","#10b981","#ef4444","#8b5cf6","#ec4899","#06b6d4","#f97316"];

// ─── Helpers ─────────────────────────────────────────────
function getWeekKey() {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0,0,0,0);
  return `${monday.getFullYear()}-${monday.getMonth()}-${monday.getDate()}`;
}

function generateGameCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function generatePlayerId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function getDaysLeft(resetAt) {
  if (!resetAt) return CYCLE_DAYS;
  const elapsed = Math.floor((Date.now() - resetAt) / (1000 * 60 * 60 * 24));
  return Math.max(0, CYCLE_DAYS - elapsed);
}

function shouldAutoReset(resetAt) {
  if (!resetAt) return false;
  return getDaysLeft(resetAt) === 0;
}

// ─── Celebration ──────────────────────────────────────────
function Celebration({ reward, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [onDone]);

  const particles = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 0.8,
    size: 6 + Math.random() * 10,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    duration: 1.5 + Math.random(),
  }));

  return (
    <div onClick={onDone} style={{
      position: "fixed", inset: 0, zIndex: 1000,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "rgba(0,0,0,0.88)", cursor: "pointer",
    }}>
      <style>{`
        @keyframes confettiFall {
          0% { transform: translateY(-20px) rotate(0deg); opacity:1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity:0; }
        }
        @keyframes popIn {
          0% { transform:scale(0.3); opacity:0; }
          60% { transform:scale(1.15); }
          100% { transform:scale(1); opacity:1; }
        }
        @keyframes floatPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }
      `}</style>
      {particles.map(p => (
        <div key={p.id} style={{
          position: "fixed", left: `${p.x}%`, top: -20,
          width: p.size, height: p.size,
          borderRadius: Math.random() > 0.5 ? "50%" : "3px",
          background: p.color,
          animation: `confettiFall ${p.duration}s ${p.delay}s ease-in forwards`,
          pointerEvents: "none",
        }} />
      ))}
      <div style={{ textAlign: "center", animation: "popIn 0.5s cubic-bezier(.4,2,.6,1) forwards" }}>
        <div style={{ fontSize: 88, animation: "floatPulse 1s ease infinite" }}>{reward.icon}</div>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif", fontSize: 44,
          color: reward.color, letterSpacing: 3, lineHeight: 1,
          textShadow: `0 0 40px ${reward.color}`,
        }}>{reward.label}</div>
        <div style={{ fontFamily: "monospace", fontSize: 13, color: "#888", marginTop: 12, letterSpacing: 2 }}>
          UNLOCKED! TAP TO CLAIM 🎉
        </div>
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────
const S = {
  app: {
    minHeight: "100vh",
    background: "#0a0a0a",
    color: "#fff",
    fontFamily: "'DM Sans', system-ui, sans-serif",
    paddingBottom: 80,
  },
  header: {
    background: "linear-gradient(180deg,#141414 0%,#0a0a0a 100%)",
    borderBottom: "1px solid #1c1c1c",
    padding: "env(safe-area-inset-top,20px) 20px 16px",
    textAlign: "center",
    position: "sticky", top: 0, zIndex: 50,
  },
  title: {
    fontFamily: "'Bebas Neue', sans-serif",
    fontSize: 34, letterSpacing: 5,
    background: "linear-gradient(135deg,#f59e0b 0%,#ef4444 50%,#8b5cf6 100%)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
    lineHeight: 1,
  },
  container: { maxWidth: 480, margin: "0 auto", padding: "0 14px" },
  card: {
    background: "#141414", border: "1px solid #1e1e1e",
    borderRadius: 18, padding: 18, marginBottom: 14,
  },
  btn: (color="#f59e0b", outline=false) => ({
    padding: "13px 20px", borderRadius: 12,
    border: outline ? `1.5px solid ${color}` : "none",
    background: outline ? "transparent" : color,
    color: outline ? color : "#000",
    fontFamily: "monospace", fontSize: 12,
    fontWeight: "bold", cursor: "pointer", width: "100%",
    letterSpacing: 1, WebkitTapHighlightColor: "transparent",
  }),
  input: {
    width: "100%", padding: "13px 16px", borderRadius: 12,
    border: "1.5px solid #2a2a2a", background: "#0f0f0f",
    color: "#fff", fontSize: 15, fontFamily: "monospace",
    outline: "none", letterSpacing: 1, boxSizing: "border-box",
  },
  label: {
    fontSize: 10, color: "#555", fontFamily: "monospace",
    letterSpacing: 2, display: "block", marginBottom: 8, textTransform: "uppercase",
  },
  fieldGroup: { marginBottom: 16 },
};

// ─── Small Components ─────────────────────────────────────
function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div style={{
      position: "fixed", top: 80, left: "50%", transform: "translateX(-50%)",
      background: "#1c1c1c", border: "1px solid #333", borderRadius: 12,
      padding: "10px 24px", fontFamily: "monospace", fontSize: 12,
      color: "#fff", zIndex: 200, boxShadow: "0 8px 40px #000a",
      whiteSpace: "nowrap", maxWidth: "90vw",
    }}>{msg}</div>
  );
}

function EmojiPicker({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {EMOJIS.map(e => (
        <button key={e} onClick={() => onChange(e)} style={{
          fontSize: 24, padding: 6, borderRadius: 10,
          background: value === e ? "#222" : "transparent",
          border: `1.5px solid ${value === e ? "#555" : "transparent"}`,
          cursor: "pointer",
        }}>{e}</button>
      ))}
    </div>
  );
}

function ColorPicker({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {COLORS.map(c => (
        <button key={c} onClick={() => onChange(c)} style={{
          width: 30, height: 30, borderRadius: "50%", background: c,
          border: `3px solid ${value === c ? "#fff" : "transparent"}`,
          cursor: "pointer", outline: "none",
        }} />
      ))}
    </div>
  );
}

function ProgressRing({ points, color }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(points / TIER_3, 1);
  const offset = circ * (1 - pct);
  return (
    <svg width="126" height="126" style={{ transform: "rotate(-90deg)" }}>
      <circle cx="63" cy="63" r={r} fill="none" stroke="#1e1e1e" strokeWidth="9" />
      <circle cx="63" cy="63" r={r} fill="none"
        stroke={color} strokeWidth="9"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{
          transition: "stroke-dashoffset 0.6s cubic-bezier(.4,2,.6,1)",
          filter: `drop-shadow(0 0 6px ${color}88)`,
        }}
      />
    </svg>
  );
}

function StatBadge({ label, value, color }) {
  return (
    <div style={{
      flex: 1, textAlign: "center", background: "#0f0f0f",
      borderRadius: 12, padding: "10px 4px", border: "1px solid #1e1e1e",
    }}>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, color: color || "#fff", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 8, fontFamily: "monospace", color: "#444", marginTop: 3, letterSpacing: 1 }}>{label}</div>
    </div>
  );
}

// ─── Leaderboard ──────────────────────────────────────────
function LeaderboardView({ players, myId }) {
  const sorted = [...players].sort((a, b) => (b.points||0) - (a.points||0));
  const medals = ["🥇","🥈","🥉"];
  return (
    <div style={S.card}>
      <div style={S.label}>STANDINGS</div>
      {sorted.map((p, i) => (
        <div key={p.id} style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "11px 0",
          borderBottom: i < sorted.length-1 ? "1px solid #1a1a1a" : "none",
        }}>
          <div style={{ fontSize: 20, width: 28, textAlign: "center" }}>{medals[i] || `${i+1}`}</div>
          <div style={{ fontSize: 22 }}>{p.emoji}</div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 18,
              color: p.id === myId ? p.color : "#fff", letterSpacing: 1,
            }}>{p.name}{p.id === myId ? " (you)" : ""}</div>
            <div style={{ height: 4, borderRadius: 2, background: "#1e1e1e", marginTop: 5 }}>
              <div style={{
                height: "100%", borderRadius: 2, background: p.color,
                width: `${Math.min(((p.points||0)/TIER_3)*100,100)}%`,
                transition: "width 0.5s ease",
              }} />
            </div>
          </div>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 28,
            color: p.color, textShadow: `0 0 12px ${p.color}55`,
          }}>{p.points||0}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Weekly History ───────────────────────────────────────
function WeeklyHistory({ history }) {
  if (!history || history.length === 0) return null;
  return (
    <div style={S.card}>
      <div style={S.label}>WEEKLY HISTORY</div>
      {history.slice(-8).reverse().map((wk, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 0",
          borderBottom: i < Math.min(history.length,8)-1 ? "1px solid #1a1a1a" : "none",
        }}>
          <div style={{ fontFamily: "monospace", fontSize: 11, color: "#555" }}>Week {history.length - i}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 90, height: 5, borderRadius: 3, background: "#1e1e1e" }}>
              <div style={{
                height: "100%", borderRadius: 3,
                width: `${Math.min((wk.pts/35)*100,100)}%`,
                background: wk.pts >= 35 ? "#10b981" : wk.pts >= 20 ? "#f59e0b" : "#555",
              }} />
            </div>
            <div style={{
              fontFamily: "monospace", fontSize: 12, width: 36, textAlign: "right",
              color: wk.pts >= 35 ? "#10b981" : wk.pts >= 20 ? "#f59e0b" : "#888",
            }}>+{wk.pts}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Cycle Timer ──────────────────────────────────────────
function CycleTimer({ resetAt }) {
  const daysLeft = getDaysLeft(resetAt);
  const pct = ((CYCLE_DAYS - daysLeft) / CYCLE_DAYS) * 100;
  const color = daysLeft > 30 ? "#10b981" : daysLeft > 14 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ ...S.card, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={S.label}>90-DAY CYCLE</div>
        <div style={{ fontFamily: "monospace", fontSize: 11, color }}>{daysLeft} days left</div>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "#1e1e1e", overflow: "hidden" }}>
        <div style={{
          height: "100%", borderRadius: 3, width: `${pct}%`,
          background: color, transition: "width 0.5s ease",
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <div style={{ fontFamily: "monospace", fontSize: 9, color: "#333" }}>START</div>
        <div style={{ fontFamily: "monospace", fontSize: 9, color: "#333" }}>DAY 90 → AUTO RESET</div>
      </div>
    </div>
  );
}

// ─── Player Card ──────────────────────────────────────────
function PlayerCard({ player, isMe, onCheckin, onClaim }) {
  const wk = getWeekKey();
  const checkins = player.weekKey === wk ? (player.checkins || {}) : {};
  const points = player.points || 0;
  const claimed = player.claimed || [];
  const streak = player.streak || 0;
  const stats = player.stats || {};
  const claimable = REWARDS.find(r => r.pts <= points && !claimed.includes(r.pts));
  const nextReward = REWARDS.find(r => r.pts > points && !claimed.includes(r.pts));
  const thisWeekPts = Object.keys(checkins).reduce((sum, k) => sum + (k.endsWith("-Sat") ? 10 : 5), 0);

  return (
    <div style={{
      ...S.card,
      border: isMe ? `1px solid ${player.color}44` : "1px solid #1e1e1e",
      position: "relative", overflow: "hidden",
    }}>
      {isMe && (
        <div style={{
          position: "absolute", top: 0, right: 0,
          background: player.color, fontSize: 9,
          fontFamily: "monospace", padding: "3px 10px",
          borderBottomLeftRadius: 8, color: "#000", letterSpacing: 1,
        }}>YOU</div>
      )}
      <div style={{
        position: "absolute", top: -60, right: -60, width: 160, height: 160,
        borderRadius: "50%", background: `${player.color}0d`, filter: "blur(50px)",
        pointerEvents: "none",
      }} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
        <div style={{ position: "relative", flexShrink: 0 }}>
          <ProgressRing points={points} color={player.color} />
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
          }}>
            <div style={{ fontSize: 20 }}>{player.emoji}</div>
            <div style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 26,
              color: player.color, lineHeight: 1,
              textShadow: `0 0 16px ${player.color}66`,
            }}>{points}</div>
            <div style={{ fontSize: 7, fontFamily: "monospace", color: "#444" }}>/ 120 PTS</div>
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 22,
            color: player.color, letterSpacing: 1.5, lineHeight: 1,
          }}>{player.name}</div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <StatBadge label="STREAK" value={`${streak}w`} color={streak >= 4 ? "#10b981" : "#888"} />
            <StatBadge label="THIS WEEK" value={`+${thisWeekPts}`} color={player.color} />
            <StatBadge label="GYM DAYS" value={stats.totalDays || 0} color="#888" />
          </div>
        </div>
      </div>

      {/* Tier bars */}
      <div style={{ display: "flex", gap: 5, marginBottom: 14 }}>
        {REWARDS.map((r, i) => {
          const filled = Math.min(Math.max(points - i*40, 0), 40);
          const isDone = points >= r.pts;
          const isActive = !isDone && Math.floor(points/40) === i;
          return (
            <div key={r.pts} style={{ flex: 1 }}>
              <div style={{
                fontSize: 8, fontFamily: "monospace",
                color: isDone ? r.color : "#2a2a2a",
                textAlign: "center", marginBottom: 3, letterSpacing: 1,
              }}>{r.label}</div>
              <div style={{
                height: 5, borderRadius: 3, background: "#1a1a1a",
                border: `1px solid ${isActive ? r.color+"44" : "#1e1e1e"}`,
                overflow: "hidden",
              }}>
                <div style={{
                  height: "100%", width: `${(filled/40)*100}%`,
                  background: r.color, borderRadius: 3,
                  transition: "width 0.4s ease",
                  boxShadow: isDone ? `0 0 6px ${r.color}` : "none",
                }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Claimable */}
      {claimable && isMe && (
        <button onClick={() => onClaim(claimable.pts)} style={{
          width: "100%", padding: "10px 16px", borderRadius: 12, marginBottom: 12,
          background: `linear-gradient(135deg,${claimable.color}22,${claimable.color}0d)`,
          border: `1px solid ${claimable.color}66`,
          color: "#fff", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          animation: "glowPulse 2s ease infinite",
        }}>
          <span style={{ fontSize: 12, fontFamily: "monospace" }}>
            {claimable.icon} {claimable.label} UNLOCKED!
          </span>
          <span style={{
            fontSize: 10, background: claimable.color, color: "#000",
            borderRadius: 6, padding: "2px 10px", fontFamily: "monospace",
          }}>CLAIM →</span>
        </button>
      )}

      {/* Day buttons */}
      {isMe && (
        <div style={{ display: "flex", gap: 4 }}>
          {DAYS.map(day => {
            const key = `${wk}-${day}`;
            const checked = !!checkins[key];
            return (
              <button key={day} onClick={() => !checked && onCheckin(day, 5)} style={{
                flex: 1, padding: "9px 2px", borderRadius: 10,
                cursor: checked ? "default" : "pointer",
                border: `1.5px solid ${checked ? player.color : "#222"}`,
                background: checked ? `${player.color}1a` : "#0f0f0f",
                color: checked ? player.color : "#444",
                fontFamily: "monospace", fontSize: 10,
                WebkitTapHighlightColor: "transparent",
                transition: "all 0.2s",
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
                flex: 1, padding: "9px 2px", borderRadius: 10,
                cursor: checked ? "default" : "pointer",
                border: `1.5px solid ${checked ? "#f59e0b" : "#222"}`,
                background: checked ? "#f59e0b1a" : "#0f0f0f",
                color: checked ? "#f59e0b" : "#444",
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

      {/* Read-only for others */}
      {!isMe && (
        <div style={{ display: "flex", gap: 4 }}>
          {[...DAYS, "Sat"].map(day => {
            const key = `${wk}-${day}`;
            const checked = !!checkins[key];
            return (
              <div key={day} style={{
                flex: 1, padding: "7px 2px", borderRadius: 10, textAlign: "center",
                background: checked ? `${player.color}1a` : "#0f0f0f",
                border: `1px solid ${checked ? player.color+"44" : "#1a1a1a"}`,
                fontSize: 9, fontFamily: "monospace",
                color: checked ? player.color : "#2a2a2a",
              }}>
                <div>{day}</div>
                <div style={{ marginTop: 2 }}>{checked ? "✓" : "·"}</div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
        {nextReward ? (
          <div style={{ fontSize: 10, color: "#444", fontFamily: "monospace" }}>
            {nextReward.icon} {nextReward.pts - points} pts to {nextReward.label}
          </div>
        ) : (
          <div style={{ fontSize: 10, color: "#8b5cf6", fontFamily: "monospace" }}>👑 MAX REACHED!</div>
        )}
        {claimed.length > 0 && (
          <div style={{ fontSize: 12 }}>{claimed.map(p => REWARDS.find(r=>r.pts===p)?.icon).join(" ")}</div>
        )}
      </div>
    </div>
  );
}

// ─── Welcome ──────────────────────────────────────────────
function WelcomeScreen({ onCreate, onJoin }) {
  return (
    <div style={{ paddingTop: 32 }}>
      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ fontSize: 72, marginBottom: 16 }}>💪</div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 3, color: "#fff", marginBottom: 8 }}>
          EARN POINTS. WIN REWARDS.
        </div>
        <div style={{ fontSize: 13, color: "#555", fontFamily: "monospace", lineHeight: 1.8 }}>
          Track gym visits with friends & family.<br />Collect real cash rewards.
        </div>
      </div>
      <div style={S.fieldGroup}>
        <button onClick={onCreate} style={S.btn("#f59e0b")}>🏋️ CREATE A NEW GAME</button>
      </div>
      <div style={{ textAlign: "center", color: "#333", fontFamily: "monospace", fontSize: 11, margin: "8px 0" }}>— or —</div>
      <div style={S.fieldGroup}>
        <button onClick={onJoin} style={S.btn("#3b82f6", true)}>🔗 JOIN WITH A CODE</button>
      </div>
      <div style={{ ...S.card, marginTop: 32 }}>
        <div style={S.label}>HOW IT WORKS</div>
        {[
          ["🏋️","Mon–Fri earns +5 pts each · Saturday +10 bonus"],
          ["📈","Points carry forward every week until reset"],
          ["🎁","40 pts=$20 · 80 pts=$40 · 120 pts=$60"],
          ["🔄","Cycle auto-resets after 90 days"],
          ["📱","Installs on iPhone & Android like a real app"],
        ].map(([icon, text]) => (
          <div key={text} style={{ display: "flex", gap: 12, marginBottom: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 16 }}>{icon}</span>
            <span style={{ fontSize: 12, color: "#555", fontFamily: "monospace", lineHeight: 1.6 }}>{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Create ───────────────────────────────────────────────
function CreateScreen({ onBack, onCreated }) {
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
      const player = {
        id: playerId, name: name.trim(), emoji, color,
        points: 0, claimed: [], checkins: {},
        weekKey: getWeekKey(), streak: 0, joinedAt: Date.now(),
        weeklyPts: 0,
        stats: { totalDays: 0, bestWeek: 0, weeklyHistory: [] },
      };
      await setDoc(doc(db, "games", gameCode), {
        code: gameCode, createdAt: serverTimestamp(),
        resetAt: Date.now(), creatorId: playerId,
        players: { [playerId]: player },
      });
      localStorage.setItem("gymPoints_player", JSON.stringify({ playerId, gameCode }));
      onCreated(gameCode, playerId);
    } catch(e) {
      console.error(e);
      alert("Error creating game. Check your Firebase config in src/firebase.js.");
    }
    setLoading(false);
  }

  return (
    <div style={{ paddingTop: 24 }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#555", fontFamily: "monospace", fontSize: 12, cursor: "pointer", marginBottom: 20 }}>← BACK</button>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 3, marginBottom: 24 }}>CREATE GAME</div>
      <div style={S.card}>
        <div style={S.fieldGroup}>
          <label style={S.label}>YOUR NAME</label>
          <input style={S.input} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sis, Coach..." maxLength={20} />
        </div>
        <div style={S.fieldGroup}>
          <label style={S.label}>PICK YOUR EMOJI</label>
          <EmojiPicker value={emoji} onChange={setEmoji} />
        </div>
        <div style={S.fieldGroup}>
          <label style={S.label}>PICK YOUR COLOR</label>
          <ColorPicker value={color} onChange={setColor} />
        </div>
        <button onClick={handleCreate} disabled={!name.trim()||loading} style={{ ...S.btn(color), opacity: !name.trim()||loading ? 0.4 : 1, color: "#000" }}>
          {loading ? "CREATING..." : "🏋️ LET'S GO!"}
        </button>
      </div>
    </div>
  );
}

// ─── Join ─────────────────────────────────────────────────
function JoinScreen({ onBack, onJoined, prefillCode }) {
  const [code, setCode] = useState(prefillCode || "");
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("⭐");
  const [color, setColor] = useState(COLORS[1]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(prefillCode ? 2 : 1);

  async function handleCheckCode() {
    setLoading(true);
    const snap = await getDoc(doc(db, "games", code.trim().toUpperCase()));
    setLoading(false);
    if (snap.exists()) setStep(2);
    else alert("Game not found. Check the code and try again.");
  }

  async function handleJoin() {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const playerId = generatePlayerId();
      const gc = code.trim().toUpperCase();
      const player = {
        id: playerId, name: name.trim(), emoji, color,
        points: 0, claimed: [], checkins: {},
        weekKey: getWeekKey(), streak: 0, joinedAt: Date.now(),
        weeklyPts: 0,
        stats: { totalDays: 0, bestWeek: 0, weeklyHistory: [] },
      };
      await updateDoc(doc(db, "games", gc), { [`players.${playerId}`]: player });
      localStorage.setItem("gymPoints_player", JSON.stringify({ playerId, gameCode: gc }));
      onJoined(gc, playerId);
    } catch(e) { alert("Error joining game."); }
    setLoading(false);
  }

  return (
    <div style={{ paddingTop: 24 }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#555", fontFamily: "monospace", fontSize: 12, cursor: "pointer", marginBottom: 20 }}>← BACK</button>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 3, marginBottom: 24 }}>JOIN GAME</div>
      {step === 1 && (
        <div style={S.card}>
          <div style={S.fieldGroup}>
            <label style={S.label}>GAME CODE</label>
            <input style={{ ...S.input, textTransform: "uppercase", letterSpacing: 6, fontSize: 22, textAlign: "center" }}
              value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="XXXXXX" maxLength={6} />
          </div>
          <button onClick={handleCheckCode} disabled={code.length<4||loading} style={{ ...S.btn("#3b82f6"), opacity: code.length<4||loading ? 0.4 : 1, color: "#fff" }}>
            {loading ? "CHECKING..." : "FIND GAME →"}
          </button>
        </div>
      )}
      {step === 2 && (
        <div style={S.card}>
          <div style={{ fontSize: 11, color: "#10b981", fontFamily: "monospace", marginBottom: 16, letterSpacing: 1 }}>✓ GAME FOUND · {code.toUpperCase()}</div>
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
          <button onClick={handleJoin} disabled={!name.trim()||loading} style={{ ...S.btn(color), opacity: !name.trim()||loading ? 0.4 : 1, color: "#000" }}>
            {loading ? "JOINING..." : "💪 JOIN THE GAME!"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Game Screen ──────────────────────────────────────────
function GameScreen({ gameCode, playerId, onLeave }) {
  const [gameData, setGameData] = useState(null);
  const [toast, setToast] = useState(null);
  const [celebration, setCelebration] = useState(null);
  const [showShare, setShowShare] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [activeTab, setActiveTab] = useState("players");
  const prevPointsRef = useRef({});

  function showToastMsg(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  useEffect(() => {
    const gameRef = doc(db, "games", gameCode);
    const unsub = onSnapshot(gameRef, async snap => {
      if (!snap.exists()) return;
      const data = snap.data();

      // Auto-reset after 90 days
      if (shouldAutoReset(data.resetAt)) {
        const players = data.players || {};
        const updates = { resetAt: Date.now() };
        Object.keys(players).forEach(pid => {
          updates[`players.${pid}.points`] = 0;
          updates[`players.${pid}.claimed`] = [];
          updates[`players.${pid}.checkins`] = {};
          updates[`players.${pid}.weekKey`] = getWeekKey();
          updates[`players.${pid}.weeklyPts`] = 0;
          updates[`players.${pid}.streak`] = 0;
        });
        await updateDoc(gameRef, updates);
        return;
      }

      // Celebration check
      const players = data.players || {};
      Object.values(players).forEach(p => {
        if (p.id !== playerId) return;
        const prev = prevPointsRef.current[p.id] || 0;
        const curr = p.points || 0;
        if (prev !== curr) {
          const newReward = REWARDS.find(r => r.pts <= curr && r.pts > prev && !(p.claimed||[]).includes(r.pts));
          if (newReward) setCelebration(newReward);
          prevPointsRef.current[p.id] = curr;
        }
      });

      setGameData(data);
    });
    return () => unsub();
  }, [gameCode, playerId]);

  const handleCheckin = useCallback(async (day, pts) => {
    const wk = getWeekKey();
    const key = `${wk}-${day}`;
    const gameRef = doc(db, "games", gameCode);
    const snap = await getDoc(gameRef);
    if (!snap.exists()) return;
    const me = snap.data().players[playerId];
    if (!me) return;

    const currentCheckins = me.weekKey === wk ? (me.checkins||{}) : {};
    if (currentCheckins[key]) return;

    const newPoints = Math.min((me.points||0) + pts, TIER_3);
    const newCheckins = { ...currentCheckins, [key]: true };
    const isNewWeek = me.weekKey !== wk;

    // Weekly history: save last week before starting new one
    let weeklyHistory = me.stats?.weeklyHistory || [];
    if (isNewWeek && (me.weeklyPts||0) > 0) {
      weeklyHistory = [...weeklyHistory, { label: me.weekKey, pts: me.weeklyPts }].slice(-12);
    }

    const weeklyPts = (isNewWeek ? 0 : (me.weeklyPts||0)) + pts;
    const bestWeek = Math.max(me.stats?.bestWeek||0, weeklyPts);
    const totalDays = (me.stats?.totalDays||0) + 1;

    // Streak calculation
    let streak = me.streak || 0;
    if (isNewWeek) {
      streak = Object.keys(me.checkins||{}).length > 0 ? streak + 1 : 1;
    }

    await updateDoc(gameRef, {
      [`players.${playerId}.points`]: newPoints,
      [`players.${playerId}.checkins`]: newCheckins,
      [`players.${playerId}.weekKey`]: wk,
      [`players.${playerId}.weeklyPts`]: weeklyPts,
      [`players.${playerId}.streak`]: streak,
      [`players.${playerId}.stats.totalDays`]: totalDays,
      [`players.${playerId}.stats.bestWeek`]: bestWeek,
      [`players.${playerId}.stats.weeklyHistory`]: weeklyHistory,
    });
    showToastMsg(`${day} logged! +${pts} pts 🔥`);
  }, [gameCode, playerId]);

  const handleClaim = useCallback(async (pts) => {
    const gameRef = doc(db, "games", gameCode);
    const snap = await getDoc(gameRef);
    if (!snap.exists()) return;
    const me = snap.data().players[playerId];
    if (!me || (me.claimed||[]).includes(pts)) return;
    await updateDoc(gameRef, { [`players.${playerId}.claimed`]: [...(me.claimed||[]), pts] });
    const reward = REWARDS.find(r => r.pts === pts);
    showToastMsg(`${reward.icon} ${reward.label} claimed! Go collect! 🎉`);
  }, [gameCode, playerId]);

  const handleReset = useCallback(async () => {
    const gameRef = doc(db, "games", gameCode);
    const snap = await getDoc(gameRef);
    if (!snap.exists()) return;
    const players = snap.data().players;
    const updates = { resetAt: Date.now() };
    Object.keys(players).forEach(pid => {
      updates[`players.${pid}.points`] = 0;
      updates[`players.${pid}.claimed`] = [];
      updates[`players.${pid}.checkins`] = {};
      updates[`players.${pid}.weekKey`] = getWeekKey();
      updates[`players.${pid}.weeklyPts`] = 0;
      updates[`players.${pid}.streak`] = 0;
    });
    await updateDoc(gameRef, updates);
    setShowReset(false);
    showToastMsg("New cycle started! 🏁");
  }, [gameCode]);

  const shareUrl = `${window.location.origin}${window.location.pathname}?code=${gameCode}`;

  function handleShare() {
    if (navigator.share) {
      navigator.share({ title: "Join my Gym Points game!", text: `Use code ${gameCode}`, url: shareUrl }).catch(()=>{});
    } else {
      navigator.clipboard.writeText(shareUrl).then(() => showToastMsg("Link copied! 📋"));
      setShowShare(s => !s);
    }
  }

  if (!gameData) {
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"60vh" }}>
        <div style={{ fontFamily:"monospace", color:"#444", textAlign:"center" }}>
          <div style={{ fontSize:36, marginBottom:12 }}>⏳</div>Loading game...
        </div>
      </div>
    );
  }

  const players = Object.values(gameData.players||{}).sort((a,b)=>(b.points||0)-(a.points||0));
  const me = gameData.players?.[playerId];

  return (
    <div>
      <style>{`
        @keyframes glowPulse { 0%,100%{opacity:1} 50%{opacity:0.65} }
        @keyframes slideUp { from{transform:translateY(16px);opacity:0} to{transform:translateY(0);opacity:1} }
      `}</style>

      <Toast msg={toast} />
      {celebration && <Celebration reward={celebration} onDone={() => setCelebration(null)} />}

      {/* Top bar */}
      <div style={{
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"12px 16px", background:"#111", borderBottom:"1px solid #1a1a1a",
      }}>
        <div>
          <div style={{ fontSize:9, fontFamily:"monospace", color:"#444", letterSpacing:2 }}>GAME CODE</div>
          <div style={{ fontFamily:"monospace", fontSize:20, color:"#fff", letterSpacing:5 }}>{gameCode}</div>
        </div>
        <div style={{ display:"flex", gap:6 }}>
          <button onClick={handleShare} style={{
            padding:"7px 12px", borderRadius:10, background:"#1a1a1a",
            border:"1px solid #2a2a2a", color:"#aaa", fontFamily:"monospace",
            fontSize:11, cursor:"pointer",
          }}>🔗 Invite</button>
          <button onClick={onLeave} style={{
            padding:"7px 12px", borderRadius:10, background:"#1a1a1a",
            border:"1px solid #2a2a2a", color:"#555", fontFamily:"monospace",
            fontSize:11, cursor:"pointer",
          }}>Exit</button>
        </div>
      </div>

      {showShare && (
        <div style={{ background:"#111", borderBottom:"1px solid #1a1a1a", padding:"12px 16px" }}>
          <div style={{ fontFamily:"monospace", fontSize:11, color:"#444", marginBottom:6 }}>SHARE LINK OR CODE:</div>
          <div style={{ fontFamily:"monospace", fontSize:11, color:"#777", wordBreak:"break-all", marginBottom:8 }}>{shareUrl}</div>
          <button onClick={() => { navigator.clipboard.writeText(shareUrl); showToastMsg("Copied! 📋"); }} style={{ ...S.btn("#3b82f6"), color:"#fff" }}>
            COPY LINK
          </button>
        </div>
      )}

      <div style={S.container}>
        <div style={{ marginTop:14 }}><CycleTimer resetAt={gameData.resetAt} /></div>

        {/* Rewards legend */}
        <div style={{ display:"flex", gap:6, marginBottom:14 }}>
          {REWARDS.map(r => (
            <div key={r.pts} style={{
              flex:1, textAlign:"center", background:"#141414",
              borderRadius:12, border:`1px solid ${r.color}22`, padding:"8px 4px",
            }}>
              <div style={{ fontSize:18 }}>{r.icon}</div>
              <div style={{ fontFamily:"monospace", fontSize:9, color:r.color, marginTop:2 }}>{r.pts} PTS</div>
              <div style={{ fontFamily:"monospace", fontSize:9, color:"#444" }}>{r.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", gap:4, marginBottom:14, background:"#111", borderRadius:12, padding:4 }}>
          {[{id:"players",label:"Players"},{id:"leaderboard",label:"Standings"},{id:"history",label:"My History"}].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              flex:1, padding:"8px 4px", borderRadius:10,
              background: activeTab===tab.id ? "#222" : "transparent",
              border:"none", color: activeTab===tab.id ? "#fff" : "#555",
              fontFamily:"monospace", fontSize:11, cursor:"pointer",
              transition:"all 0.2s",
            }}>{tab.label}</button>
          ))}
        </div>

        {activeTab === "players" && players.map(player => (
          <div key={player.id} style={{ animation:"slideUp 0.3s ease" }}>
            <PlayerCard player={player} isMe={player.id===playerId} onCheckin={handleCheckin} onClaim={handleClaim} />
          </div>
        ))}

        {activeTab === "leaderboard" && (
          <div style={{ animation:"slideUp 0.3s ease" }}>
            <LeaderboardView players={players} myId={playerId} />
          </div>
        )}

        {activeTab === "history" && me && (
          <div style={{ animation:"slideUp 0.3s ease" }}>
            <div style={{ ...S.card, marginBottom:14 }}>
              <div style={S.label}>MY STATS</div>
              <div style={{ display:"flex", gap:8 }}>
                <StatBadge label="TOTAL DAYS" value={me.stats?.totalDays||0} color={me.color} />
                <StatBadge label="BEST WEEK" value={`+${me.stats?.bestWeek||0}`} color="#10b981" />
                <StatBadge label="STREAK" value={`${me.streak||0}w`} color={me.streak>=4?"#f59e0b":"#888"} />
              </div>
            </div>
            <WeeklyHistory history={me.stats?.weeklyHistory} />
            {(!me.stats?.weeklyHistory || me.stats.weeklyHistory.length===0) && (
              <div style={{ ...S.card, textAlign:"center" }}>
                <div style={{ fontSize:32, marginBottom:8 }}>📊</div>
                <div style={{ fontFamily:"monospace", fontSize:12, color:"#555" }}>
                  Weekly history appears here<br />after your first full week!
                </div>
              </div>
            )}
          </div>
        )}

        {/* Rules */}
        <div style={{ ...S.card, marginTop:8 }}>
          <div style={S.label}>RULES</div>
          {[
            "Mon–Fri: +5 pts each · Saturday bonus: +10 pts",
            "Points carry forward every week — they never reset weekly",
            "Must complete each 40pt section before starting the next",
            "Cycle auto-resets after 90 days for everyone",
            "Tap your days to log your gym visit for that day",
          ].map((r,i) => (
            <div key={i} style={{ fontFamily:"monospace", fontSize:11, color:"#555", marginBottom:5 }}>· {r}</div>
          ))}
        </div>

        {/* Reset */}
        <div style={{ marginTop:12 }}>
          {!showReset ? (
            <button onClick={() => setShowReset(true)} style={{
              width:"100%", padding:12, borderRadius:12,
              background:"transparent", border:"1px solid #1a1a1a",
              color:"#333", fontFamily:"monospace", fontSize:11, cursor:"pointer",
            }}>Manual Reset (All Players)</button>
          ) : (
            <div style={{ ...S.card, border:"1px solid #ef444433", textAlign:"center" }}>
              <div style={{ color:"#aaa", fontFamily:"monospace", fontSize:12, marginBottom:12 }}>
                Reset ALL players' points and start a new cycle?
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={()=>setShowReset(false)} style={{ ...S.btn("#333",true), flex:1, width:"auto", color:"#aaa" }}>Cancel</button>
                <button onClick={handleReset} style={{
                  flex:1, padding:12, borderRadius:12, background:"#ef444420",
                  border:"1px solid #ef444455", color:"#ef4444",
                  fontFamily:"monospace", fontSize:12, cursor:"pointer",
                }}>Yes, Reset</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("loading");
  const [gameCode, setGameCode] = useState(null);
  const [playerId, setPlayerId] = useState(null);

  useEffect(() => {
    const urlCode = new URLSearchParams(window.location.search).get("code");
    const saved = localStorage.getItem("gymPoints_player");
    if (saved) {
      try {
        const { playerId: pid, gameCode: gc } = JSON.parse(saved);
        getDoc(doc(db, "games", gc)).then(snap => {
          if (snap.exists() && snap.data().players?.[pid]) {
            setGameCode(gc); setPlayerId(pid); setScreen("game");
          } else {
            localStorage.removeItem("gymPoints_player");
            setScreen(urlCode ? "join" : "welcome");
          }
        }).catch(() => setScreen(urlCode ? "join" : "welcome"));
        return;
      } catch { localStorage.removeItem("gymPoints_player"); }
    }
    setScreen(urlCode ? "join" : "welcome");
  }, []);

  const urlCode = new URLSearchParams(window.location.search).get("code") || "";

  return (
    <div style={S.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500&display=swap');
        * { -webkit-tap-highlight-color:transparent; box-sizing:border-box; }
        input::placeholder { color:#333; }
        button:active { opacity:0.7; }
        ::-webkit-scrollbar { width:0; }
      `}</style>
      <div style={S.header}>
        <div style={S.title}>GYM POINTS 💪</div>
        <div style={{ fontSize:9, color:"#333", fontFamily:"monospace", marginTop:3, letterSpacing:3 }}>EARN · COLLECT · WIN</div>
      </div>
      <div style={S.container}>
        {screen==="loading" && <div style={{ textAlign:"center", paddingTop:80, fontFamily:"monospace", color:"#444" }}>Loading...</div>}
        {screen==="welcome" && <WelcomeScreen onCreate={()=>setScreen("create")} onJoin={()=>setScreen("join")} />}
        {screen==="create" && <CreateScreen onBack={()=>setScreen("welcome")} onCreated={(gc,pid)=>{setGameCode(gc);setPlayerId(pid);setScreen("game");}} />}
        {screen==="join" && <JoinScreen onBack={()=>setScreen("welcome")} onJoined={(gc,pid)=>{setGameCode(gc);setPlayerId(pid);setScreen("game");}} prefillCode={urlCode} />}
        {screen==="game" && gameCode && playerId && <GameScreen gameCode={gameCode} playerId={playerId} onLeave={()=>{localStorage.removeItem("gymPoints_player");setGameCode(null);setPlayerId(null);setScreen("welcome");}} />}
      </div>
    </div>
  );
}
