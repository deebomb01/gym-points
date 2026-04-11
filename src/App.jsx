import { useState, useEffect, useCallback, useRef } from "react";
import { doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

// ─── Constants ────────────────────────────────────────────
const DAYS = ["Mon","Tue","Wed","Thu","Fri"];
const TIER_3 = 120;
const EMOJIS   = ["💪","⭐","🔥","🏃","🦁","⚡","🎯","🥊","🚀","🌟"];
const COLORS   = ["#f59e0b","#3b82f6","#10b981","#ef4444","#8b5cf6","#ec4899","#06b6d4","#f97316"];
const REACTIONS = ["💪","🔥","⭐","👏","🤩"];
const CYCLE_OPTIONS = [
  { days:30, label:"30 Days", sub:"1 month"  },
  { days:60, label:"60 Days", sub:"2 months" },
  { days:90, label:"90 Days", sub:"3 months" },
];
// Day-of-week index → short name (Mon=0 … Fri=4, Sat=5, Sun=6)
const DOW = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

// ─── Helpers ──────────────────────────────────────────────
function getWeekKey() {
  const now = new Date();
  const mon = new Date(now);
  mon.setDate(now.getDate() - ((now.getDay()+6)%7));
  mon.setHours(0,0,0,0);
  return `wk_${mon.getFullYear()}_${mon.getMonth()}_${mon.getDate()}`;
}
function generateCode() {
  const c="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({length:6},()=>c[Math.floor(Math.random()*c.length)]).join("");
}
function generateId(){ return Math.random().toString(36).slice(2)+Date.now().toString(36); }
function getDaysLeft(resetAt,cycleDays){
  if(!resetAt) return cycleDays;
  return Math.max(0, cycleDays - Math.floor((Date.now()-resetAt)/86400000));
}
// Returns which weekday names have fully passed this week (Mon=0 … today excluded)
function passedDaysThisWeek(){
  const dow = new Date().getDay(); // 0=Sun,1=Mon...
  // Convert to Mon-based index: Mon=0,Tue=1,...,Sat=5,Sun=6
  const monBased = (dow+6)%7;
  // Days Mon–Fri that have fully passed (not today)
  const passed = [];
  for(let i=0;i<monBased&&i<5;i++) passed.push(DAYS[i]);
  return passed;
}
function formatTime(ts){
  const d=new Date(ts);
  return d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
}
function formatDate(ts){
  const d=new Date(ts);
  return d.toLocaleDateString([],{month:"short",day:"numeric"});
}

// Build REWARDS dynamically from creator-set amounts
function buildRewards(amounts){
  const icons=["🎁","🏆","👑"];
  const colors=["#f59e0b","#ef4444","#8b5cf6"];
  return [40,80,120].map((pts,i)=>({
    pts, icon:icons[i], color:colors[i],
    label: amounts?.[i] ? `$${amounts[i]} Reward` : `Reward ${i+1}`,
    amount: amounts?.[i] || 0,
  }));
}

// ─── Styles ───────────────────────────────────────────────
const S = {
  app:  { minHeight:"100vh", background:"#0a0a0a", color:"#fff", fontFamily:"'DM Sans',system-ui,sans-serif", paddingBottom:80 },
  hdr:  { background:"linear-gradient(180deg,#141414,#0a0a0a)", borderBottom:"1px solid #1c1c1c", padding:"env(safe-area-inset-top,20px) 20px 16px", textAlign:"center", position:"sticky", top:0, zIndex:50 },
  ttl:  { fontFamily:"'Bebas Neue',sans-serif", fontSize:34, letterSpacing:5, background:"linear-gradient(135deg,#f59e0b,#ef4444,#8b5cf6)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", lineHeight:1 },
  wrap: { maxWidth:480, margin:"0 auto", padding:"0 14px" },
  card: { background:"#141414", border:"1px solid #1e1e1e", borderRadius:18, padding:18, marginBottom:14 },
  lbl:  { fontSize:10, color:"#555", fontFamily:"monospace", letterSpacing:2, display:"block", marginBottom:8, textTransform:"uppercase" },
  inp:  { width:"100%", padding:"13px 16px", borderRadius:12, border:"1.5px solid #2a2a2a", background:"#0f0f0f", color:"#fff", fontSize:15, fontFamily:"monospace", outline:"none", letterSpacing:1, boxSizing:"border-box" },
  row:  { marginBottom:16 },
  btn:  (c="#f59e0b",out=false)=>({ padding:"13px 20px", borderRadius:12, border:out?`1.5px solid ${c}`:"none", background:out?"transparent":c, color:out?c:"#000", fontFamily:"monospace", fontSize:12, fontWeight:"bold", cursor:"pointer", width:"100%", letterSpacing:1, WebkitTapHighlightColor:"transparent" }),
};

// ─── Toast ────────────────────────────────────────────────
function Toast({msg}){
  if(!msg) return null;
  return <div style={{position:"fixed",top:80,left:"50%",transform:"translateX(-50%)",background:"#1c1c1c",border:"1px solid #333",borderRadius:12,padding:"10px 24px",fontFamily:"monospace",fontSize:12,color:"#fff",zIndex:300,boxShadow:"0 8px 40px #000a",whiteSpace:"nowrap",maxWidth:"90vw"}}>{msg}</div>;
}

// ─── Celebration ──────────────────────────────────────────
function Celebration({reward,onDone}){
  useEffect(()=>{const t=setTimeout(onDone,3500);return()=>clearTimeout(t);},[onDone]);
  const particles=Array.from({length:32},(_,i)=>({id:i,x:Math.random()*100,delay:Math.random()*.8,size:5+Math.random()*10,color:COLORS[Math.floor(Math.random()*COLORS.length)],dur:1.4+Math.random()}));
  return(
    <div onClick={onDone} style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.9)",cursor:"pointer"}}>
      <style>{`@keyframes cFall{0%{transform:translateY(-10px) rotate(0);opacity:1}100%{transform:translateY(110vh) rotate(720deg);opacity:0}}@keyframes popIn{0%{transform:scale(.3);opacity:0}60%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}@keyframes fPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}`}</style>
      {particles.map(p=><div key={p.id} style={{position:"fixed",left:`${p.x}%`,top:-20,width:p.size,height:p.size,borderRadius:p.id%2?"50%":"3px",background:p.color,animation:`cFall ${p.dur}s ${p.delay}s ease-in forwards`,pointerEvents:"none"}}/>)}
      <div style={{textAlign:"center",animation:"popIn .5s cubic-bezier(.4,2,.6,1) forwards"}}>
        <div style={{fontSize:90,animation:"fPulse 1s ease infinite"}}>{reward.icon}</div>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:46,color:reward.color,letterSpacing:3,lineHeight:1,textShadow:`0 0 40px ${reward.color}`}}>{reward.label}</div>
        <div style={{fontFamily:"monospace",fontSize:13,color:"#777",marginTop:12,letterSpacing:2}}>UNLOCKED! TAP TO CLAIM 🎉</div>
      </div>
    </div>
  );
}

// ─── Pickers ──────────────────────────────────────────────
function EmojiPicker({value,onChange}){
  return <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{EMOJIS.map(e=><button key={e} onClick={()=>onChange(e)} style={{fontSize:24,padding:6,borderRadius:10,background:value===e?"#222":"transparent",border:`1.5px solid ${value===e?"#555":"transparent"}`,cursor:"pointer"}}>{e}</button>)}</div>;
}
function ColorPicker({value,onChange}){
  return <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>{COLORS.map(c=><button key={c} onClick={()=>onChange(c)} style={{width:30,height:30,borderRadius:"50%",background:c,border:`3px solid ${value===c?"#fff":"transparent"}`,cursor:"pointer",outline:"none"}}/>)}</div>;
}

// ─── Dollar amount input ──────────────────────────────────
function RewardAmounts({values,onChange}){
  const tiers=[{pts:40,label:"Tier 1 (40 pts)"},{pts:80,label:"Tier 2 (80 pts)"},{pts:120,label:"Tier 3 (120 pts)"}];
  return(
    <div style={{display:"flex",gap:8}}>
      {tiers.map((t,i)=>(
        <div key={t.pts} style={{flex:1}}>
          <div style={{fontSize:9,fontFamily:"monospace",color:"#555",marginBottom:4,letterSpacing:1}}>{t.label}</div>
          <div style={{position:"relative"}}>
            <div style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:"#888",fontFamily:"monospace",fontSize:14,pointerEvents:"none"}}>$</div>
            <input
              type="number" min="1" max="999"
              value={values[i]||""}
              onChange={e=>{const v=[...values];v[i]=e.target.value;onChange(v);}}
              placeholder="0"
              style={{...S.inp,paddingLeft:22,fontSize:16,textAlign:"center"}}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Progress ring ────────────────────────────────────────
function Ring({points,color}){
  const r=52,circ=2*Math.PI*r,offset=circ*(1-Math.min(points/TIER_3,1));
  return(
    <svg width="126" height="126" style={{transform:"rotate(-90deg)"}}>
      <circle cx="63" cy="63" r={r} fill="none" stroke="#1e1e1e" strokeWidth="9"/>
      <circle cx="63" cy="63" r={r} fill="none" stroke={color} strokeWidth="9"
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{transition:"stroke-dashoffset .6s cubic-bezier(.4,2,.6,1)",filter:`drop-shadow(0 0 6px ${color}88)`}}/>
    </svg>
  );
}

// ─── Stat badge ───────────────────────────────────────────
function Stat({label,value,color}){
  return(
    <div style={{flex:1,textAlign:"center",background:"#0f0f0f",borderRadius:12,padding:"10px 4px",border:"1px solid #1e1e1e"}}>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,color:color||"#fff",lineHeight:1}}>{value}</div>
      <div style={{fontSize:8,fontFamily:"monospace",color:"#444",marginTop:3,letterSpacing:1}}>{label}</div>
    </div>
  );
}

// ─── Cycle bar ────────────────────────────────────────────
function CycleBar({resetAt,cycleDays,gameName}){
  const left=getDaysLeft(resetAt,cycleDays);
  const pct=((cycleDays-left)/cycleDays)*100;
  const col=left>cycleDays*.33?"#10b981":left>cycleDays*.15?"#f59e0b":"#ef4444";
  return(
    <div style={{...S.card,marginBottom:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:2,color:"#fff"}}>{gameName||"GYM POINTS"}</div>
        <div style={{fontFamily:"monospace",fontSize:11,color:col}}>{left}d left</div>
      </div>
      <div style={{height:6,borderRadius:3,background:"#1e1e1e",overflow:"hidden"}}>
        <div style={{height:"100%",borderRadius:3,width:`${pct}%`,background:col,transition:"width .5s ease"}}/>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:4}}>
        <div style={{fontFamily:"monospace",fontSize:9,color:"#333"}}>START</div>
        <div style={{fontFamily:"monospace",fontSize:9,color:"#333"}}>DAY {cycleDays} → RESET</div>
      </div>
    </div>
  );
}

// ─── Leaderboard ──────────────────────────────────────────
function Leaderboard({players,myId}){
  const sorted=[...players].sort((a,b)=>(b.points||0)-(a.points||0));
  const medals=["🥇","🥈","🥉"];
  return(
    <div style={S.card}>
      <div style={S.lbl}>STANDINGS</div>
      {sorted.map((p,i)=>(
        <div key={p.id} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 0",borderBottom:i<sorted.length-1?"1px solid #1a1a1a":"none"}}>
          <div style={{fontSize:20,width:28,textAlign:"center"}}>{medals[i]||`${i+1}`}</div>
          <div style={{fontSize:22}}>{p.emoji}</div>
          <div style={{flex:1}}>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:18,color:p.id===myId?p.color:"#fff",letterSpacing:1}}>{p.name}{p.id===myId?" (you)":""}</div>
            <div style={{height:4,borderRadius:2,background:"#1e1e1e",marginTop:5}}>
              <div style={{height:"100%",borderRadius:2,background:p.color,width:`${Math.min(((p.points||0)/TIER_3)*100,100)}%`,transition:"width .5s ease"}}/>
            </div>
          </div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,color:p.color,textShadow:`0 0 12px ${p.color}55`}}>{p.points||0}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Weekly history ───────────────────────────────────────
function History({history}){
  if(!history||history.length===0) return(
    <div style={{...S.card,textAlign:"center"}}>
      <div style={{fontSize:32,marginBottom:8}}>📊</div>
      <div style={{fontFamily:"monospace",fontSize:12,color:"#555"}}>Weekly history appears here<br/>after your first full week!</div>
    </div>
  );
  const max=Math.max(...history.map(w=>w.pts),1);
  return(
    <div style={S.card}>
      <div style={S.lbl}>WEEKLY HISTORY</div>
      {[...history].reverse().slice(0,8).map((wk,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:i<Math.min(history.length,8)-1?"1px solid #1a1a1a":"none"}}>
          <div style={{fontFamily:"monospace",fontSize:10,color:"#555",width:48,flexShrink:0}}>Week {history.length-i}</div>
          <div style={{flex:1,height:5,borderRadius:3,background:"#1e1e1e"}}>
            <div style={{height:"100%",borderRadius:3,background:wk.pts>=35?"#10b981":wk.pts>=20?"#f59e0b":"#555",width:`${(wk.pts/max)*100}%`,transition:"width .4s ease"}}/>
          </div>
          <div style={{fontFamily:"monospace",fontSize:11,color:wk.pts>=35?"#10b981":wk.pts>=20?"#f59e0b":"#888",width:28,textAlign:"right"}}>+{wk.pts}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Points log ───────────────────────────────────────────
function PointsLog({log}){
  if(!log||log.length===0) return(
    <div style={{...S.card,textAlign:"center"}}>
      <div style={{fontSize:32,marginBottom:8}}>📋</div>
      <div style={{fontFamily:"monospace",fontSize:12,color:"#555"}}>Your point log will appear here<br/>as you check in each day!</div>
    </div>
  );
  return(
    <div style={S.card}>
      <div style={S.lbl}>POINTS LOG</div>
      {[...log].reverse().slice(0,30).map((entry,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",borderBottom:i<Math.min(log.length,30)-1?"1px solid #1a1a1a":"none"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{fontSize:16}}>{entry.pts===10?"⭐":"💪"}</div>
            <div>
              <div style={{fontFamily:"monospace",fontSize:12,color:"#ccc"}}>{entry.day} check-in</div>
              <div style={{fontFamily:"monospace",fontSize:10,color:"#444",marginTop:2}}>{formatDate(entry.ts)} · {formatTime(entry.ts)}</div>
            </div>
          </div>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:"#10b981"}}>+{entry.pts}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Day grid with missed-day indicators ──────────────────
function DayGrid({player,isMe,onCheckin,weekKey}){
  const wkCheckins=(player.allCheckins||{})[weekKey]||{};
  const missed=passedDaysThisWeek();

  return(
    <div>
      <div style={{display:"flex",gap:4,marginBottom:4}}>
        {DAYS.map(day=>{
          const checked=!!wkCheckins[day];
          const wasMissed=!checked&&missed.includes(day);
          return(
            <button key={day} onClick={()=>isMe&&!checked&&onCheckin(day,5)} style={{
              flex:1,padding:"10px 2px",borderRadius:10,
              cursor:isMe&&!checked?"pointer":"default",
              border:`1.5px solid ${checked?player.color:wasMissed?"#3a2020":"#222"}`,
              background:checked?`${player.color}1a`:wasMissed?"#1c1010":"#0f0f0f",
              color:checked?player.color:wasMissed?"#4a2a2a":"#444",
              fontFamily:"monospace",fontSize:10,
              WebkitTapHighlightColor:"transparent",
              transition:"all .2s",
              position:"relative",
            }}>
              <div style={{fontWeight:"bold"}}>{day}</div>
              <div style={{marginTop:3,fontSize:11}}>{checked?"✓":wasMissed?"✗":isMe?"+5":"·"}</div>
              {wasMissed&&<div style={{position:"absolute",top:3,right:3,width:4,height:4,borderRadius:"50%",background:"#6b2020"}}/>}
            </button>
          );
        })}
        {(()=>{
          const checked=!!wkCheckins["Sat"];
          return(
            <button onClick={()=>isMe&&!checked&&onCheckin("Sat",10)} style={{
              flex:1,padding:"10px 2px",borderRadius:10,
              cursor:isMe&&!checked?"pointer":"default",
              border:`1.5px solid ${checked?"#f59e0b":"#222"}`,
              background:checked?"#f59e0b1a":"#0f0f0f",
              color:checked?"#f59e0b":"#444",
              fontFamily:"monospace",fontSize:10,
              WebkitTapHighlightColor:"transparent",
            }}>
              <div style={{fontWeight:"bold"}}>⭐Sat</div>
              <div style={{marginTop:3,fontSize:11}}>{checked?"✓":isMe?"+10":"·"}</div>
            </button>
          );
        })()}
      </div>
      {missed.length>0&&isMe&&(
        <div style={{fontFamily:"monospace",fontSize:9,color:"#4a2a2a",textAlign:"center",marginTop:2}}>
          ✗ missed days shown in red — keep going!
        </div>
      )}
    </div>
  );
}

// ─── Reactions ────────────────────────────────────────────
function ReactionBar({player,myId,gameCode,weekKey}){
  const reactions=(player.reactions||{})[weekKey]||{};
  async function handleReact(emoji){
    if(player.id===myId) return;
    const ref=doc(db,"games",gameCode);
    const snap=await getDoc(ref);
    if(!snap.exists()) return;
    const current=snap.data().players[player.id]?.reactions?.[weekKey]?.[emoji]||[];
    const already=current.includes(myId);
    await updateDoc(ref,{[`players.${player.id}.reactions.${weekKey}.${emoji}`]:already?current.filter(id=>id!==myId):[...current,myId]});
  }
  const isMyCard=player.id===myId;
  return(
    <div style={{display:"flex",gap:5,marginTop:10,flexWrap:"wrap"}}>
      {REACTIONS.map(emoji=>{
        const who=reactions[emoji]||[];
        const iReacted=who.includes(myId);
        const count=who.length;
        if(count===0&&isMyCard) return null;
        return(
          <button key={emoji} onClick={()=>handleReact(emoji)} style={{padding:"4px 9px",borderRadius:20,background:iReacted?`${player.color}22`:"#111",border:`1px solid ${iReacted?player.color+"55":"#222"}`,color:iReacted?player.color:"#555",fontFamily:"monospace",fontSize:12,cursor:isMyCard?"default":"pointer",display:"flex",alignItems:"center",gap:4,transition:"all .15s"}}>
            <span>{emoji}</span>
            {count>0&&<span style={{fontSize:10}}>{count}</span>}
          </button>
        );
      })}
      {!isMyCard&&<div style={{fontSize:10,fontFamily:"monospace",color:"#333",alignSelf:"center",marginLeft:2}}>react</div>}
    </div>
  );
}

// ─── Edit profile ──────────────────────────────────────────
function EditProfile({player,gameCode,onClose}){
  const [name,setName]=useState(player.name);
  const [emoji,setEmoji]=useState(player.emoji);
  const [color,setColor]=useState(player.color);
  const [saving,setSaving]=useState(false);
  async function save(){
    setSaving(true);
    await updateDoc(doc(db,"games",gameCode),{
      [`players.${player.id}.name`]:name.trim()||player.name,
      [`players.${player.id}.emoji`]:emoji,
      [`players.${player.id}.color`]:color,
    });
    setSaving(false);
    onClose();
  }
  return(
    <div style={{position:"fixed",inset:0,zIndex:500,background:"rgba(0,0,0,0.85)",display:"flex",alignItems:"flex-end",justifyContent:"center"}} onClick={onClose}>
      <div style={{background:"#141414",borderRadius:"20px 20px 0 0",padding:24,width:"100%",maxWidth:480,paddingBottom:"env(safe-area-inset-bottom,24px)"}} onClick={e=>e.stopPropagation()}>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,letterSpacing:3,marginBottom:20}}>EDIT PROFILE</div>
        <div style={S.row}><label style={S.lbl}>NAME</label><input style={S.inp} value={name} onChange={e=>setName(e.target.value)} maxLength={20}/></div>
        <div style={S.row}><label style={S.lbl}>EMOJI</label><EmojiPicker value={emoji} onChange={setEmoji}/></div>
        <div style={{...S.row,marginBottom:20}}><label style={S.lbl}>COLOR</label><ColorPicker value={color} onChange={setColor}/></div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={onClose} style={{...S.btn("#333",true),flex:1,width:"auto",color:"#aaa"}}>Cancel</button>
          <button onClick={save} disabled={saving} style={{...S.btn(color),flex:1,width:"auto",color:"#000"}}>{saving?"SAVING...":"SAVE"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Player card ──────────────────────────────────────────
function PlayerCard({player,isMe,onCheckin,onClaim,gameCode,weekKey,rewards}){
  const [expanded,setExpanded]=useState(isMe);
  const points=player.points||0;
  const claimed=player.claimed||[];
  const streak=player.streak||0;
  const stats=player.stats||{};
  const claimable=rewards.find(r=>r.pts<=points&&!claimed.includes(r.pts));
  const nextReward=rewards.find(r=>r.pts>points&&!claimed.includes(r.pts));
  const wkCheckins=(player.allCheckins||{})[weekKey]||{};
  const thisWeekPts=Object.entries(wkCheckins).reduce((s,[k,v])=>v?s+(k==="Sat"?10:5):s,0);

  return(
    <div style={{...S.card,border:isMe?`1px solid ${player.color}44`:"1px solid #1e1e1e",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:-60,right:-60,width:160,height:160,borderRadius:"50%",background:`${player.color}0c`,filter:"blur(50px)",pointerEvents:"none"}}/>
      {isMe&&<div style={{position:"absolute",top:0,right:0,background:player.color,fontSize:9,fontFamily:"monospace",padding:"3px 10px",borderBottomLeftRadius:8,color:"#000",letterSpacing:1}}>YOU</div>}

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14}}>
        <div style={{position:"relative",flexShrink:0}}>
          <Ring points={points} color={player.color}/>
          <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
            <div style={{fontSize:20}}>{player.emoji}</div>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,color:player.color,lineHeight:1,textShadow:`0 0 16px ${player.color}66`}}>{points}</div>
            <div style={{fontSize:7,fontFamily:"monospace",color:"#444"}}>/120 PTS</div>
          </div>
        </div>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,color:player.color,letterSpacing:1.5,lineHeight:1}}>{player.name}</div>
            {isMe&&<button onClick={()=>setExpanded(v=>!v)} style={{background:"none",border:"1px solid #2a2a2a",borderRadius:8,color:"#555",fontFamily:"monospace",fontSize:9,padding:"2px 7px",cursor:"pointer",letterSpacing:1}}>{expanded?"LESS":"MORE"}</button>}
          </div>
          <div style={{display:"flex",gap:6,marginTop:8}}>
            <Stat label="STREAK" value={`${streak}w`} color={streak>=4?"#10b981":"#888"}/>
            <Stat label="THIS WK" value={`+${thisWeekPts}`} color={player.color}/>
            <Stat label="GYM DAYS" value={stats.totalDays||0} color="#888"/>
          </div>
        </div>
      </div>

      {/* Tier bars */}
      <div style={{display:"flex",gap:5,marginBottom:14}}>
        {rewards.map((r,i)=>{
          const filled=Math.min(Math.max(points-i*40,0),40);
          const isDone=points>=r.pts,isAct=!isDone&&Math.floor(points/40)===i;
          return(
            <div key={r.pts} style={{flex:1}}>
              <div style={{fontSize:8,fontFamily:"monospace",color:isDone?r.color:"#2a2a2a",textAlign:"center",marginBottom:3,letterSpacing:.5}}>{r.label}</div>
              <div style={{height:5,borderRadius:3,background:"#1a1a1a",border:`1px solid ${isAct?r.color+"44":"#1e1e1e"}`,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${(filled/40)*100}%`,background:r.color,borderRadius:3,transition:"width .4s ease",boxShadow:isDone?`0 0 6px ${r.color}`:""}}/>
              </div>
            </div>
          );
        })}
      </div>

      {/* Claim */}
      {claimable&&isMe&&(
        <button onClick={()=>onClaim(claimable.pts)} style={{width:"100%",padding:"10px 16px",borderRadius:12,marginBottom:12,background:`linear-gradient(135deg,${claimable.color}22,${claimable.color}0d)`,border:`1px solid ${claimable.color}66`,color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",animation:"glowPulse 2s ease infinite"}}>
          <span style={{fontSize:12,fontFamily:"monospace"}}>{claimable.icon} {claimable.label} UNLOCKED!</span>
          <span style={{fontSize:10,background:claimable.color,color:"#000",borderRadius:6,padding:"2px 10px",fontFamily:"monospace"}}>CLAIM →</span>
        </button>
      )}

      {/* Day grid */}
      {(expanded||!isMe)&&<DayGrid player={player} isMe={isMe} onCheckin={onCheckin} weekKey={weekKey}/>}

      {/* Reactions */}
      <ReactionBar player={player} myId={null} gameCode={gameCode} weekKey={weekKey}/>

      {/* Footer */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10}}>
        {nextReward
          ?<div style={{fontSize:10,color:"#444",fontFamily:"monospace"}}>{nextReward.icon} {nextReward.pts-points} pts to {nextReward.label}</div>
          :<div style={{fontSize:10,color:"#8b5cf6",fontFamily:"monospace"}}>👑 MAX REACHED!</div>
        }
        {claimed.length>0&&<div style={{fontSize:12}}>{claimed.map(p=>rewards.find(r=>r.pts===p)?.icon).join(" ")}</div>}
      </div>
    </div>
  );
}

// ─── Welcome ──────────────────────────────────────────────
function WelcomeScreen({onCreate,onJoin}){
  return(
    <div style={{paddingTop:32}}>
      <div style={{textAlign:"center",marginBottom:40}}>
        <div style={{fontSize:72,marginBottom:16}}>💪</div>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:3,marginBottom:8}}>EARN POINTS. WIN REWARDS.</div>
        <div style={{fontSize:13,color:"#555",fontFamily:"monospace",lineHeight:1.8}}>Track gym visits with friends & family.<br/>Collect real cash rewards.</div>
      </div>
      <div style={S.row}><button onClick={onCreate} style={S.btn("#f59e0b")}>🏋️ CREATE A NEW GAME</button></div>
      <div style={{textAlign:"center",color:"#333",fontFamily:"monospace",fontSize:11,margin:"8px 0"}}>— or —</div>
      <div style={S.row}><button onClick={onJoin} style={S.btn("#3b82f6",true)}>🔗 JOIN WITH A CODE</button></div>
      <div style={{...S.card,marginTop:32}}>
        <div style={S.lbl}>HOW IT WORKS</div>
        {[["🏋️","Mon–Fri earns +5 pts · Saturday bonus +10 pts"],["📈","Points carry forward every week until reset"],["🎁","Creator sets custom reward amounts for each tier"],["🔄","Cycle auto-resets (30, 60, or 90 days)"],["📱","Installs on iPhone & Android like a real app"]].map(([icon,text])=>(
          <div key={text} style={{display:"flex",gap:12,marginBottom:10,alignItems:"flex-start"}}>
            <span style={{fontSize:16}}>{icon}</span>
            <span style={{fontSize:12,color:"#555",fontFamily:"monospace",lineHeight:1.6}}>{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Create ───────────────────────────────────────────────
function CreateScreen({onBack,onCreated}){
  const [gameName,setGameName]=useState("");
  const [name,setName]=useState("");
  const [emoji,setEmoji]=useState("💪");
  const [color,setColor]=useState(COLORS[0]);
  const [cycleDays,setCycleDays]=useState(30);
  const [amounts,setAmounts]=useState(["20","40","60"]);
  const [loading,setLoading]=useState(false);

  const amountsValid=amounts.every(a=>a&&Number(a)>0);

  async function go(){
    if(!name.trim()||!amountsValid) return;
    setLoading(true);
    try{
      const gameCode=generateCode(),playerId=generateId(),now=Date.now();
      const player={id:playerId,name:name.trim(),emoji,color,points:0,claimed:[],allCheckins:{},weekKey:getWeekKey(),streak:0,joinedAt:now,weeklyPts:0,reactions:{},pointsLog:[],stats:{totalDays:0,bestWeek:0,weeklyHistory:[]}};
      await setDoc(doc(db,"games",gameCode),{
        code:gameCode, createdAt:serverTimestamp(), resetAt:now,
        cycleDays, gameName:gameName.trim()||"Gym Points",
        rewardAmounts:amounts.map(Number),
        players:{[playerId]:player},
      });
      localStorage.setItem("gymPoints_player",JSON.stringify({playerId,gameCode}));
      onCreated(gameCode,playerId);
    }catch(e){console.error(e);alert("Error creating game. Check src/firebase.js config.");}
    setLoading(false);
  }

  return(
    <div style={{paddingTop:24}}>
      <button onClick={onBack} style={{background:"none",border:"none",color:"#555",fontFamily:"monospace",fontSize:12,cursor:"pointer",marginBottom:20}}>← BACK</button>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:3,marginBottom:24}}>CREATE GAME</div>
      <div style={S.card}>

        {/* Game name */}
        <div style={S.row}>
          <label style={S.lbl}>GAME NAME</label>
          <input style={S.inp} value={gameName} onChange={e=>setGameName(e.target.value)} placeholder='e.g. "Squad Goals 💪"' maxLength={30}/>
        </div>

        <div style={{height:1,background:"#1e1e1e",margin:"4px 0 20px"}}/>

        {/* Your profile */}
        <div style={S.row}><label style={S.lbl}>YOUR NAME</label><input style={S.inp} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Sis, Coach..." maxLength={20}/></div>
        <div style={S.row}><label style={S.lbl}>PICK YOUR EMOJI</label><EmojiPicker value={emoji} onChange={setEmoji}/></div>
        <div style={S.row}><label style={S.lbl}>PICK YOUR COLOR</label><ColorPicker value={color} onChange={setColor}/></div>

        <div style={{height:1,background:"#1e1e1e",margin:"4px 0 20px"}}/>

        {/* Reward amounts */}
        <div style={S.row}>
          <label style={S.lbl}>SET REWARD AMOUNTS</label>
          <RewardAmounts values={amounts} onChange={setAmounts}/>
          {!amountsValid&&<div style={{fontFamily:"monospace",fontSize:10,color:"#ef4444",marginTop:6}}>Please enter a dollar amount for each tier</div>}
        </div>

        {/* Cycle length */}
        <div style={S.row}>
          <label style={S.lbl}>CYCLE LENGTH</label>
          <div style={{display:"flex",gap:8}}>
            {CYCLE_OPTIONS.map(opt=>(
              <button key={opt.days} onClick={()=>setCycleDays(opt.days)} style={{flex:1,padding:"10px 4px",borderRadius:12,border:`1.5px solid ${cycleDays===opt.days?color:"#2a2a2a"}`,background:cycleDays===opt.days?`${color}1a`:"#0f0f0f",color:cycleDays===opt.days?color:"#555",fontFamily:"monospace",fontSize:11,cursor:"pointer",textAlign:"center"}}>
                <div style={{fontWeight:"bold"}}>{opt.label}</div>
                <div style={{fontSize:9,marginTop:2,opacity:.7}}>{opt.sub}</div>
              </button>
            ))}
          </div>
        </div>

        <button onClick={go} disabled={!name.trim()||!amountsValid||loading} style={{...S.btn(color),opacity:!name.trim()||!amountsValid||loading?.4:1,color:"#000"}}>
          {loading?"CREATING...":"🏋️ LET'S GO!"}
        </button>
      </div>
    </div>
  );
}

// ─── Join ─────────────────────────────────────────────────
function JoinScreen({onBack,onJoined,prefillCode}){
  const [code,setCode]=useState(prefillCode||"");
  const [name,setName]=useState("");
  const [emoji,setEmoji]=useState("⭐");
  const [color,setColor]=useState(COLORS[1]);
  const [loading,setLoading]=useState(false);
  const [step,setStep]=useState(prefillCode?2:1);
  const [gameInfo,setGameInfo]=useState(null);

  async function checkCode(){
    setLoading(true);
    const snap=await getDoc(doc(db,"games",code.trim().toUpperCase()));
    setLoading(false);
    if(snap.exists()){
      setGameInfo(snap.data());
      setStep(2);
    }else alert("Game not found. Check the code.");
  }

  async function join(){
    if(!name.trim()) return;
    setLoading(true);
    try{
      const playerId=generateId(),gc=code.trim().toUpperCase();
      const player={id:playerId,name:name.trim(),emoji,color,points:0,claimed:[],allCheckins:{},weekKey:getWeekKey(),streak:0,joinedAt:Date.now(),weeklyPts:0,reactions:{},pointsLog:[],stats:{totalDays:0,bestWeek:0,weeklyHistory:[]}};
      await updateDoc(doc(db,"games",gc),{[`players.${playerId}`]:player});
      localStorage.setItem("gymPoints_player",JSON.stringify({playerId,gameCode:gc}));
      onJoined(gc,playerId);
    }catch{alert("Error joining game.");}
    setLoading(false);
  }

  return(
    <div style={{paddingTop:24}}>
      <button onClick={onBack} style={{background:"none",border:"none",color:"#555",fontFamily:"monospace",fontSize:12,cursor:"pointer",marginBottom:20}}>← BACK</button>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:3,marginBottom:24}}>JOIN GAME</div>
      {step===1&&(
        <div style={S.card}>
          <div style={S.row}><label style={S.lbl}>GAME CODE</label><input style={{...S.inp,textTransform:"uppercase",letterSpacing:6,fontSize:22,textAlign:"center"}} value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="XXXXXX" maxLength={6}/></div>
          <button onClick={checkCode} disabled={code.length<4||loading} style={{...S.btn("#3b82f6"),opacity:code.length<4||loading?.4:1,color:"#fff"}}>{loading?"CHECKING...":"FIND GAME →"}</button>
        </div>
      )}
      {step===2&&(
        <div style={S.card}>
          <div style={{marginBottom:16,padding:"10px 14px",background:"#0f0f0f",borderRadius:12,border:"1px solid #1e1e1e"}}>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:"#fff",letterSpacing:2}}>{gameInfo?.gameName||"Gym Points"}</div>
            <div style={{fontFamily:"monospace",fontSize:10,color:"#555",marginTop:2}}>
              {Object.keys(gameInfo?.players||{}).length} player{Object.keys(gameInfo?.players||{}).length!==1?"s":""} · {gameInfo?.cycleDays||30}-day cycle
            </div>
          </div>
          <div style={S.row}><label style={S.lbl}>YOUR NAME</label><input style={S.inp} value={name} onChange={e=>setName(e.target.value)} placeholder="Your name..." maxLength={20}/></div>
          <div style={S.row}><label style={S.lbl}>PICK YOUR EMOJI</label><EmojiPicker value={emoji} onChange={setEmoji}/></div>
          <div style={{...S.row,marginBottom:20}}><label style={S.lbl}>PICK YOUR COLOR</label><ColorPicker value={color} onChange={setColor}/></div>
          <button onClick={join} disabled={!name.trim()||loading} style={{...S.btn(color),opacity:!name.trim()||loading?.4:1,color:"#000"}}>{loading?"JOINING...":"💪 JOIN THE GAME!"}</button>
        </div>
      )}
    </div>
  );
}

// ─── Game screen ──────────────────────────────────────────
function GameScreen({gameCode,playerId,onLeave}){
  const [gameData,setGameData]=useState(null);
  const [toast,setToast]=useState(null);
  const [celebration,setCelebration]=useState(null);
  const [showShare,setShowShare]=useState(false);
  const [showReset,setShowReset]=useState(false);
  const [editingProfile,setEditingProfile]=useState(false);
  const [activeTab,setActiveTab]=useState("players");
  const prevPtsRef=useRef({});
  const weekKey=getWeekKey();

  function showToast(msg){setToast(msg);setTimeout(()=>setToast(null),2800);}

  useEffect(()=>{
    const ref=doc(db,"games",gameCode);
    return onSnapshot(ref,async snap=>{
      if(!snap.exists()) return;
      const data=snap.data();
      const cycleDays=data.cycleDays||30;
      if(getDaysLeft(data.resetAt,cycleDays)===0){
        const updates={resetAt:Date.now()};
        Object.keys(data.players||{}).forEach(pid=>{
          updates[`players.${pid}.points`]=0;
          updates[`players.${pid}.claimed`]=[];
          updates[`players.${pid}.allCheckins`]={};
          updates[`players.${pid}.weekKey`]=getWeekKey();
          updates[`players.${pid}.weeklyPts`]=0;
          updates[`players.${pid}.streak`]=0;
          updates[`players.${pid}.pointsLog`]=[];
        });
        await updateDoc(ref,updates);
        return;
      }
      const me=data.players?.[playerId];
      if(me){
        const prev=prevPtsRef.current[playerId]||0,curr=me.points||0;
        if(curr!==prev){
          const rewards=buildRewards(data.rewardAmounts);
          const hit=rewards.find(r=>r.pts<=curr&&r.pts>prev&&!(me.claimed||[]).includes(r.pts));
          if(hit) setCelebration(hit);
          prevPtsRef.current[playerId]=curr;
        }
      }
      setGameData(data);
    });
  },[gameCode,playerId]);

  const handleCheckin=useCallback(async(day,pts)=>{
    const wk=getWeekKey();
    const ref=doc(db,"games",gameCode);
    const snap=await getDoc(ref);
    if(!snap.exists()) return;
    const me=snap.data().players[playerId];
    if(!me) return;
    const allCheckins=me.allCheckins||{};
    const wkCheckins=allCheckins[wk]||{};
    if(wkCheckins[day]) return;

    const newPoints=Math.min((me.points||0)+pts,TIER_3);
    const newAllCheckins={...allCheckins,[wk]:{...wkCheckins,[day]:true}};
    const isNewWeek=me.weekKey!==wk;
    let weeklyHistory=me.stats?.weeklyHistory||[];
    if(isNewWeek&&(me.weeklyPts||0)>0){
      weeklyHistory=[...weeklyHistory,{label:me.weekKey,pts:me.weeklyPts}].slice(-16);
    }
    const weeklyPts=(isNewWeek?0:(me.weeklyPts||0))+pts;
    const bestWeek=Math.max(me.stats?.bestWeek||0,weeklyPts);
    const totalDays=(me.stats?.totalDays||0)+1;
    let streak=me.streak||0;
    if(isNewWeek) streak=Object.keys(me.allCheckins||{}).length>0?streak+1:1;

    // Append to points log
    const pointsLog=[...(me.pointsLog||[]),{day,pts,ts:Date.now()}].slice(-100);

    await updateDoc(ref,{
      [`players.${playerId}.points`]:newPoints,
      [`players.${playerId}.allCheckins`]:newAllCheckins,
      [`players.${playerId}.weekKey`]:wk,
      [`players.${playerId}.weeklyPts`]:weeklyPts,
      [`players.${playerId}.streak`]:streak,
      [`players.${playerId}.pointsLog`]:pointsLog,
      [`players.${playerId}.stats.totalDays`]:totalDays,
      [`players.${playerId}.stats.bestWeek`]:bestWeek,
      [`players.${playerId}.stats.weeklyHistory`]:weeklyHistory,
    });
    showToast(`${day} logged! +${pts} pts 🔥`);
  },[gameCode,playerId]);

  const handleClaim=useCallback(async(pts)=>{
    const ref=doc(db,"games",gameCode);
    const snap=await getDoc(ref);
    if(!snap.exists()) return;
    const me=snap.data().players[playerId];
    if(!me||(me.claimed||[]).includes(pts)) return;
    await updateDoc(ref,{[`players.${playerId}.claimed`]:[...(me.claimed||[]),pts]});
    const rewards=buildRewards(snap.data().rewardAmounts);
    const r=rewards.find(r=>r.pts===pts);
    showToast(`${r.icon} ${r.label} claimed! Go collect! 🎉`);
  },[gameCode,playerId]);

  const handleReset=useCallback(async()=>{
    const ref=doc(db,"games",gameCode);
    const snap=await getDoc(ref);
    if(!snap.exists()) return;
    const updates={resetAt:Date.now()};
    Object.keys(snap.data().players||{}).forEach(pid=>{
      updates[`players.${pid}.points`]=0;
      updates[`players.${pid}.claimed`]=[];
      updates[`players.${pid}.allCheckins`]={};
      updates[`players.${pid}.weekKey`]=getWeekKey();
      updates[`players.${pid}.weeklyPts`]=0;
      updates[`players.${pid}.streak`]=0;
      updates[`players.${pid}.pointsLog`]=[];
    });
    await updateDoc(ref,updates);
    setShowReset(false);
    showToast("New cycle started! 🏁");
  },[gameCode]);

  const shareUrl=`${window.location.origin}${window.location.pathname}?code=${gameCode}`;
  function handleShare(){
    if(navigator.share){navigator.share({title:`Join ${gameData?.gameName||"Gym Points"}!`,text:`Use code ${gameCode}`,url:shareUrl}).catch(()=>{});}
    else{navigator.clipboard.writeText(shareUrl).then(()=>showToast("Link copied! 📋"));setShowShare(s=>!s);}
  }

  if(!gameData) return(
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"60vh"}}>
      <div style={{fontFamily:"monospace",color:"#444",textAlign:"center"}}><div style={{fontSize:36,marginBottom:12}}>⏳</div>Loading game...</div>
    </div>
  );

  const players=Object.values(gameData.players||{}).sort((a,b)=>(b.points||0)-(a.points||0));
  const me=gameData.players?.[playerId];
  const cycleDays=gameData.cycleDays||30;
  const rewards=buildRewards(gameData.rewardAmounts);

  return(
    <div>
      <style>{`@keyframes glowPulse{0%,100%{opacity:1}50%{opacity:.65}}@keyframes slideUp{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
      <Toast msg={toast}/>
      {celebration&&<Celebration reward={celebration} onDone={()=>setCelebration(null)}/>}
      {editingProfile&&me&&<EditProfile player={me} gameCode={gameCode} onClose={()=>setEditingProfile(false)}/>}

      {/* Top bar */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",background:"#111",borderBottom:"1px solid #1a1a1a"}}>
        <div>
          <div style={{fontSize:9,fontFamily:"monospace",color:"#444",letterSpacing:2}}>GAME CODE</div>
          <div style={{fontFamily:"monospace",fontSize:20,color:"#fff",letterSpacing:5}}>{gameCode}</div>
        </div>
        <div style={{display:"flex",gap:5}}>
          {me&&<button onClick={()=>setEditingProfile(true)} style={{padding:"7px 10px",borderRadius:10,background:"#1a1a1a",border:"1px solid #2a2a2a",color:"#aaa",fontFamily:"monospace",fontSize:11,cursor:"pointer"}}>✏️ Edit</button>}
          <button onClick={handleShare} style={{padding:"7px 10px",borderRadius:10,background:"#1a1a1a",border:"1px solid #2a2a2a",color:"#aaa",fontFamily:"monospace",fontSize:11,cursor:"pointer"}}>🔗 Invite</button>
          <button onClick={onLeave} style={{padding:"7px 10px",borderRadius:10,background:"#1a1a1a",border:"1px solid #2a2a2a",color:"#555",fontFamily:"monospace",fontSize:11,cursor:"pointer"}}>Exit</button>
        </div>
      </div>

      {showShare&&(
        <div style={{background:"#111",borderBottom:"1px solid #1a1a1a",padding:"12px 16px"}}>
          <div style={{fontFamily:"monospace",fontSize:11,color:"#444",marginBottom:6}}>SHARE LINK OR CODE:</div>
          <div style={{fontFamily:"monospace",fontSize:11,color:"#777",wordBreak:"break-all",marginBottom:8}}>{shareUrl}</div>
          <button onClick={()=>{navigator.clipboard.writeText(shareUrl);showToast("Copied! 📋");}} style={{...S.btn("#3b82f6"),color:"#fff"}}>COPY LINK</button>
        </div>
      )}

      <div style={S.wrap}>
        <div style={{marginTop:14}}><CycleBar resetAt={gameData.resetAt} cycleDays={cycleDays} gameName={gameData.gameName}/></div>

        {/* Rewards legend */}
        <div style={{display:"flex",gap:6,marginBottom:14}}>
          {rewards.map(r=>(
            <div key={r.pts} style={{flex:1,textAlign:"center",background:"#141414",borderRadius:12,border:`1px solid ${r.color}22`,padding:"8px 4px"}}>
              <div style={{fontSize:18}}>{r.icon}</div>
              <div style={{fontFamily:"monospace",fontSize:9,color:r.color,marginTop:2}}>{r.pts} PTS</div>
              <div style={{fontFamily:"monospace",fontSize:9,color:"#aaa",fontWeight:"bold"}}>{r.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{display:"flex",gap:4,marginBottom:14,background:"#111",borderRadius:12,padding:4}}>
          {[{id:"players",label:"Players"},{id:"leaderboard",label:"Standings"},{id:"history",label:"My History"}].map(t=>(
            <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{flex:1,padding:"8px 4px",borderRadius:10,background:activeTab===t.id?"#222":"transparent",border:"none",color:activeTab===t.id?"#fff":"#555",fontFamily:"monospace",fontSize:11,cursor:"pointer",transition:"all .2s"}}>{t.label}</button>
          ))}
        </div>

        {activeTab==="players"&&players.map(player=>(
          <div key={player.id} style={{animation:"slideUp .3s ease"}}>
            <PlayerCard player={player} isMe={player.id===playerId} onCheckin={handleCheckin} onClaim={handleClaim} gameCode={gameCode} weekKey={weekKey} rewards={rewards}/>
          </div>
        ))}

        {activeTab==="leaderboard"&&<div style={{animation:"slideUp .3s ease"}}><Leaderboard players={players} myId={playerId}/></div>}

        {activeTab==="history"&&me&&(
          <div style={{animation:"slideUp .3s ease"}}>
            <div style={{...S.card,marginBottom:14}}>
              <div style={S.lbl}>MY STATS</div>
              <div style={{display:"flex",gap:8}}>
                <Stat label="TOTAL DAYS" value={me.stats?.totalDays||0} color={me.color}/>
                <Stat label="BEST WEEK" value={`+${me.stats?.bestWeek||0}`} color="#10b981"/>
                <Stat label="STREAK" value={`${me.streak||0}w`} color={me.streak>=4?"#f59e0b":"#888"}/>
              </div>
            </div>
            <History history={me.stats?.weeklyHistory}/>
            <PointsLog log={me.pointsLog}/>
          </div>
        )}

        {/* Rules */}
        <div style={{...S.card,marginTop:8}}>
          <div style={S.lbl}>RULES</div>
          {["Mon–Fri: +5 pts each · Saturday bonus: +10 pts","Points carry forward every week — never reset weekly","Must complete each 40pt section before starting the next",`Cycle auto-resets after ${cycleDays} days for everyone`,"Tap your days to log your gym visit"].map((r,i)=>(
            <div key={i} style={{fontFamily:"monospace",fontSize:11,color:"#555",marginBottom:5}}>· {r}</div>
          ))}
        </div>

        {/* Reset */}
        <div style={{marginTop:12}}>
          {!showReset
            ?<button onClick={()=>setShowReset(true)} style={{width:"100%",padding:12,borderRadius:12,background:"transparent",border:"1px solid #1a1a1a",color:"#333",fontFamily:"monospace",fontSize:11,cursor:"pointer"}}>Manual Reset (All Players)</button>
            :(
              <div style={{...S.card,border:"1px solid #ef444433",textAlign:"center"}}>
                <div style={{color:"#aaa",fontFamily:"monospace",fontSize:12,marginBottom:12}}>Reset ALL players and start a new cycle?</div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={()=>setShowReset(false)} style={{...S.btn("#333",true),flex:1,width:"auto",color:"#aaa"}}>Cancel</button>
                  <button onClick={handleReset} style={{flex:1,padding:12,borderRadius:12,background:"#ef444420",border:"1px solid #ef444455",color:"#ef4444",fontFamily:"monospace",fontSize:12,cursor:"pointer"}}>Yes, Reset</button>
                </div>
              </div>
            )
          }
        </div>
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────
export default function App(){
  const [screen,setScreen]=useState("loading");
  const [gameCode,setGameCode]=useState(null);
  const [playerId,setPlayerId]=useState(null);

  useEffect(()=>{
    const urlCode=new URLSearchParams(window.location.search).get("code");
    const saved=localStorage.getItem("gymPoints_player");
    if(saved){
      try{
        const{playerId:pid,gameCode:gc}=JSON.parse(saved);
        getDoc(doc(db,"games",gc)).then(snap=>{
          if(snap.exists()&&snap.data().players?.[pid]){setGameCode(gc);setPlayerId(pid);setScreen("game");}
          else{localStorage.removeItem("gymPoints_player");setScreen(urlCode?"join":"welcome");}
        }).catch(()=>setScreen(urlCode?"join":"welcome"));
        return;
      }catch{localStorage.removeItem("gymPoints_player");}
    }
    setScreen(urlCode?"join":"welcome");
  },[]);

  const urlCode=new URLSearchParams(window.location.search).get("code")||"";
  const go=(gc,pid)=>{setGameCode(gc);setPlayerId(pid);setScreen("game");};
  const leave=()=>{localStorage.removeItem("gymPoints_player");setGameCode(null);setPlayerId(null);setScreen("welcome");};

  return(
    <div style={S.app}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@400;500&display=swap');*{-webkit-tap-highlight-color:transparent;box-sizing:border-box}input::placeholder{color:#333}input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}button:active{opacity:.7}::-webkit-scrollbar{width:0}`}</style>
      <div style={S.hdr}>
        <div style={S.ttl}>GYM POINTS 💪</div>
        <div style={{fontSize:9,color:"#333",fontFamily:"monospace",marginTop:3,letterSpacing:3}}>EARN · COLLECT · WIN</div>
      </div>
      <div style={S.wrap}>
        {screen==="loading"&&<div style={{textAlign:"center",paddingTop:80,fontFamily:"monospace",color:"#444"}}>Loading...</div>}
        {screen==="welcome"&&<WelcomeScreen onCreate={()=>setScreen("create")} onJoin={()=>setScreen("join")}/>}
        {screen==="create"&&<CreateScreen onBack={()=>setScreen("welcome")} onCreated={go}/>}
        {screen==="join"&&<JoinScreen onBack={()=>setScreen("welcome")} onJoined={go} prefillCode={urlCode}/>}
        {screen==="game"&&gameCode&&playerId&&<GameScreen gameCode={gameCode} playerId={playerId} onLeave={leave}/>}
      </div>
    </div>
  );
}
