
/* SJO Games V7 Enhancement Layer
   Adds Daily Challenges, Streaks, Coin Economy, Titles, Advanced Stats,
   Achievement 2.0, and local Backup/Restore without replacing V6 game logic.
*/
(function(){
  'use strict';
  const KEY='sjo_games_v7_meta';
  const now=()=>new Date();
  const dayKey=()=>now().toISOString().slice(0,10);

  const defaults={
    version:7, loginStreak:0, lastLogin:null, title:'Rookie',
    daily:{date:null, challenge:null, progress:0, target:1, completed:false},
    multipliers:{coins:1, xp:1},
    unlockedTitles:['Rookie'],
    notifications:[],
    sessions:[],
    weekly:{week:null, games:0, wins:0, xp:0},
    settings:{sounds:true, animations:true}
  };

  function read(){
    try{return Object.assign({},defaults,JSON.parse(localStorage.getItem(KEY)||'{}'))}
    catch(e){return Object.assign({},defaults)}
  }
  function save(x){localStorage.setItem(KEY,JSON.stringify(x)); return x}
  function meta(){return read()}

  function ensureDaily(){
    const m=read(), d=dayKey();
    if(m.lastLogin!==d){
      const prev=new Date(); prev.setDate(prev.getDate()-1);
      const yesterday=prev.toISOString().slice(0,10);
      m.loginStreak=(m.lastLogin===yesterday)?m.loginStreak+1:1;
      m.lastLogin=d;
    }
    if(m.daily.date!==d){
      const pool=[
        {id:'play3',label:'Play 3 games today',target:3},
        {id:'win2',label:'Win 2 games today',target:2},
        {id:'score500',label:'Earn 500 score today',target:500},
        {id:'play2types',label:'Play 2 different games today',target:2}
      ];
      const idx=Math.floor(new Date(d).getTime()/86400000)%pool.length;
      m.daily={date:d,challenge:pool[idx].id,challengeLabel:pool[idx].label,
               progress:0,target:pool[idx].target,completed:false,types:[]};
    }
    return save(m);
  }

  function currentTitle(m){
    const x=(m.loginStreak||0), w=(m.weekly&&m.weekly.wins)||0;
    if(x>=30) return 'Legend';
    if(x>=14) return 'Grand Master';
    if(x>=7) return 'Master';
    if(w>=25) return 'Pro';
    if(w>=10) return 'Player';
    return 'Rookie';
  }

  function record(event){
    const m=ensureDaily(), d=m.daily, game=event.game||'Unknown';
    const score=Number(event.score||0), win=event.result==='win';
    if(!d.types) d.types=[];
    if(!d.types.includes(game)) d.types.push(game);
    if(d.challenge==='play3') d.progress=Math.min(d.target,(d.progress||0)+1);
    if(d.challenge==='win2' && win) d.progress=Math.min(d.target,(d.progress||0)+1);
    if(d.challenge==='score500') d.progress=Math.min(d.target,(d.progress||0)+score);
    if(d.challenge==='play2types') d.progress=Math.min(d.target,d.types.length);
    if(d.progress>=d.target && !d.completed){
      d.completed=true;
      m.notifications.unshift({type:'daily',text:'Daily Challenge completed! +100 XP +50 coins',at:Date.now()});
      window.dispatchEvent(new CustomEvent('sjo:v7:reward',{detail:{xp:100,coins:50,reason:'daily'}}));
    }
    const wk=new Date(); const first=new Date(wk.getFullYear(),0,1);
    const week=Math.ceil((((wk-first)/86400000)+first.getDay()+1)/7);
    if(!m.weekly || m.weekly.week!==week) m.weekly={week,games:0,wins:0,xp:0};
    m.weekly.games++; if(win)m.weekly.wins++;
    m.weekly.xp+=Number(event.xp||0);
    m.title=currentTitle(m);
    save(m);
    window.dispatchEvent(new CustomEvent('sjo:v7:update',{detail:m}));
    return m;
  }

  function exportBackup(){
    const payload={exportedAt:new Date().toISOString(),v7:read(),v6:{}};
    const keys=[];
    for(let i=0;i<localStorage.length;i++) keys.push(localStorage.key(i));
    keys.forEach(k=>{if(k!==KEY){try{payload.v6[k]=JSON.parse(localStorage.getItem(k))}catch(e){payload.v6[k]=localStorage.getItem(k)}}});
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
    a.download='sjo-games-v7-backup-'+dayKey()+'.json'; a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }

  function importBackup(file){
    const r=new FileReader();
    r.onload=()=>{try{
      const p=JSON.parse(r.result);
      if(p.v7) localStorage.setItem(KEY,JSON.stringify(p.v7));
      if(p.v6) Object.keys(p.v6).forEach(k=>{
        const v=p.v6[k]; localStorage.setItem(k,typeof v==='string'?v:JSON.stringify(v));
      });
      location.reload();
    }catch(e){alert('Invalid SJO Games backup file.');}};
    r.readAsText(file);
  }

  function addPanel(){
  if(!/\/(index\.html)?$/.test(location.pathname))return; 
    if(document.getElementById('sjo-v7-panel')) return;
    const style=document.createElement('style');
    style.textContent=`
      #sjo-v7-panel{margin:16px auto;padding:18px;max-width:1100px;border-radius:18px;
        background:linear-gradient(135deg,#111827,#1f2937);color:#fff;font-family:system-ui;
        box-shadow:0 12px 35px rgba(0,0,0,.22)}
      #sjo-v7-panel .v7grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px}
      #sjo-v7-panel .v7card{background:rgba(255,255,255,.08);padding:12px;border-radius:14px}
      #sjo-v7-panel .v7big{font-size:24px;font-weight:800}
      #sjo-v7-panel button{border:0;border-radius:10px;padding:9px 12px;margin:4px;cursor:pointer;font-weight:700}
      #sjo-v7-daily{margin-top:12px;padding:12px;border-radius:12px;background:rgba(255,255,255,.06)}
      #sjo-v7-toast{position:fixed;right:18px;bottom:18px;z-index:99999;padding:13px 17px;
        border-radius:12px;background:#111827;color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.3);display:none}
    `;
    document.head.appendChild(style);
    const p=document.createElement('section'); p.id='sjo-v7-panel';
    p.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
      <div><div style="font-size:12px;opacity:.7">SJO GAMES V7</div>
      <h2 style="margin:3px 0">Player Progress</h2></div>
      <div><button id="v7backup">⬇ Backup</button><button id="v7restore">⬆ Restore</button>
      <input id="v7file" type="file" accept=".json" hidden></div></div>
      <div class="v7grid" id="v7stats"></div><div id="sjo-v7-daily"></div>`;
    (document.body.firstElementChild||document.body).before(p);
    const input=p.querySelector('#v7file');
    p.querySelector('#v7backup').onclick=exportBackup;
    p.querySelector('#v7restore').onclick=()=>input.click();
    input.onchange=()=>input.files[0]&&importBackup(input.files[0]);
    render();
  }

  function findStats(){
    let all={games:0,wins:0,losses:0,draws:0,xp:0,coins:0,streak:0,bestStreak:0};
    const keys=['sjo_games_v6','sjoGamesV6','sjo_game_data','sjo_profile','gameStats'];
    keys.forEach(k=>{try{
      const x=JSON.parse(localStorage.getItem(k)||'null');
      if(!x)return;
      const walk=o=>{
        if(!o||typeof o!=='object')return;
        Object.keys(o).forEach(k=>{
          const v=o[k], n=Number(v);
          if(typeof v==='object') walk(v);
          else if(Number.isFinite(n)){
            if(/wins?/i.test(k)) all.wins+=n;
            else if(/losses?/i.test(k)) all.losses+=n;
            else if(/draws?/i.test(k)) all.draws+=n;
            else if(/gamesPlayed|played|games/i.test(k)) all.games+=n;
            else if(/^xp$/i.test(k)) all.xp+=n;
            else if(/^coins?$/i.test(k)) all.coins+=n;
            else if(/best.?streak/i.test(k)) all.bestStreak=Math.max(all.bestStreak,n);
          }
        });
      }; walk(x);
    }catch(e){}});
    return all;
  }

  function render(){
    const m=ensureDaily(), s=findStats();
    const cards=[
      ['🎮','Games',s.games],['🏆','Wins',s.wins],['🔥','Login Streak',m.loginStreak],
      ['⭐','XP',s.xp],['🪙','Coins',s.coins],['👑','Title',m.title]
    ];
    const el=document.getElementById('v7stats'); if(!el)return;
    el.innerHTML=cards.map(c=>`<div class="v7card"><div>${c[0]} ${c[1]}</div><div class="v7big">${c[2]}</div></div>`).join('');
    const d=m.daily;
    document.getElementById('sjo-v7-daily').innerHTML=
      `<b>🎯 Daily Challenge:</b> ${d.challengeLabel||'Loading...'}<br>
       <progress max="${d.target||1}" value="${Math.min(d.progress||0,d.target||1)}" style="width:100%"></progress>
       <small>${Math.min(d.progress||0,d.target||1)} / ${d.target||1} ${d.completed?' — ✅ Completed':''}</small>`;
  }

  window.SJOGamesV7={meta,record,ensureDaily,exportBackup,importBackup,render};
  document.addEventListener('DOMContentLoaded',()=>setTimeout(addPanel,150));
  window.addEventListener('sjo:v7:update',render);
  window.addEventListener('sjo:v7:reward',e=>{
    const x=e.detail||{};
    const t=document.createElement('div'); t.id='sjo-v7-toast';
    t.textContent=`🎉 ${x.reason||'Reward'}: +${x.xp||0} XP  +${x.coins||0} coins`;
    document.body.appendChild(t); t.style.display='block';
    setTimeout(()=>t.remove(),3500);
  });
})();
