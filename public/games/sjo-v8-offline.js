
/* SJO Games V8 - Offline Expansion
   No database, no server, no network dependency.
*/
(function(){
'use strict';

const KEY='sjo_games_v8';
const PROFILE_KEY='sjo_games_v8_profiles';

const defaults={
  version:8, activeProfile:'player-1',
  profiles:[{
    id:'player-1',name:'Player 1',avatar:'🎮',frame:'default',theme:'midnight',
    xp:0,coins:100,level:1,totalGames:0,wins:0,losses:0,draws:0,
    streak:0,bestStreak:0,titles:['Rookie'],achievements:[],
    unlocked:[],createdAt:Date.now(),lastPlayed:null,
    daily:{date:null,progress:{},claimed:false},
    weekly:{week:null,games:0,wins:0},
    stats:{}
  }],
  store:{
    owned:['theme-midnight','avatar-gamepad','frame-default'],
    equipped:{theme:'midnight',avatar:'🎮',frame:'default'}
  }
};

function load(){
  try{
    const x=JSON.parse(localStorage.getItem(KEY)||'null');
    return x&&x.version===8?x:defaults;
  }catch(e){return defaults}
}
function save(x){localStorage.setItem(KEY,JSON.stringify(x));return x}
function profile(){
  const x=load();
  let p=x.profiles.find(a=>a.id===x.activeProfile);
  if(!p){p=x.profiles[0];x.activeProfile=p.id;save(x)}
  return p;
}
function update(fn){
  const x=load(),p=profile();fn(p,x);save(x);
  window.dispatchEvent(new CustomEvent('sjo:v8:update',{detail:p}));
  return p;
}
function dateKey(){return new Date().toISOString().slice(0,10)}
function weekKey(){
  const d=new Date(); const one=new Date(d.getFullYear(),0,1);
  return d.getFullYear()+'-'+Math.ceil((((d-one)/86400000)+one.getDay()+1)/7)
}
function levelForXP(xp){return Math.max(1,Math.floor(Math.sqrt(Math.max(0,xp)/100))+1)}
function xpForNext(lvl){return 100*lvl*lvl}

const catalog=[
 {id:'theme-midnight',type:'theme',name:'Midnight',price:0,icon:'🌙'},
 {id:'theme-ocean',type:'theme',name:'Ocean',price:250,icon:'🌊'},
 {id:'theme-sunset',type:'theme',name:'Sunset',price:350,icon:'🌅'},
 {id:'theme-emerald',type:'theme',name:'Emerald',price:450,icon:'💚'},
 {id:'avatar-gamepad',type:'avatar',name:'Gamepad',price:0,icon:'🎮'},
 {id:'avatar-crown',type:'avatar',name:'Crown',price:300,icon:'👑'},
 {id:'avatar-fire',type:'avatar',name:'Fire',price:400,icon:'🔥'},
 {id:'avatar-star',type:'avatar',name:'Star',price:500,icon:'⭐'},
 {id:'frame-default',type:'frame',name:'Classic Frame',price:0,icon:'⬜'},
 {id:'frame-gold',type:'frame',name:'Gold Frame',price:600,icon:'🟨'},
 {id:'frame-fire',type:'frame',name:'Fire Frame',price:800,icon:'🟥'}
];

const achievements=[
 ['first-win','First Victory','Win your first game','🏆',1],
 ['ten-games','Getting Started','Play 10 games','🎮',10],
 ['ten-wins','Winner','Win 10 games','🥇',10],
 ['fifty-games','Dedicated','Play 50 games','💯',50],
 ['streak-5','Hot Streak','Reach a 5-game win streak','🔥',5],
 ['streak-10','On Fire','Reach a 10-game win streak','🔥',10],
 ['coin-1000','Coin Collector','Own 1,000 coins','🪙',1000],
 ['level-5','Rising Star','Reach level 5','⭐',5],
 ['all-rounder','All-Rounder','Play all 6 games','🌟',6],
 ['master','Game Master','Win 50 games','👑',50]
];

function gameStat(p,game){
  if(!p.stats[game])p.stats[game]={played:0,wins:0,losses:0,draws:0,totalScore:0,bestScore:0,bestStreak:0};
  return p.stats[game];
}
function recordResult(game,result='played',score=0,extra={}){
  return update((p,x)=>{
    const s=gameStat(p,game),n=Number(score)||0;
    s.played++; p.totalGames++;
    s.totalScore+=n; if(n>s.bestScore)s.bestScore=n;
    if(result==='win'){s.wins++;p.wins++;p.streak++;if(p.streak>s.bestStreak)p.bestStreak=p.streak;if(p.streak>s.streak)p.streak=p.streak}
    else if(result==='loss'){s.losses++;p.losses++;p.streak=0}
    else if(result==='draw'){s.draws++;p.draws++}
    const rewardXP=result==='win'?50:(result==='draw'?20:10);
    const rewardCoins=result==='win'?25:(result==='draw'?10:5);
    p.xp+=rewardXP; p.coins+=rewardCoins; p.level=levelForXP(p.xp);
    p.lastPlayed=Date.now();
    if(s.bestStreak<p.streak)s.bestStreak=p.streak;
    checkAchievements(p);
    updateDaily(p,game,result,n);
    checkAchievements(p);
    p.title=deriveTitle(p);
  });
}
function updateDaily(p,game,result,score){
  const d=dateKey();
  if(!p.daily||p.daily.date!==d){
    const types=['play3','win2','score500','play2'];
    const idx=Math.floor(Date.now()/86400000)%types.length;
    p.daily={date:d,type:types[idx],progress:0,target:types[idx]==='score500'?500:(types[idx]==='play2'?2:(types[idx]==='win2'?2:3)),claimed:false,playedGames:[]};
  }
  if(!p.daily.playedGames.includes(game))p.daily.playedGames.push(game);
  if(p.daily.type==='play3')p.daily.progress=Math.min(3,p.daily.progress+1);
  if(p.daily.type==='win2'&&result==='win')p.daily.progress=Math.min(2,p.daily.progress+1);
  if(p.daily.type==='score500')p.daily.progress=Math.min(500,p.daily.progress+score);
  if(p.daily.type==='play2')p.daily.progress=Math.min(2,p.daily.playedGames.length);
  if(p.daily.progress>=p.daily.target&&!p.daily.claimed){
    p.daily.claimed=true;p.xp+=100;p.coins+=50;p.level=levelForXP(p.xp);
    toast('🎯 Daily Challenge complete! +100 XP +50 coins');
  }
}
function checkAchievements(p){
  const games=Object.keys(p.stats).filter(k=>p.stats[k].played>0).length;
  const checks={
   'first-win':p.wins>=1,'ten-games':p.totalGames>=10,'ten-wins':p.wins>=10,
   'fifty-games':p.totalGames>=50,'streak-5':p.bestStreak>=5,'streak-10':p.bestStreak>=10,
   'coin-1000':p.coins>=1000,'level-5':p.level>=5,'all-rounder':games>=7,'master':p.wins>=50
  };
  achievements.forEach(a=>{
    if(checks[a[0]]&&!p.achievements.includes(a[0])){
      p.achievements.push(a[0]);p.xp+=a[0]==='master'?500:100;p.coins+=a[0]==='master'?250:50;
      p.level=levelForXP(p.xp);toast(a[3]+' '+a[1]+' unlocked! +XP +coins');
    }
  });
}
function deriveTitle(p){
  if(p.wins>=50)return'Game Master';
  if(p.bestStreak>=20)return'Legend';
  if(p.bestStreak>=10)return'Grand Master';
  if(p.bestStreak>=5)return'Master';
  if(p.level>=5)return'Pro';
  if(p.wins>=10)return'Player';
  return'Rookie';
}
function createProfile(name){
  const x=load(),id='player-'+Date.now();
  x.profiles.push({id,name:name||'Player',avatar:'🎮',frame:'default',theme:'midnight',xp:0,coins:100,level:1,totalGames:0,wins:0,losses:0,draws:0,streak:0,bestStreak:0,titles:['Rookie'],achievements:[],unlocked:[],createdAt:Date.now(),lastPlayed:null,daily:{date:null},weekly:{week:null},stats:{}});
  x.activeProfile=id;save(x);location.reload();
}
function switchProfile(id){const x=load();if(x.profiles.some(p=>p.id===id)){x.activeProfile=id;save(x);location.reload()}}
function buy(id){
  const item=catalog.find(i=>i.id===id),x=load(),p=profile();
  if(!item||x.store.owned.includes(id))return equip(id);
  if(p.coins<item.price)return toast('🪙 Not enough coins');
  p.coins-=item.price;x.store.owned.push(id);save(x);equip(id);toast('🛒 '+item.name+' unlocked!');
}
function equip(id){
  const x=load(),item=catalog.find(i=>i.id===id);if(!item||!x.store.owned.includes(id))return;
  x.store.equipped[item.type]=item.type==='avatar'?item.icon:item.name.toLowerCase().replace(/ /g,'-');
  save(x);applyTheme();render();
}
function applyTheme(){
  const x=load(),t=x.store.equipped.theme;
  document.documentElement.dataset.sjoTheme=t;
}
function exportAll(){
  const payload={app:'SJO Games',version:8,exportedAt:new Date().toISOString(),
    v8:load(),localStorage:{}};
  for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);try{payload.localStorage[k]=JSON.parse(localStorage.getItem(k))}catch(e){payload.localStorage[k]=localStorage.getItem(k)}}
  const b=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a');
  a.href=URL.createObjectURL(b);a.download='sjo-games-v8-backup-'+dateKey()+'.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function importAll(file){
  const r=new FileReader();r.onload=()=>{try{
    const p=JSON.parse(r.result);
    if(p.v8)localStorage.setItem(KEY,JSON.stringify(p.v8));
    if(p.localStorage)Object.keys(p.localStorage).forEach(k=>localStorage.setItem(k,typeof p.localStorage[k]==='string'?p.localStorage[k]:JSON.stringify(p.localStorage[k])));
    location.reload();
  }catch(e){toast('❌ Invalid backup file') }};r.readAsText(file);
}
function toast(msg){
  const t=document.createElement('div');t.className='sjo-v8-toast';t.textContent=msg;document.body.appendChild(t);
  setTimeout(()=>t.remove(),3000);
}
function panel(){
  if(!/\/(index\.html)?$/.test(location.pathname))return; 
  if(document.getElementById('sjo-v8-panel'))return;
  const st=document.createElement('style');st.textContent=`
  :root{--sjo8-a:#8b5cf6;--sjo8-b:#111827;--sjo8-card:rgba(255,255,255,.08)}
  :root[data-sjo-theme="ocean"]{--sjo8-a:#06b6d4}
  :root[data-sjo-theme="sunset"]{--sjo8-a:#f97316}
  :root[data-sjo-theme="emerald"]{--sjo8-a:#10b981}
  #sjo-v8-panel{margin:16px auto;max-width:1150px;padding:18px;border-radius:22px;background:linear-gradient(135deg,var(--sjo8-b),#1f2937);color:#fff;font-family:system-ui;box-shadow:0 15px 45px rgba(0,0,0,.22)}
  #sjo-v8-panel h2{margin:0 0 3px}.sjo8-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px;margin-top:14px}.sjo8-card{background:var(--sjo8-card);padding:12px;border-radius:15px}.sjo8-big{font-size:25px;font-weight:850}.sjo8-tabs{display:flex;gap:7px;flex-wrap:wrap;margin-top:15px}.sjo8-tabs button,.sjo8-actions button{border:0;border-radius:10px;padding:9px 12px;font-weight:700;cursor:pointer}.sjo8-tab{display:none;margin-top:13px}.sjo8-tab.active{display:block}.sjo8-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:9px}.sjo8-item{padding:12px;border-radius:13px;background:rgba(255,255,255,.06)}.sjo8-muted{opacity:.7;font-size:12px}.sjo8-actions{margin-top:12px}.sjo8-toast{position:fixed;right:16px;bottom:16px;background:#111827;color:#fff;padding:13px 16px;border-radius:12px;z-index:99999;box-shadow:0 12px 30px rgba(0,0,0,.3)}
  `;
  document.head.appendChild(st);
  const p=document.createElement('section');p.id='sjo-v8-panel';
  p.innerHTML=`<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">
    <div><div class="sjo8-muted">SJO GAMES V8 • OFFLINE</div><h2>🎮 Player Center</h2><div id="v8profileline"></div></div>
    <div class="sjo8-actions"><button id="v8backup">⬇ Backup</button><button id="v8restore">⬆ Restore</button><input id="v8file" type="file" accept=".json" hidden></div></div>
    <div class="sjo8-grid" id="v8cards"></div>
    <div class="sjo8-tabs"><button data-tab="stats">📊 Statistics</button><button data-tab="ach">🏆 Achievements</button><button data-tab="daily">🎯 Challenges</button><button data-tab="store">🛒 Store</button><button data-tab="profiles">👥 Profiles</button></div>
    <div id="v8stats" class="sjo8-tab active"></div><div id="v8ach" class="sjo8-tab"></div><div id="v8daily" class="sjo8-tab"></div><div id="v8store" class="sjo8-tab"></div><div id="v8profiles" class="sjo8-tab"></div>`;
  (document.body.firstElementChild||document.body).before(p);
  p.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{p.querySelectorAll('.sjo8-tab').forEach(x=>x.classList.remove('active'));p.querySelector('#v8'+b.dataset.tab).classList.add('active')});
  p.querySelector('#v8backup').onclick=exportAll;p.querySelector('#v8restore').onclick=()=>p.querySelector('#v8file').click();p.querySelector('#v8file').onchange=e=>e.target.files[0]&&importAll(e.target.files[0]);
  render();
}
function render(){
  const p=profile(),x=load();applyTheme();
  const line=document.getElementById('v8profileline');if(!line)return;
  line.innerHTML=`${p.avatar} <b>${p.name}</b> • ${p.title||deriveTitle(p)} • Level ${p.level} • ${p.coins} 🪙`;
  document.getElementById('v8cards').innerHTML=[
   ['🎮','Games',p.totalGames],['🏆','Wins',p.wins],['🔥','Streak',p.streak],['⭐','XP',p.xp],['🪙','Coins',p.coins],['🏅','Achievements',p.achievements.length]
  ].map(c=>`<div class="sjo8-card"><div>${c[0]} ${c[1]}</div><div class="sjo8-big">${c[2]}</div></div>`).join('');
  document.getElementById('v8stats').innerHTML='<h3>Game Statistics</h3><div class="sjo8-list">'+
   Object.keys(p.stats).map(k=>{const s=p.stats[k],wr=s.played?Math.round(s.wins/s.played*100):0;return `<div class="sjo8-item"><b>${k}</b><br>Played: ${s.played} • Wins: ${s.wins} • Losses: ${s.losses} • Draws: ${s.draws}<br>Win rate: ${wr}% • Best: ${s.bestScore}</div>`}).join('')+'</div>';
  document.getElementById('v8ach').innerHTML='<h3>Achievements</h3><div class="sjo8-list">'+achievements.map(a=>`<div class="sjo8-item">${a[3]} <b>${a[1]}</b><br><span class="sjo8-muted">${a[2]}</span><br>${p.achievements.includes(a[0])?'✅ Unlocked':'🔒 Locked'}</div>`).join('')+'</div>';
  const d=p.daily||{};document.getElementById('v8daily').innerHTML=`<h3>Daily Challenge</h3><div class="sjo8-item">🎯 ${d.type||'play3'}<br>Progress: ${d.progress||0} / ${d.target||3}<br>${d.claimed?'✅ Completed':'Keep playing to complete it.'}</div><h3>Login Streak</h3><div class="sjo8-item">🔥 ${p.streak} current • ${p.bestStreak} best</div>`;
  document.getElementById('v8store').innerHTML='<h3>Virtual Store</h3><div class="sjo8-list">'+catalog.map(i=>{const own=x.store.owned.includes(i.id);return `<div class="sjo8-item">${i.icon} <b>${i.name}</b><br>${own?'✅ Owned':'🪙 '+i.price}<br><button onclick="window.SJOGamesV8.${own?'equip':'buy'}('${i.id}')">${own?'Equip':'Buy'}</button></div>`}).join('')+'</div>';
  document.getElementById('v8profiles').innerHTML='<h3>Local Profiles</h3><div class="sjo8-list">'+x.profiles.map(q=>`<div class="sjo8-item">${q.avatar} <b>${q.name}</b><br>Level ${q.level} • ${q.wins} wins • ${q.coins} 🪙<br><button onclick="SJOGamesV8.switchProfile('${q.id}')">${q.id===x.activeProfile?'Active':'Switch'}</button></div>`).join('')+`</div><div class="sjo8-actions"><button onclick="SJOGamesV8.createProfile(prompt('Player name'))">➕ Add Player</button></div>`;
}
window.SJOGamesV8={profile,recordResult,createProfile,switchProfile,buy,equip,exportAll,importAll,render,gameStat};
document.addEventListener('DOMContentLoaded',()=>setTimeout(panel,180));
window.addEventListener('sjo:v8:update',render);
})();
