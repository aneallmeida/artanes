import { useState, useRef, useEffect } from 'react'

// ── CONFIG ──────────────────────────────────────────────────────────────────
const SP_CLIENT_ID = 'dd237293e7f943689b4e603238a19ef7'
const SP_REDIRECT   = 'https://artanes.vercel.app/callback'
const SP_SCOPES     = 'user-read-private user-read-email user-library-read user-top-read'

// ── PKCE ────────────────────────────────────────────────────────────────────
async function pkceStart() {
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  const verifier = btoa(String.fromCharCode(...arr)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'')
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  const challenge = btoa(String.fromCharCode(...new Uint8Array(hash))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'')
  return { verifier, challenge }
}

// ── HELPERS ─────────────────────────────────────────────────────────────────
const store = {
  get: k => { try { return JSON.parse(localStorage.getItem(k)) } catch { return null } },
  set: (k,v) => localStorage.setItem(k, JSON.stringify(v)),
  del: k => localStorage.removeItem(k)
}
function fmtTime(s) {
  if (!s || isNaN(s)) return '0:00'
  return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`
}
function guessTrackName(filename) {
  const clean = filename.replace(/\.[^.]+$/, '')
  const parts = clean.split(/\s*[-–]\s*/)
  return parts.length >= 2 ? { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() } : { artist: '', title: clean }
}
async function claude(prompt, maxTokens = 800) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] })
  })
  const d = await r.json()
  return d.content?.map(b => b.text || '').join('') || ''
}
function parseJSON(text) {
  try { return JSON.parse(text.replace(/```json|```/g, '').trim()) } catch { return null }
}

// ── STYLES ──────────────────────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Fira+Code:wght@400;500&family=Lora:ital@1&display=swap');
*{margin:0;padding:0;box-sizing:border-box;}
:root{
  --bg:#09090f; --s1:#0f0f1a; --s2:#141422; --s3:#1a1a2e; --b:#252540; --b2:#333355;
  --lil:#c084fc; --lil2:#ddb6ff; --lil3:#9b5de5; --mix:#a78bfa;
  --teal:#2dd4bf; --teal2:#5eead4; --teal3:#99f6e4;
  --txt:#f0eeff; --mut:#5a5a80; --mut2:#9090b8; --red:#f87171; --green:#4ade80; --gold:#fbbf24;
}
body{background:var(--bg);color:var(--txt);font-family:'Outfit',sans-serif;min-height:100vh;overflow-x:hidden;}
.bg{position:fixed;inset:0;pointer-events:none;z-index:0;}
.bg::before{content:'';position:absolute;width:500px;height:500px;background:radial-gradient(circle,#c084fc0a,transparent 70%);top:-100px;right:-80px;}
.bg::after{content:'';position:absolute;width:400px;height:400px;background:radial-gradient(circle,#2dd4bf07,transparent 70%);bottom:-80px;left:-60px;}
.app{position:relative;z-index:1;}

/* ── HOME ── */
.home{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:40px 20px;text-align:center;}
.home-badge{display:inline-flex;align-items:center;gap:8px;background:linear-gradient(135deg,#c084fc12,#2dd4bf12);border:1px solid #c084fc25;border-radius:50px;padding:7px 18px;font-family:'Fira Code',monospace;font-size:11px;letter-spacing:.15em;color:var(--lil2);margin-bottom:24px;}
.pulse{width:6px;height:6px;border-radius:50%;background:var(--teal);box-shadow:0 0 8px var(--teal);animation:pulse 2s ease-in-out infinite;}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
.home h1{font-size:clamp(52px,10vw,90px);font-weight:800;line-height:.92;letter-spacing:-.04em;margin-bottom:10px;}
.gl{background:linear-gradient(135deg,var(--lil),var(--lil2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.gt{background:linear-gradient(135deg,var(--teal),var(--teal2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.home-sub{font-size:15px;color:var(--mut2);font-family:'Lora',serif;font-style:italic;margin-bottom:44px;max-width:380px;line-height:1.65;}
.home-cards{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;max-width:620px;width:100%;}
.hcard{flex:1;min-width:200px;background:var(--s1);border:1px solid var(--b);border-radius:18px;padding:22px;text-align:left;cursor:pointer;transition:all .2s;}
.hcard:hover{transform:translateY(-3px);}
.hcard.c-lil:hover{border-color:var(--lil);box-shadow:0 8px 32px #c084fc15;}
.hcard.c-teal:hover{border-color:var(--teal);box-shadow:0 8px 32px #2dd4bf15;}
.hcard.c-gold:hover{border-color:var(--gold);box-shadow:0 8px 32px #fbbf2415;}
.hcard-icon{font-size:28px;margin-bottom:12px;}
.hcard-title{font-size:15px;font-weight:700;margin-bottom:5px;}
.hcard-sub{font-size:12px;color:var(--mut2);line-height:1.55;}
.hcard-tag{display:inline-block;margin-top:10px;font-family:'Fira Code',monospace;font-size:9px;letter-spacing:.12em;border-radius:50px;padding:2px 9px;border:1px solid;}
.hcard.c-lil .hcard-tag{color:var(--lil);border-color:#c084fc35;}
.hcard.c-teal .hcard-tag{color:var(--teal);border-color:#2dd4bf35;}
.hcard.c-gold .hcard-tag{color:var(--gold);border-color:#fbbf2435;}

/* ── CALLBACK ── */
.cb{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:14px;padding:24px;text-align:center;}
.spin{width:26px;height:26px;border:2px solid var(--b2);border-top-color:var(--lil);border-radius:50%;animation:spin .6s linear infinite;}
@keyframes spin{to{transform:rotate(360deg)}}
.cb-msg{font-family:'Fira Code',monospace;font-size:13px;color:var(--mut2);max-width:300px;}
.cb-err{color:var(--red);}
.btn-back{background:var(--s2);border:1px solid var(--b);color:var(--txt);border-radius:9px;padding:8px 18px;font-family:'Outfit',sans-serif;font-size:13px;cursor:pointer;margin-top:8px;}

/* ── NAV ── */
.nav{position:fixed;top:0;left:0;right:0;z-index:100;background:rgba(9,9,15,.95);backdrop-filter:blur(14px);border-bottom:1px solid var(--b);padding:10px 16px;display:flex;align-items:center;gap:10px;height:52px;}
.nav-home{display:flex;align-items:center;gap:6px;background:var(--s2);border:1px solid var(--b);color:var(--txt);border-radius:50px;padding:5px 13px;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;white-space:nowrap;}
.nav-home:hover{border-color:var(--lil);color:var(--lil);}
.nav-brand{font-size:17px;font-weight:800;letter-spacing:-.02em;}
.nav-sp{flex:1;}
.nav-tag{font-family:'Fira Code',monospace;font-size:9px;letter-spacing:.1em;padding:3px 9px;border-radius:50px;border:1px solid;}
.nav-tag.lil{color:var(--lil);border-color:#c084fc35;background:#c084fc08;}
.nav-tag.teal{color:var(--teal);border-color:#2dd4bf35;background:#2dd4bf08;}
.nav-tag.gold{color:var(--gold);border-color:#fbbf2435;background:#fbbf2408;}
.pt{padding-top:52px;}

/* ── LAYOUT ── */
.layout{display:grid;grid-template-columns:275px 1fr;min-height:calc(100vh - 52px);}
@media(max-width:720px){.layout{grid-template-columns:1fr;}.sidebar{display:none;}.fab{display:flex!important;}}

/* ── SIDEBAR ── */
.sidebar{background:var(--s1);border-right:1px solid var(--b);display:flex;flex-direction:column;height:calc(100vh - 52px);position:sticky;top:52px;overflow:hidden;}
.sb-top{padding:14px 14px 10px;border-bottom:1px solid var(--b);}
.sb-brand{font-size:17px;font-weight:800;letter-spacing:-.02em;}
.urow{display:flex;align-items:center;gap:8px;margin-top:10px;}
.uav{width:26px;height:26px;border-radius:50%;border:1.5px solid var(--lil);background:var(--s3);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--lil);overflow:hidden;flex-shrink:0;}
.uav img{width:100%;height:100%;object-fit:cover;}
.uname{font-size:11px;color:var(--mut2);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.uout{background:none;border:none;color:var(--mut);font-size:10px;cursor:pointer;font-family:'Fira Code',monospace;}
.uout:hover{color:var(--red);}
.dz{margin:10px 12px;border:2px dashed var(--b2);border-radius:11px;padding:13px 10px;text-align:center;cursor:pointer;transition:all .18s;}
.dz:hover,.dz.drag{border-color:var(--lil);background:#c084fc07;}
.dz-icon{font-size:18px;margin-bottom:3px;}
.dz-t{font-size:12px;font-weight:600;color:var(--lil2);margin-bottom:1px;}
.dz-s{font-size:9px;color:var(--mut);font-family:'Fira Code',monospace;}
.dz-n{display:inline-block;margin-top:5px;background:#c084fc12;border:1px solid #c084fc28;border-radius:50px;padding:2px 8px;font-size:9px;color:var(--lil);font-family:'Fira Code',monospace;}
.sptabs{display:flex;padding:7px 10px 0;gap:3px;border-bottom:1px solid var(--b);}
.stab{flex:1;background:none;border:none;color:var(--mut);font-family:'Fira Code',monospace;font-size:9px;letter-spacing:.09em;text-transform:uppercase;padding:5px 2px;cursor:pointer;border-bottom:2px solid transparent;transition:all .15s;margin-bottom:-1px;}
.stab.on{color:var(--lil);border-bottom-color:var(--lil);}
.sb-srch{padding:7px 12px;border-bottom:1px solid var(--b);}
.sb-srch input{width:100%;background:var(--s3);border:1px solid var(--b);border-radius:8px;padding:6px 10px;color:var(--txt);font-family:'Outfit',sans-serif;font-size:12px;outline:none;transition:border .15s;}
.sb-srch input:focus{border-color:var(--lil);}
.sb-srch input::placeholder{color:var(--mut);}
.tlist{flex:1;overflow-y:auto;padding:3px 0;}
.tlist::-webkit-scrollbar{width:2px;}
.tlist::-webkit-scrollbar-thumb{background:var(--b2);}
.titem{display:flex;align-items:center;gap:8px;padding:7px 12px;cursor:pointer;transition:background .1s;border-left:2px solid transparent;}
.titem:hover{background:var(--s2);}
.titem.on{background:var(--s2);border-left-color:var(--lil);}
.tthumb{width:34px;height:34px;border-radius:7px;background:var(--s3);flex-shrink:0;display:flex;align-items:center;justify-content:center;color:var(--mut);font-size:13px;overflow:hidden;}
.tthumb img{width:100%;height:100%;object-fit:cover;border-radius:7px;}
.ti{flex:1;min-width:0;}
.tn{font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ta{font-size:10px;color:var(--mut2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.tdel{background:none;border:none;color:var(--mut);font-size:14px;cursor:pointer;padding:2px 4px;flex-shrink:0;}
.tdel:hover{color:var(--red);}
.sb-empty{padding:18px 12px;text-align:center;color:var(--mut);font-size:11px;line-height:1.8;}
.sb-load{padding:20px 12px;text-align:center;color:var(--mut);font-size:12px;}
.sp-btn{margin:10px 12px;background:linear-gradient(135deg,var(--teal),var(--teal2));color:#0a0a14;border:none;border-radius:10px;padding:10px;font-family:'Outfit',sans-serif;font-weight:700;font-size:13px;cursor:pointer;width:calc(100% - 24px);transition:opacity .15s;}
.sp-btn:hover{opacity:.85;}

/* ── FAB ── */
.fab{display:none;position:fixed;bottom:22px;right:18px;z-index:90;width:50px;height:50px;border-radius:50%;background:linear-gradient(135deg,var(--lil3),var(--mix));border:none;color:#fff;font-size:20px;cursor:pointer;box-shadow:0 4px 20px #c084fc40;align-items:center;justify-content:center;}

/* ── SHEET ── */
.sheet-bg{position:fixed;inset:0;background:#09090fcc;z-index:95;backdrop-filter:blur(4px);}
.sheet{position:fixed;bottom:0;left:0;right:0;z-index:96;background:var(--s1);border-radius:20px 20px 0 0;border-top:1px solid var(--b);max-height:80vh;overflow-y:auto;padding-bottom:24px;}
.sheet-handle{width:34px;height:4px;background:var(--b2);border-radius:2px;margin:11px auto 7px;}

/* ── CONTENT ── */
.content{overflow-y:auto;padding:22px 26px 60px;}
.empty{display:flex;flex-direction:column;align-items:center;justify-content:center;height:65vh;text-align:center;color:var(--mut);}
.empty-icon{font-size:48px;opacity:.15;margin-bottom:12px;}
.empty-title{font-size:19px;font-weight:700;color:var(--mut2);margin-bottom:5px;}
.empty-sub{font-size:13px;font-family:'Lora',serif;font-style:italic;line-height:1.6;max-width:260px;}
.search-row{display:flex;gap:8px;margin-bottom:14px;background:var(--s2);border:1px solid var(--b);border-radius:13px;padding:6px;}
.search-row input{flex:1;background:none;border:none;outline:none;color:var(--txt);font-family:'Outfit',sans-serif;font-size:13px;padding:2px 6px;}
.search-row input::placeholder{color:var(--mut);}
.sbtn{background:linear-gradient(135deg,var(--lil3),var(--mix));color:#fff;border:none;border-radius:8px;padding:6px 14px;font-family:'Outfit',sans-serif;font-weight:600;font-size:12px;cursor:pointer;}
.sbtn:disabled{opacity:.35;cursor:not-allowed;}

/* ── META EDITOR ── */
.meta{background:linear-gradient(135deg,#c084fc08,#2dd4bf06);border:1px solid var(--b2);border-radius:13px;padding:12px 14px;margin-bottom:12px;}
.meta-head{display:flex;align-items:center;justify-content:space-between;}
.meta-lbl{font-size:10px;font-weight:700;color:var(--lil2);font-family:'Fira Code',monospace;letter-spacing:.1em;text-transform:uppercase;}
.meta-tog{background:none;border:1px solid var(--b2);color:var(--mut);border-radius:6px;padding:3px 9px;font-family:'Fira Code',monospace;font-size:9px;cursor:pointer;}
.meta-tog:hover{border-color:var(--lil);color:var(--lil);}
.meta-fields{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px;}
.mf label{display:block;font-family:'Fira Code',monospace;font-size:8px;letter-spacing:.1em;color:var(--mut);text-transform:uppercase;margin-bottom:3px;}
.mf input{width:100%;background:var(--s3);border:1px solid var(--b);border-radius:7px;padding:6px 9px;color:var(--txt);font-family:'Outfit',sans-serif;font-size:12px;outline:none;}
.mf input:focus{border-color:var(--lil);}
.meta-go{margin-top:9px;background:linear-gradient(135deg,var(--lil3),var(--mix));color:#fff;border:none;border-radius:7px;padding:6px 14px;font-family:'Outfit',sans-serif;font-weight:600;font-size:12px;cursor:pointer;}

/* ── NOW PLAYING ── */
.np{display:flex;align-items:flex-start;gap:16px;margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--b);}
.np-img{width:74px;height:74px;border-radius:12px;flex-shrink:0;box-shadow:0 6px 20px rgba(0,0,0,.5);overflow:hidden;background:linear-gradient(135deg,var(--s3),var(--b));display:flex;align-items:center;justify-content:center;font-size:24px;}
.np-img img{width:100%;height:100%;object-fit:cover;}
.np-chip{display:inline-block;font-family:'Fira Code',monospace;font-size:8px;letter-spacing:.16em;background:linear-gradient(135deg,#c084fc18,#2dd4bf18);border:1px solid #c084fc28;color:var(--lil2);border-radius:50px;padding:2px 8px;margin-bottom:4px;text-transform:uppercase;}
.np-title{font-size:20px;font-weight:800;letter-spacing:-.02em;line-height:1.1;margin-bottom:2px;}
.np-artist{font-size:12px;color:var(--teal2);}
.np-file{font-size:9px;color:var(--mut);margin-top:2px;font-family:'Fira Code',monospace;}

/* ── AUDIO PLAYER ── */
.player{background:linear-gradient(135deg,#c084fc09,#2dd4bf07);border:1px solid #c084fc1a;border-radius:11px;padding:10px 13px;margin-bottom:11px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
.play-btn{width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,var(--lil3),var(--mix));border:none;color:#fff;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.p-time{font-family:'Fira Code',monospace;font-size:9px;color:var(--mut2);white-space:nowrap;}
.p-bar{flex:1;min-width:80px;-webkit-appearance:none;height:3px;border-radius:2px;background:linear-gradient(to right,var(--lil) var(--p,0%),var(--b2) var(--p,0%));outline:none;cursor:pointer;}
.p-bar::-webkit-slider-thumb{-webkit-appearance:none;width:11px;height:11px;border-radius:50%;background:var(--lil2);cursor:pointer;}

/* ── CONTROLS ── */
.cbar{background:linear-gradient(135deg,var(--s2),var(--s1));border:1px solid var(--b);border-radius:13px;padding:10px 14px;margin-bottom:11px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.cbtn{display:flex;align-items:center;gap:5px;border:none;border-radius:8px;padding:6px 12px;font-family:'Outfit',sans-serif;font-weight:600;font-size:12px;cursor:pointer;transition:all .15s;white-space:nowrap;}
.cbtn.pri{background:linear-gradient(135deg,var(--lil3),var(--mix));color:#fff;}
.cbtn.pri:hover{opacity:.85;}
.cbtn.pri.act{background:linear-gradient(135deg,var(--teal),var(--teal2));color:#0a0a14;}
.cbtn.sec{background:var(--s3);border:1px solid var(--b2);color:var(--txt);}
.cbtn.sec:hover{border-color:var(--teal);color:var(--teal);}
.cbtn.ghost{background:none;border:1px solid var(--b);color:var(--mut2);font-family:'Fira Code',monospace;font-size:9px;}
.cbtn.ghost.on{border-color:var(--lil);color:var(--lil);}
.cbtn:disabled{opacity:.3;cursor:not-allowed;}
.spd{display:flex;align-items:center;gap:7px;flex:1;min-width:140px;}
.spd-lbl{font-family:'Fira Code',monospace;font-size:9px;color:var(--mut);white-space:nowrap;}
.spd-val{font-family:'Fira Code',monospace;font-size:14px;font-weight:500;background:linear-gradient(135deg,var(--teal),var(--teal2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;min-width:42px;text-align:right;}
input[type=range].sl{flex:1;-webkit-appearance:none;height:3px;border-radius:2px;background:linear-gradient(to right,var(--teal) var(--p,50%),var(--b2) var(--p,50%));outline:none;}
input[type=range].sl::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:var(--teal2);cursor:pointer;}
.pr-wrap{display:flex;gap:3px;}
.pr{font-family:'Fira Code',monospace;font-size:8px;background:var(--s3);border:1px solid var(--b);color:var(--mut);border-radius:5px;padding:2px 5px;cursor:pointer;}
.pr.on{border-color:var(--teal);color:var(--teal);background:#2dd4bf0d;}

/* ── TIP ── */
.tip-box{background:linear-gradient(135deg,#c084fc08,#2dd4bf07);border:1px solid #c084fc18;border-radius:13px;padding:12px 14px;margin-bottom:12px;}
.tip-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;}
.tip-title{font-size:11px;font-weight:700;display:flex;align-items:center;gap:5px;}
.tip-gr{background:linear-gradient(135deg,var(--lil2),var(--teal2));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.tip-refresh{background:none;border:1px solid var(--b2);color:var(--mut);border-radius:6px;padding:2px 8px;font-family:'Fira Code',monospace;font-size:9px;cursor:pointer;}
.tip-refresh:hover{border-color:var(--teal);color:var(--teal);}
.tip-card{background:var(--s1);border:1px solid var(--b);border-radius:10px;padding:11px 13px;}
.tip-tag{font-family:'Fira Code',monospace;font-size:8px;letter-spacing:.14em;color:var(--teal);text-transform:uppercase;margin-bottom:4px;}
.tip-body{font-size:13px;line-height:1.6;}
.tip-ex{background:var(--s3);border-left:2px solid var(--lil);border-radius:0 7px 7px 0;padding:6px 10px;margin-top:8px;font-size:12px;color:var(--lil2);font-family:'Lora',serif;font-style:italic;}
.tip-loading{display:flex;align-items:center;gap:7px;justify-content:center;padding:10px;color:var(--mut);font-size:12px;}

/* ── LYRICS ── */
.ll-loading{text-align:center;padding:40px 20px;color:var(--mut);}
.ll-err{background:#18080e;border:1px solid #f8717130;color:var(--red);border-radius:10px;padding:10px 13px;font-size:13px;margin-bottom:12px;}
.stanza{margin-bottom:22px;}
.stype{font-family:'Fira Code',monospace;font-size:8px;letter-spacing:.18em;background:linear-gradient(135deg,var(--lil),var(--teal));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;text-transform:uppercase;margin-bottom:8px;}
.lline{margin-bottom:10px;padding:5px 9px;border-radius:8px;cursor:pointer;transition:all .12s;border-left:2px solid transparent;}
.lline:hover{background:var(--s2);border-left-color:var(--b2);}
.lline.spk{background:linear-gradient(135deg,#2dd4bf10,#c084fc07);border-left-color:var(--teal);}
.orig{font-size:15px;font-weight:500;line-height:1.5;}
.phon{font-family:'Fira Code',monospace;font-size:10px;color:var(--teal2);margin-top:2px;letter-spacing:.02em;}
.tran{font-family:'Lora',serif;font-size:12px;color:var(--mut2);margin-top:1px;font-style:italic;}
.legend{display:flex;gap:12px;flex-wrap:wrap;padding-top:14px;border-top:1px solid var(--b);margin-top:8px;}
.leg{display:flex;align-items:center;gap:5px;font-size:10px;color:var(--mut);font-family:'Fira Code',monospace;}
.ldot{width:6px;height:6px;border-radius:2px;}

/* ── PHRASEBOOK ── */
.pb{max-width:660px;margin:0 auto;padding:20px 18px 60px;}
.pb-head{margin-bottom:20px;}
.pb-title{font-size:22px;font-weight:800;letter-spacing:-.02em;margin-bottom:3px;}
.pb-sub{font-size:13px;color:var(--mut2);font-family:'Lora',serif;font-style:italic;}
.pb-form{background:var(--s1);border:1px solid var(--b);border-radius:15px;padding:16px 18px;margin-bottom:20px;}
.pb-flbl{font-family:'Fira Code',monospace;font-size:9px;letter-spacing:.14em;color:var(--lil2);text-transform:uppercase;margin-bottom:10px;}
.pb-ta{width:100%;background:var(--s3);border:1px solid var(--b);border-radius:9px;padding:11px 13px;color:var(--txt);font-family:'Outfit',sans-serif;font-size:15px;outline:none;resize:vertical;min-height:76px;line-height:1.5;transition:border .15s;}
.pb-ta:focus{border-color:var(--lil);}
.pb-ta::placeholder{color:var(--mut);}
.pb-row{display:flex;gap:8px;margin-top:10px;align-items:center;flex-wrap:wrap;}
.pb-sel{background:var(--s3);border:1px solid var(--b);border-radius:8px;padding:6px 10px;color:var(--txt);font-family:'Outfit',sans-serif;font-size:12px;outline:none;cursor:pointer;}
.pb-sel:focus{border-color:var(--lil);}
.pb-save{background:linear-gradient(135deg,var(--lil3),var(--mix));color:#fff;border:none;border-radius:8px;padding:7px 18px;font-family:'Outfit',sans-serif;font-weight:700;font-size:13px;cursor:pointer;transition:opacity .15s;}
.pb-save:hover{opacity:.85;}
.pb-save:disabled{opacity:.35;cursor:not-allowed;}
.pb-saving{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--mut2);}
.pb-spd{display:flex;align-items:center;gap:8px;background:var(--s2);border:1px solid var(--b);border-radius:11px;padding:9px 13px;margin-bottom:13px;}
.pb-srch{background:var(--s2);border:1px solid var(--b);border-radius:11px;padding:6px 12px;display:flex;align-items:center;gap:8px;margin-bottom:14px;}
.pb-srch input{flex:1;background:none;border:none;outline:none;color:var(--txt);font-family:'Outfit',sans-serif;font-size:13px;}
.pb-srch input::placeholder{color:var(--mut);}
.pb-list{display:flex;flex-direction:column;gap:10px;}
.pb-card{background:var(--s1);border:1px solid var(--b);border-radius:13px;padding:14px 16px;transition:border-color .15s;}
.pb-card:hover{border-color:var(--b2);}
.pb-ctop{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:8px;}
.pb-orig{font-size:16px;font-weight:600;line-height:1.4;flex:1;}
.pb-actions{display:flex;gap:5px;flex-shrink:0;}
.pb-play{background:linear-gradient(135deg,var(--lil3),var(--mix));color:#fff;border:none;border-radius:7px;width:30px;height:30px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:13px;transition:opacity .15s;}
.pb-play:hover{opacity:.85;}
.pb-play.playing{background:linear-gradient(135deg,var(--teal),var(--teal2));color:#0a0a14;}
.pb-del{background:none;border:1px solid var(--b);color:var(--mut);border-radius:7px;width:30px;height:30px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:13px;transition:all .15s;}
.pb-del:hover{border-color:var(--red);color:var(--red);}
.pb-phon{font-family:'Fira Code',monospace;font-size:10px;color:var(--teal2);margin-bottom:4px;letter-spacing:.02em;}
.pb-tr{font-family:'Lora',serif;font-size:12px;color:var(--mut2);font-style:italic;}
.pb-meta{display:flex;align-items:center;gap:7px;margin-top:9px;padding-top:8px;border-top:1px solid var(--b);}
.pb-ltag{font-family:'Fira Code',monospace;font-size:8px;letter-spacing:.1em;color:var(--lil);border:1px solid #c084fc28;border-radius:50px;padding:2px 7px;background:#c084fc07;}
.pb-date{font-family:'Fira Code',monospace;font-size:8px;color:var(--mut);margin-left:auto;}
.pb-empty{text-align:center;padding:40px 20px;color:var(--mut);}
.pb-empty-icon{font-size:36px;opacity:.2;margin-bottom:10px;}
`

// ── CALLBACK PAGE ────────────────────────────────────────────────────────────
function CallbackPage() {
  const [msg, setMsg] = useState('Conectando ao Spotify…')
  const [err, setErr] = useState(null)

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const code = p.get('code')
    const error = p.get('error')
    const verifier = p.get('state')

    if (error) { setErr('Spotify negou: ' + error); return }
    if (!code) { setErr('Código não recebido.'); return }
    if (!verifier) { setErr('Sessão inválida. Tente novamente.'); return }

    setMsg('Autenticando…')
    // PKCE: token exchange MUST be done client-side (no client_secret needed)
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: SP_REDIRECT,
      client_id: SP_CLIENT_ID,
      code_verifier: verifier
    })
    fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    })
      .then(r => r.json())
      .then(d => {
        if (d.access_token) {
          store.set('sp_token', d.access_token)
          window.location.href = '/'
        } else {
          setErr('Erro Spotify: ' + (d.error_description || d.error || JSON.stringify(d)))
        }
      })
      .catch(e => setErr('Erro de rede: ' + e.message))
  }, [])

  return (
    <>
      <style>{CSS}</style>
      <div className="bg"/>
      <div className="cb">
        {!err && <div className="spin"/>}
        <div className={`cb-msg${err ? ' cb-err' : ''}`}>{err ? '❌ ' + err : msg}</div>
        {err && <button className="btn-back" onClick={() => window.location.href = '/'}>Voltar ao início</button>}
      </div>
    </>
  )
}

// ── HOME SCREEN ──────────────────────────────────────────────────────────────
function HomeScreen({ onSelect }) {
  const hasToken = !!store.get('sp_token')
  const phraseCount = (() => { try { return (store.get('phrases') || []).length } catch { return 0 } })()
  return (
    <div className="home">
      <div className="home-badge"><span className="pulse"/>✦ artanes studio</div>
      <h1><span className="gl">Art</span><span className="gt">anes</span></h1>
      <p className="home-sub">Letra, pronúncia fonética, tradução e dicas de inglês para suas músicas.</p>
      <div className="home-cards">
        <div className="hcard c-lil" onClick={() => onSelect('local')}>
          <div className="hcard-icon">🎵</div>
          <div className="hcard-title">Minhas Músicas</div>
          <div className="hcard-sub">Importe MP3, M4A, FLAC ou busque pelo nome da música.</div>
          <div className="hcard-tag">importar arquivos</div>
        </div>
        <div className="hcard c-teal" onClick={() => onSelect('spotify')}>
          <div className="hcard-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="#2dd4bf"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
          </div>
          <div className="hcard-title">Spotify</div>
          <div className="hcard-sub">Conecte sua conta e acesse músicas salvas e top.</div>
          <div className="hcard-tag">{hasToken ? '✓ conectado' : 'conectar conta'}</div>
        </div>
        <div className="hcard c-gold" style={{flexBasis:'100%'}} onClick={() => onSelect('phrasebook')}>
          <div className="hcard-icon">📒</div>
          <div className="hcard-title">Caderno de Frases</div>
          <div className="hcard-sub">Digite frases em inglês ou outro idioma. Salve com pronúncia fonética e tradução para revisar e ouvir quando quiser.</div>
          <div className="hcard-tag">{phraseCount} frase{phraseCount !== 1 ? 's' : ''} salva{phraseCount !== 1 ? 's' : ''}</div>
        </div>
      </div>
    </div>
  )
}

// ── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  if (window.location.pathname === '/callback') return <CallbackPage/>

  const hasToken = !!store.get('sp_token')
  const [screen, setScreen] = useState(hasToken ? 'app' : 'home')
  const [mode, setMode] = useState(hasToken ? 'spotify' : 'local')

  function go(m) {
    setMode(m)
    setScreen(m === 'phrasebook' ? 'phrasebook' : 'app')
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="bg"/>
      <div className="app">
        {screen === 'home' && <HomeScreen onSelect={go}/>}
        {screen === 'app' && <MusicScreen mode={mode} onHome={() => { setScreen('home'); setMode('local') }}/>}
        {screen === 'phrasebook' && <PhrasebookScreen onHome={() => setScreen('home')}/>}
      </div>
    </>
  )
}

// ── MUSIC SCREEN ─────────────────────────────────────────────────────────────
function MusicScreen({ mode, onHome }) {
  const [spToken] = useState(() => store.get('sp_token'))
  const [spUser, setSpUser] = useState(null)
  const [spTracks, setSpTracks] = useState([])
  const [spTab, setSpTab] = useState('saved')
  const [spLoading, setSpLoading] = useState(false)
  const [localTracks, setLocalTracks] = useState([])
  const [dragging, setDragging] = useState(false)
  const [search, setSearch] = useState('')
  const [filtered, setFiltered] = useState([])
  const [selected, setSelected] = useState(null)
  const [showMeta, setShowMeta] = useState(false)
  const [metaTitle, setMetaTitle] = useState('')
  const [metaArtist, setMetaArtist] = useState('')
  const [lyrics, setLyrics] = useState(null)
  const [lyricsLoading, setLyricsLoading] = useState(false)
  const [lyricsErr, setLyricsErr] = useState('')
  const [tip, setTip] = useState(null)
  const [tipLoading, setTipLoading] = useState(false)
  const [speed, setSpeed] = useState(1.0)
  const [speaking, setSpeaking] = useState(false)
  const [activeLine, setActiveLine] = useState(null)
  const [showTr, setShowTr] = useState(true)
  const [query, setQuery] = useState('')
  const [audioUrl, setAudioUrl] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [showSheet, setShowSheet] = useState(false)
  const synthRef = useRef(null)
  const linesRef = useRef([])
  const audioRef = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => { synthRef.current = window.speechSynthesis; return () => synthRef.current?.cancel() }, [])

  // Spotify user
  useEffect(() => {
    if (!spToken || mode !== 'spotify') return
    fetch('https://api.spotify.com/v1/me', { headers: { Authorization: `Bearer ${spToken}` } })
      .then(r => r.json()).then(d => { if (d.id) setSpUser(d) })
  }, [spToken, mode])

  // Spotify tracks
  useEffect(() => {
    if (!spToken || mode !== 'spotify') return
    setSpLoading(true)
    const ep = {
      saved: 'https://api.spotify.com/v1/me/tracks?limit=50',
      top:   'https://api.spotify.com/v1/me/top/tracks?limit=50'
    }
    fetch(ep[spTab] || ep.saved, { headers: { Authorization: `Bearer ${spToken}` } })
      .then(r => r.json())
      .then(d => {
        const items = spTab === 'saved' ? (d.items||[]).map(i=>i.track) : (d.items||[])
        setSpTracks(items.filter(Boolean))
      })
      .catch(()=>{})
      .finally(()=>setSpLoading(false))
  }, [spToken, spTab, mode])

  const tracks = mode === 'spotify' ? spTracks : localTracks

  useEffect(() => {
    if (!search.trim()) { setFiltered(tracks); return }
    const q = search.toLowerCase()
    setFiltered(tracks.filter(t => {
      const title = t.name || t.title || ''
      const artist = t.artists?.[0]?.name || t.artist || ''
      return title.toLowerCase().includes(q) || artist.toLowerCase().includes(q)
    }))
  }, [search, tracks])

  useEffect(() => {
    const a = audioRef.current; if (!a) return
    const onTime = () => { setCurrentTime(a.currentTime); setProgress(a.duration ? (a.currentTime/a.duration)*100 : 0) }
    const onLoad = () => setDuration(a.duration)
    const onEnd  = () => setPlaying(false)
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('loadedmetadata', onLoad)
    a.addEventListener('ended', onEnd)
    return () => { a.removeEventListener('timeupdate',onTime); a.removeEventListener('loadedmetadata',onLoad); a.removeEventListener('ended',onEnd) }
  }, [audioUrl])

  async function loginSpotify() {
    const { verifier, challenge } = await pkceStart()
    // Build URL manually — avoids URLSearchParams double-encoding scopes
    const url = 'https://accounts.spotify.com/authorize'
      + '?client_id=' + SP_CLIENT_ID
      + '&response_type=code'
      + '&redirect_uri=' + encodeURIComponent(SP_REDIRECT)
      + '&scope=' + encodeURIComponent(SP_SCOPES)
      + '&code_challenge_method=S256'
      + '&code_challenge=' + challenge
      + '&state=' + verifier
    window.location.href = url
  }

  function logoutSpotify() {
    store.del('sp_token')
    window.location.href = '/'
  }

  function addFiles(files) {
    const arr = Array.from(files).filter(f => f.type.startsWith('audio/') || f.name.match(/\.(mp3|m4a|ogg|flac|wav|aac)$/i))
    setLocalTracks(prev => [...prev, ...arr.map(f => { const {artist,title} = guessTrackName(f.name); return {id:Date.now()+Math.random(),file:f,title,artist} })])
  }

  function removeTrack(id, e) {
    e.stopPropagation()
    setLocalTracks(prev => prev.filter(t => t.id !== id))
    if (selected?.id === id) { setSelected(null); setLyrics(null) }
  }

  function pickTrack(t) {
    synthRef.current?.cancel(); setSpeaking(false); setActiveLine(null)
    setSelected(t); setShowMeta(false); setShowSheet(false)
    const title = t.name || t.title || ''
    const artist = t.artists?.[0]?.name || t.artist || ''
    setMetaTitle(title); setMetaArtist(artist)
    if (t.file) {
      if (audioUrl) URL.revokeObjectURL(audioUrl)
      const url = URL.createObjectURL(t.file)
      setAudioUrl(url)
      if (audioRef.current) { audioRef.current.src = url; audioRef.current.load() }
    } else setAudioUrl(null)
    setPlaying(false); setProgress(0); setCurrentTime(0)
    loadLyrics(title, artist)
  }

  function applyMeta() { loadLyrics(metaTitle, metaArtist); setShowMeta(false) }

  async function loadLyrics(title, artist) {
    setLyrics(null); setLyricsErr(''); setLyricsLoading(true); setTip(null)
    try {
      const txt = await claude(`Provide complete lyrics for "${title}"${artist?` by "${artist}"`:''}.
Return ONLY valid JSON (no markdown):
{"title":"...","artist":"...","language":"English","lyrics":[{"type":"verse","lines":[{"text":"lyric","phonetic":"fo-NET-ik syllabic","translation":"portuguese translation"}]}]}
Rules: real lyrics, min 2 verses+chorus. phonetic=simple syllabic NOT IPA. translation=English to Portuguese.`)
      const parsed = parseJSON(txt)
      if (!parsed) throw new Error('Não foi possível carregar a letra.')
      linesRef.current = parsed.lyrics?.flatMap(s=>s.lines) || []
      setLyrics(parsed)
      loadTip(parsed.title, parsed.artist, parsed.language)
    } catch(e) { setLyricsErr(e.message) }
    finally { setLyricsLoading(false) }
  }

  async function loadTip(title, artist, lang) {
    setTip(null); setTipLoading(true)
    try {
      const txt = await claude(`Song: "${title}" by ${artist||'?'} (${lang||'English'}). Give ONE English learning tip. ONLY JSON: {"tag":"Pronunciation|Slang|Phrasal Verbs|Idioms|Culture|Grammar","tip":"Explanation in Portuguese 2-3 sentences","example":"Example line"}`, 300)
      const parsed = parseJSON(txt)
      if (parsed) setTip(parsed)
    } catch {}
    finally { setTipLoading(false) }
  }

  function readAloud() {
    if (!lyrics||!synthRef.current) return
    if (speaking) { synthRef.current.cancel(); setSpeaking(false); setActiveLine(null); return }
    const lines = linesRef.current; let i = 0
    const next = () => {
      if (i >= lines.length) { setSpeaking(false); setActiveLine(null); return }
      setActiveLine(i)
      const u = new SpeechSynthesisUtterance(lines[i].text)
      u.rate = speed; u.lang = lyrics.language?.toLowerCase().includes('port') ? 'pt-BR' : 'en-US'
      u.onend = ()=>{i++;next()}; u.onerror=()=>{i++;next()}
      synthRef.current.speak(u)
    }
    setSpeaking(true); next()
  }

  function speakLine(text, idx) {
    if (!synthRef.current) return
    synthRef.current.cancel(); setActiveLine(idx)
    const u = new SpeechSynthesisUtterance(text)
    u.rate = speed; u.lang = lyrics?.language?.toLowerCase().includes('port') ? 'pt-BR' : 'en-US'
    u.onend = ()=>setActiveLine(null)
    synthRef.current.speak(u)
  }

  function toggleAudio() {
    const a = audioRef.current; if (!a) return
    if (playing) { a.pause(); setPlaying(false) } else { a.play(); setPlaying(true) }
  }
  function seekAudio(e) {
    const a = audioRef.current; if (!a||!a.duration) return
    const pct = parseFloat(e.target.value); a.currentTime=(pct/100)*a.duration; setProgress(pct)
  }

  function downloadTxt() {
    if (!lyrics) return
    const lines = [`ARTANES — ${lyrics.title} — ${lyrics.artist}`,`Vel: ${speed}x`,'',
      ...lyrics.lyrics.flatMap(s=>[`[${s.type?.toUpperCase()}]`,...s.lines.flatMap(l=>[l.text,`  ↳ ${l.phonetic}`,showTr?`  ↳ ${l.translation}`:'','']),'']),
    ].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([lines],{type:'text/plain;charset=utf-8'}))
    a.download = `${lyrics.title} - pronuncia.txt`.replace(/[/\\?%*:|"<>]/g,'-')
    a.click()
  }

  function handleSearch(e) {
    e.preventDefault(); if (!query.trim()) return
    const parts = query.split(/\s*-\s*/); const artist = parts.length>=2?parts[0].trim():''; const title = parts.length>=2?parts.slice(1).join('-').trim():query.trim()
    const fake = {id:'q-'+Date.now(),title,artist}
    setSelected(fake); setMetaTitle(title); setMetaArtist(artist); setAudioUrl(null); setPlaying(false); setShowMeta(false)
    loadLyrics(title, artist); setQuery('')
  }

  const selTitle = selected?.name || selected?.title || ''
  const selArtist = selected?.artists?.map(a=>a.name).join(', ') || selected?.artist || ''
  const selThumb = selected?.album?.images?.[1]?.url || null
  let gIdx = 0

  const SidebarContent = () => (
    <>
      {mode==='spotify' && !spToken && (
        <div style={{padding:'10px 12px'}}><button className="sp-btn" onClick={loginSpotify}>Entrar com Spotify →</button></div>
      )}
      {mode==='spotify' && spToken && spUser && (
        <div className="urow">
          <div className="uav">{spUser.images?.[0]?.url?<img src={spUser.images[0].url} alt=""/>:spUser.display_name?.[0]||'?'}</div>
          <span className="uname">{spUser.display_name}</span>
          <button className="uout" onClick={logoutSpotify}>sair</button>
        </div>
      )}
      {mode==='local' && (
        <div className={`dz${dragging?' drag':''}`}
          onDragOver={e=>{e.preventDefault();setDragging(true)}}
          onDragLeave={()=>setDragging(false)}
          onDrop={e=>{e.preventDefault();setDragging(false);addFiles(e.dataTransfer.files)}}
          onClick={()=>fileRef.current?.click()}>
          <input ref={fileRef} type="file" accept="audio/*,.mp3,.m4a,.ogg,.flac,.wav,.aac" multiple style={{display:'none'}} onChange={e=>addFiles(e.target.files)}/>
          <div className="dz-icon">🎵</div>
          <div className="dz-t">Importar músicas</div>
          <div className="dz-s">toque ou arraste · MP3 M4A WAV FLAC</div>
          {localTracks.length>0&&<div className="dz-n">{localTracks.length} música{localTracks.length!==1?'s':''}</div>}
        </div>
      )}
      {mode==='spotify'&&spToken&&(
        <div className="sptabs">
          {[['saved','Salvas'],['top','Top']].map(([k,l])=>(
            <button key={k} className={`stab${spTab===k?' on':''}`} onClick={()=>setSpTab(k)}>{l}</button>
          ))}
        </div>
      )}
      <div className="sb-srch"><input placeholder="Filtrar…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
      <div className="tlist">
        {spLoading&&<div className="sb-load"><div className="spin" style={{borderTopColor:'var(--teal)',margin:'0 auto 7px'}}/><p>Carregando…</p></div>}
        {!spLoading&&filtered.length===0&&<div className="sb-empty">{mode==='local'?'Importe arquivos ☝️':'Nenhuma música'}</div>}
        {filtered.map((t,i)=>{
          const tn=t.name||t.title||'Sem título'; const ta=t.artists?.[0]?.name||t.artist||''; const tt=t.album?.images?.[2]?.url||null
          return (
            <div key={t.id+i} className={`titem${selected?.id===t.id?' on':''}`} onClick={()=>pickTrack(t)}>
              <div className="tthumb">{tt?<img src={tt} alt=""/>:'🎵'}</div>
              <div className="ti"><div className="tn">{tn}</div><div className="ta">{ta}</div></div>
              {mode==='local'&&<button className="tdel" onClick={e=>removeTrack(t.id,e)}>×</button>}
            </div>
          )
        })}
      </div>
    </>
  )

  return (
    <>
      <audio ref={audioRef} style={{display:'none'}}/>
      <div className="nav">
        <button className="nav-home" onClick={onHome}>← Início</button>
        <div className="nav-sp"/>
        <div className="nav-brand"><span className="gl">Art</span><span className="gt">anes</span></div>
        <div className="nav-sp"/>
        <span className={`nav-tag ${mode==='spotify'?'teal':'lil'}`}>{mode==='spotify'?'spotify':'local'}</span>
      </div>
      <div className="pt">
        <div className="layout">
          <div className="sidebar"><div className="sb-top"><div className="sb-brand"><span className="gl">Art</span><span className="gt">anes</span></div></div><SidebarContent/></div>
          <button className="fab" onClick={()=>setShowSheet(true)}>♪</button>
          {showSheet&&<><div className="sheet-bg" onClick={()=>setShowSheet(false)}/><div className="sheet"><div className="sheet-handle"/><SidebarContent/></div></>}
          <div className="content">
            {!selected ? (
              <div className="empty">
                <div className="empty-icon">♬</div>
                <div className="empty-title">{mode==='local'?'Importe ou busque':'Selecione uma música'}</div>
                <div className="empty-sub">{mode==='local'?'Arraste arquivos ou busque pelo nome abaixo':'Escolha uma faixa ao lado'}</div>
                <form onSubmit={handleSearch} style={{display:'flex',gap:8,marginTop:18,width:'100%',maxWidth:380}}>
                  <input style={{flex:1,background:'var(--s3)',border:'1px solid var(--b)',borderRadius:9,padding:'8px 12px',color:'var(--txt)',fontFamily:"'Outfit',sans-serif",fontSize:13,outline:'none'}} placeholder="Ex: Coldplay - Yellow" value={query} onChange={e=>setQuery(e.target.value)}/>
                  <button className="sbtn" type="submit" disabled={!query.trim()}>→</button>
                </form>
              </div>
            ) : (
              <>
                <form className="search-row" onSubmit={handleSearch}>
                  <input placeholder="Buscar outra música…" value={query} onChange={e=>setQuery(e.target.value)}/>
                  <button className="sbtn" type="submit" disabled={!query.trim()}>Buscar</button>
                </form>
                <div className="np">
                  <div className="np-img">{selThumb?<img src={selThumb} alt=""/>:'🎵'}</div>
                  <div><div className="np-chip">agora visualizando</div><div className="np-title">{selTitle}</div><div className="np-artist">{selArtist||'Artista desconhecido'}</div>{selected.file&&<div className="np-file">{selected.file.name}</div>}</div>
                </div>
                <div className="meta">
                  <div className="meta-head"><div className="meta-lbl">✏ editar título / artista</div><button className="meta-tog" onClick={()=>setShowMeta(v=>!v)}>{showMeta?'fechar':'editar'}</button></div>
                  {showMeta&&<><div className="meta-fields"><div className="mf"><label>Título</label><input value={metaTitle} onChange={e=>setMetaTitle(e.target.value)}/></div><div className="mf"><label>Artista</label><input value={metaArtist} onChange={e=>setMetaArtist(e.target.value)}/></div></div><button className="meta-go" onClick={applyMeta}>Buscar letra →</button></>}
                </div>
                {audioUrl&&(
                  <div className="player">
                    <button className="play-btn" onClick={toggleAudio}>{playing?'⏸':'▶'}</button>
                    <span className="p-time">{fmtTime(currentTime)}</span>
                    <input type="range" className="p-bar" min={0} max={100} step={0.1} value={progress} style={{'--p':`${progress}%`}} onChange={seekAudio}/>
                    <span className="p-time">{fmtTime(duration)}</span>
                  </div>
                )}
                <div className="cbar">
                  <button className={`cbtn pri${speaking?' act':''}`} onClick={readAloud} disabled={!lyrics}>{speaking?'⏹ Parar':'▶ Ler em voz alta'}</button>
                  <button className="cbtn sec" onClick={downloadTxt} disabled={!lyrics}>⬇ Baixar .txt</button>
                  <button className={`cbtn ghost${showTr?' on':''}`} onClick={()=>setShowTr(v=>!v)}>{showTr?'ocultar trad.':'ver tradução'}</button>
                  <div className="spd">
                    <span className="spd-lbl">vel.</span>
                    <input type="range" className="sl" min={0.5} max={2} step={0.05} value={speed} style={{'--p':`${((speed-.5)/1.5)*100}%`}} onChange={e=>setSpeed(parseFloat(e.target.value))}/>
                    <span className="spd-val">{speed.toFixed(2)}×</span>
                    <div className="pr-wrap">{[0.5,0.75,1,1.25,1.5].map(v=><button key={v} className={`pr${speed===v?' on':''}`} onClick={()=>setSpeed(v)}>{v}×</button>)}</div>
                  </div>
                </div>
                {(tipLoading||tip)&&(
                  <div className="tip-box">
                    <div className="tip-head"><div className="tip-title"><span>💡</span><span className="tip-gr">Dica de Inglês</span></div>{tip&&<button className="tip-refresh" disabled={tipLoading} onClick={()=>loadTip(lyrics?.title,lyrics?.artist,lyrics?.language)}>{tipLoading?'…':'↻'}</button>}</div>
                    {tipLoading&&!tip&&<div className="tip-loading"><div className="spin" style={{borderTopColor:'var(--teal)'}}/> gerando…</div>}
                    {tip&&<div className="tip-card"><div className="tip-tag">{tip.tag}</div><div className="tip-body">{tip.tip}</div>{tip.example&&<div className="tip-ex">"{tip.example}"</div>}</div>}
                  </div>
                )}
                {lyricsLoading&&<div className="ll-loading"><div className="spin"/><p style={{marginTop:8}}>Carregando letra…</p></div>}
                {lyricsErr&&<div className="ll-err">⚠ {lyricsErr}</div>}
                {lyrics&&!lyricsLoading&&(
                  <>
                    {lyrics.lyrics?.map((stanza,si)=>(
                      <div className="stanza" key={si}>
                        <div className="stype">{stanza.type}</div>
                        {stanza.lines?.map((line,li)=>{ const idx=gIdx++; return (
                          <div key={li} className={`lline${activeLine===idx?' spk':''}`} onClick={()=>speakLine(line.text,idx)}>
                            <div className="orig">{line.text}</div>
                            <div className="phon">{line.phonetic}</div>
                            {showTr&&<div className="tran">{line.translation}</div>}
                          </div>
                        )})}
                      </div>
                    ))}
                    <div className="legend">
                      <div className="leg"><div className="ldot" style={{background:'var(--txt)'}}/> Letra</div>
                      <div className="leg"><div className="ldot" style={{background:'var(--teal2)'}}/> Fonética</div>
                      <div className="leg"><div className="ldot" style={{background:'var(--mut2)'}}/> Tradução</div>
                      <div className="leg" style={{marginLeft:'auto',opacity:.4}}>Toque para ouvir</div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ── PHRASEBOOK SCREEN ─────────────────────────────────────────────────────────
function PhrasebookScreen({ onHome }) {
  const [phrases, setPhrases] = useState(() => store.get('phrases') || [])
  const [input, setInput] = useState('')
  const [lang, setLang] = useState('Inglês')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [speed, setSpeed] = useState(1.0)
  const [playingId, setPlayingId] = useState(null)
  const synthRef = useRef(null)

  useEffect(() => { synthRef.current = window.speechSynthesis; return () => synthRef.current?.cancel() }, [])

  function save(newPhrases) { setPhrases(newPhrases); store.set('phrases', newPhrases) }

  async function addPhrase() {
    if (!input.trim()) return
    setSaving(true)
    try {
      const txt = await claude(`Analyze: "${input.trim()}" (language: ${lang}).
Return ONLY valid JSON: {"original":"${input.trim()}","language":"${lang}","phonetic":"SIL-AB-ik fo-NET-ik","translation":"Portuguese translation or meaning","langCode":"en-US"}
langCode options: en-US pt-BR es-ES fr-FR de-DE it-IT ja-JP. ONLY JSON.`, 250)
      const p = parseJSON(txt)
      if (!p) throw new Error('Erro ao processar.')
      const newPhrase = { id: Date.now().toString(), original: p.original || input.trim(), phonetic: p.phonetic || '', translation: p.translation || '', language: p.language || lang, langCode: p.langCode || 'en-US', date: new Date().toLocaleDateString('pt-BR') }
      save([newPhrase, ...phrases])
      setInput('')
    } catch(e) { alert(e.message) }
    finally { setSaving(false) }
  }

  function speak(phrase) {
    if (!synthRef.current) return
    if (playingId === phrase.id) { synthRef.current.cancel(); setPlayingId(null); return }
    synthRef.current.cancel(); setPlayingId(phrase.id)
    const u = new SpeechSynthesisUtterance(phrase.original)
    u.rate = speed; u.lang = phrase.langCode || 'en-US'
    u.onend = ()=>setPlayingId(null); u.onerror = ()=>setPlayingId(null)
    synthRef.current.speak(u)
  }

  function del(id) { save(phrases.filter(p => p.id !== id)) }

  const filtered = search.trim() ? phrases.filter(p => p.original.toLowerCase().includes(search.toLowerCase()) || p.translation.toLowerCase().includes(search.toLowerCase())) : phrases

  return (
    <>
      <div className="nav">
        <button className="nav-home" onClick={onHome}>← Início</button>
        <div className="nav-sp"/>
        <div className="nav-brand"><span className="gl">Art</span><span className="gt">anes</span></div>
        <div className="nav-sp"/>
        <span className="nav-tag gold">caderno</span>
      </div>
      <div className="pt">
        <div className="pb">
          <div className="pb-head">
            <div className="pb-title">📒 Caderno de Frases</div>
            <div className="pb-sub">Salve frases com pronúncia e tradução para revisar quando quiser</div>
          </div>
          <div className="pb-form">
            <div className="pb-flbl">✦ nova frase</div>
            <textarea className="pb-ta" placeholder="Digite uma frase, palavra ou expressão…" value={input} onChange={e=>setInput(e.target.value)}/>
            <div className="pb-row">
              <select className="pb-sel" value={lang} onChange={e=>setLang(e.target.value)}>
                {['Inglês','Espanhol','Francês','Italiano','Alemão','Japonês','Português','Outro'].map(l=><option key={l}>{l}</option>)}
              </select>
              <button className="pb-save" onClick={addPhrase} disabled={saving||!input.trim()}>{saving?'⏳ Salvando…':'+ Salvar'}</button>
              {saving&&<div className="pb-saving"><div className="spin" style={{borderTopColor:'var(--teal)',width:14,height:14,borderWidth:2}}/> gerando pronúncia…</div>}
            </div>
          </div>

          {phrases.length > 0 && (
            <>
              <div className="pb-spd">
                <span style={{fontFamily:"'Fira Code',monospace",fontSize:9,color:'var(--mut)'}}>velocidade</span>
                <input type="range" className="sl" min={0.5} max={2} step={0.05} value={speed} style={{'--p':`${((speed-.5)/1.5)*100}%`,flex:1}} onChange={e=>setSpeed(parseFloat(e.target.value))}/>
                <span style={{fontFamily:"'Fira Code',monospace",fontSize:13,color:'var(--teal2)',minWidth:42,textAlign:'right'}}>{speed.toFixed(2)}×</span>
                <div className="pr-wrap">{[0.5,0.75,1,1.25,1.5].map(v=><button key={v} className={`pr${speed===v?' on':''}`} onClick={()=>setSpeed(v)}>{v}×</button>)}</div>
              </div>
              <div className="pb-srch">
                <span style={{color:'var(--mut)',fontSize:13}}>🔍</span>
                <input placeholder="Buscar frases…" value={search} onChange={e=>setSearch(e.target.value)}/>
                {search&&<button onClick={()=>setSearch('')} style={{background:'none',border:'none',color:'var(--mut)',cursor:'pointer'}}>×</button>}
              </div>
            </>
          )}

          {filtered.length === 0 ? (
            <div className="pb-empty">
              <div className="pb-empty-icon">📝</div>
              <p style={{color:'var(--mut2)',fontSize:13}}>{phrases.length===0?'Nenhuma frase ainda. Digite algo acima!':'Nenhuma frase encontrada.'}</p>
            </div>
          ) : (
            <div className="pb-list">
              {filtered.map(p => (
                <div key={p.id} className="pb-card">
                  <div className="pb-ctop">
                    <div className="pb-orig">{p.original}</div>
                    <div className="pb-actions">
                      <button className={`pb-play${playingId===p.id?' playing':''}`} onClick={()=>speak(p)} title="Ouvir">{playingId===p.id?'⏹':'▶'}</button>
                      <button className="pb-del" onClick={()=>del(p.id)} title="Excluir">🗑</button>
                    </div>
                  </div>
                  <div className="pb-phon">{p.phonetic}</div>
                  <div className="pb-tr">{p.translation}</div>
                  <div className="pb-meta">
                    <span className="pb-ltag">{p.language}</span>
                    <span className="pb-date">{p.date}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
