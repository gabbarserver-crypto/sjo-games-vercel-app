
/* SJO Games V9 - Advanced Offline Gaming Edition
   Database-free progression layer.
*/
(function(){
'use strict';
const KEY='sjo_games_v9';
const V8='sjo_games_v8';
const games=['Sudoku','Tic-Tac-Toe','Art Block Puzzle','Ludo','Bubble Shooter','Teen Patti','Spider Solitaire'];

const defaults={
 version:9,
 activeProfile:null,
 players:{},
 history:[],
 missions:{},
 mastery:{},
 settings:{sound:true,animations:true},
 migrated:false
};

function load(){try{let x=JSON.parse(localStorage.getItem(KEY)||'null');return x&&x.version===9?x:defaults}catch(e){return defaults}}
function save(x){localStorage.setItem(KEY,JSON.stringify(x));return x}
function uid(){return 'p-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7)}
function day(){return new Date().toISOString().slice(0,10)}
function week(){const d=new Date(),s=new Date(d.getFullYear(),0,1);return d.getFullYear()+'-'+Math.ceil((((d-s)/86400000)+s.getDay()+1)/7)}
function level(xp){return Math.max(1,Math.floor(Math.sqrt(Math.max(0,xp)/100))+1)}
function nextXP(l){return 100*l*l}
function get(){let x=load(); if(!x.activeProfile){migrate(x)} return x}
function migrate(x){
  try{
    const v8=JSON.parse(localStorage.getItem(V8)||'null');
    if(v8&&v8.profiles){
      v8.profiles.forEach(p=>{
        x.players[p.id]={
          id:p.id,name:p.name||'Player',avatar:p.avatar||'🎮',xp:p.xp||0,coins:p.coins||100,
          level:level(p.xp||0),games:p.totalGames||0,wins:p.wins||0,losses:p.losses||0,draws:p.draws||0,
          streak:p.streak||0,bestStreak:p.bestStreak||0,achievements:p.achievements||[],
          titles:p.titles||['Rookie'],mastery:{},missions:{},stats:p.stats||{}
        };
      });
      x.activeProfile=v8.activeProfile||Object.keys(x.players)[0];
    }
  }catch(e){}
  if(!Object.keys(x.players).length){
    const id=uid();x.players[id]=newPlayer(id,'Player 1');x.activeProfile=id;
  }
  x.migrated=true;save(x);
}
function newPlayer(id,name){return{id,name:name||'Player',avatar:'🎮',xp:0,coins:100,level:1,games:0,wins:0,losses:0,draws:0,streak:0,bestStreak:0,achievements:[],titles:['Rookie'],mastery:{},missions:{},stats:{}}}
function p(){const x=get();return x.players[x.activeProfile]||Object.values(x.players)[0]}
function title(q){if(q.wins>=100)return'Legend';if(q.wins>=50)return'Game Master';if(q.bestStreak>=20)return'Grand Master';if(q.bestStreak>=10)return'Master';if(q.level>=10)return'Pro';if(q.wins>=10)return'Player';return'Rookie'}
function stat(q,g){if(!q.stats[g])q.stats[g]={played:0,wins:0,losses:0,draws:0,totalScore:0,bestScore:0,streak:0};return q.stats[g]}
function mastery(q,g){
  if(!q.mastery[g])q.mastery[g]={level:0,xp:0,wins:0,score:0};
  return q.mastery[g]
}
function masteryLevel(mx){return Math.min(5,Math.floor(mx.xp/250))}
function masteryName(l){return ['Bronze','Silver','Gold','Platinum','Diamond'][l]||'Bronze'}

const achievementDefs=[
 ['first-win','First Victory','Win your first game','🏆',100,50],
 ['ten-wins','Winner','Win 10 games','🥇',150,75],
 ['fifty-games','Dedicated','Play 50 games','💯',250,100],
 ['hundred-games','Veteran','Play 100 games','🎖️',500,200],
 ['streak-5','Hot Streak','Reach 5 wins in a row','🔥',150,75],
 ['streak-10','On Fire','Reach 10 wins in a row','🔥',300,150],
 ['all-six','All-Rounder','Play all seven games','🌟',250,100],
 ['master-one','Mastery','Reach Gold mastery in any game','👑',300,150],
 ['coins-5000','Rich Player','Own 5,000 coins','🪙',300,150],
 ['level-10','Level 10','Reach level 10','⭐',500,250]
];

const missionDefs=[
 ['daily-games','Daily: Play 3 games',3,'games',100,50],
 ['daily-win','Daily: Win 2 games',2,'wins',120,60],
 ['daily-score','Daily: Score 500 points',500,'score',150,75],
 ['weekly-games','Weekly: Play 15 games',15,'games',300,150],
 ['weekly-wins','Weekly: Win 7 games',7,'wins',400,200]
];

function mission(q,id){
  if(!q.missions[id]||q.missions[id].period!==((id.startsWith('daily')?day():week()))){
    const d=missionDefs.find(m=>m[0]===id);
    q.missions[id]={period:id.startsWith('daily')?day():week(),progress:0,target:d[2],claimed:false};
  }
  return q.missions[id]
}
function reward(q,xp,coins){
  q.xp+=xp;q.coins+=coins;q.level=level(q.xp);
}
function checkAchievements(q){
  const playedGames=games.filter(g=>q.stats[g]&&q.stats[g].played>0).length;
  const gold=games.some(g=>q.mastery[g]&&masteryLevel(q.mastery[g])>=2);
  const checks={
   'first-win':q.wins>=1,'ten-wins':q.wins>=10,'fifty-games':q.games>=50,'hundred-games':q.games>=100,
   'streak-5':q.bestStreak>=5,'streak-10':q.bestStreak>=10,'all-six':playedGames>=7,
   'master-one':gold,'coins-5000':q.coins>=5000,'level-10':q.level>=10
  };
  achievementDefs.forEach(a=>{
    if(checks[a[0]]&&!q.achievements.includes(a[0])){
      q.achievements.push(a[0]);reward(q,a[4],a[5]);toast(a[3]+' '+a[1]+' unlocked! +'+a[4]+' XP +'+a[5]+' coins');
    }
  });
}
function updateMission(q,type,score){
  const ids=['daily-games','daily-win','daily-score','weekly-games','weekly-wins'];
  ids.forEach(id=>{
    const m=mission(q,id),d=missionDefs.find(x=>x[0]===id);
    if(m.claimed)return;
    if(d[3]==='games')m.progress=Math.min(d[2],m.progress+1);
    if(d[3]==='wins'&&type==='win')m.progress=Math.min(d[2],m.progress+1);
    if(d[3]==='score')m.progress=Math.min(d[2],m.progress+Number(score||0));
    if(m.progress>=m.target&&!m.claimed){
      m.claimed=true;reward(q,d[4],d[5]);toast('🎯 Mission complete! +'+d[4]+' XP +'+d[5]+' coins');
    }
  });
}
function record(game,result,score){
  const x=get(),q=p(),s=stat(q,game),mx=mastery(q,game),n=Number(score)||0;
  s.played++;q.games++;s.totalScore+=n;if(n>s.bestScore)s.bestScore=n;
  mx.xp+=result==='win'?100:25;mx.wins+=result==='win'?1:0;mx.score+=n;mx.level=masteryLevel(mx);
  if(result==='win'){s.wins++;q.wins++;q.streak++;if(q.streak>q.bestStreak)q.bestStreak=q.streak;s.streak++}
  else if(result==='loss'){s.losses++;q.losses++;q.streak=0;s.streak=0}
  else if(result==='draw'){s.draws++;q.draws++}
  const xp=result==='win'?50:result==='draw'?20:10, coins=result==='win'?25:result==='draw'?10:5;
  reward(q,xp,coins);
  updateMission(q,result,n);
  checkAchievements(q);
  q.title=title(q);
  x.history.unshift({id:uid(),profile:q.id,game,result,score:n,xp,coins,date:new Date().toISOString()});
  x.history=x.history.slice(0,500);
  save(x);render();
}
function leaderboard(){
  const x=get();
  return Object.values(x.players).sort((a,b)=>b.xp-a.xp).map((q,i)=>({rank:i+1,name:q.name,xp:q.xp,wins:q.wins,coins:q.coins,level:q.level}))
}
function createPlayer(name){
  const x=get(),id=uid();x.players[id]=newPlayer(id,name||'Player '+(Object.keys(x.players).length+1));x.activeProfile=id;save(x);location.reload()
}
function switchPlayer(id){const x=get();if(x.players[id]){x.activeProfile=id;save(x);location.reload()}}
function deletePlayer(id){
  const x=get();if(Object.keys(x.players).length<=1)return toast('At least one player must remain');
  delete x.players[id];if(x.activeProfile===id)x.activeProfile=Object.keys(x.players)[0];save(x);location.reload()
}
function backup(){
  const payload={app:'SJO Games',version:9,exportedAt:new Date().toISOString(),v9:get()};
  const b=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a');
  a.href=URL.createObjectURL(b);a.download='sjo-games-v9-backup-'+day()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)
}
function restore(file){
  const r=new FileReader();r.onload=()=>{try{const z=JSON.parse(r.result);if(!z.v9||z.v9.version!==9)throw Error();localStorage.setItem(KEY,JSON.stringify(z.v9));location.reload()}catch(e){toast('❌ Invalid V9 backup')}};r.readAsText(file)
}
function toast(msg){
  const t=document.createElement('div');t.className='sjo9-toast';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),3200)
}
function render(){
  const q=p(),x=get(),el=document.getElementById('sjo-v9-panel');if(!el)return;
  q.level=level(q.xp);q.title=title(q);save(x);
  document.getElementById('v9head').innerHTML=`${q.avatar} <b>${q.name}</b> • ${q.title} • Level ${q.level}`;
  document.getElementById('v9cards').innerHTML=[
    ['🎮','Games',q.games],['🏆','Wins',q.wins],['🔥','Streak',q.streak],['⭐','XP',q.xp],['🪙','Coins',q.coins],['🏅','Achievements',q.achievements.length]
  ].map(c=>`<div class="sjo9-card"><div>${c[0]} ${c[1]}</div><div class="sjo9-big">${c[2]}</div></div>`).join('');
  document.getElementById('v9stats').innerHTML='<h3>📊 Game Performance</h3><div class="sjo9-list">'+games.map(g=>{
    const s=stat(q,g),mx=mastery(q,g),wr=s.played?Math.round(s.wins/s.played*100):0;
    return `<div class="sjo9-item"><b>${g}</b><br>Played ${s.played} • W ${s.wins} • L ${s.losses} • D ${s.draws}<br>Win rate ${wr}% • Best score ${s.bestScore}<br>Mastery: <b>${masteryName(masteryLevel(mx))}</b> (${mx.xp} XP)</div>`
  }).join('')+'</div>';
  document.getElementById('v9missions').innerHTML='<h3>🎯 Missions</h3><div class="sjo9-list">'+missionDefs.map(d=>{
    const m=mission(q,d[0]);return `<div class="sjo9-item"><b>${d[0].startsWith('daily')?'Daily':'Weekly'}</b><br>${d[1]}<br>${m.progress}/${m.target} ${m.claimed?'✅ Claimed':''}</div>`
  }).join('')+'</div>';
  document.getElementById('v9ach').innerHTML='<h3>🏆 Achievements</h3><div class="sjo9-list">'+achievementDefs.map(a=>`<div class="sjo9-item">${a[3]} <b>${a[1]}</b><br><span class="sjo9-muted">${a[2]}</span><br>${q.achievements.includes(a[0])?'✅ Unlocked':'🔒 Locked'}</div>`).join('')+'</div>';
  document.getElementById('v9leader').innerHTML='<h3>🥇 Local Leaderboard</h3><div class="sjo9-list">'+leaderboard().map(r=>`<div class="sjo9-item"><b>#${r.rank} ${r.name}</b><br>Level ${r.level} • ${r.xp} XP • ${r.wins} wins • ${r.coins} 🪙</div>`).join('')+'</div>';
  document.getElementById('v9history').innerHTML='<h3>📜 Match History</h3><div class="sjo9-list">'+x.history.filter(h=>h.profile===q.id).slice(0,30).map(h=>`<div class="sjo9-item"><b>${h.game}</b> — ${h.result}<br>Score ${h.score} • +${h.xp} XP • +${h.coins} 🪙<br><span class="sjo9-muted">${new Date(h.date).toLocaleString()}</span></div>`).join('')+'</div>';
  document.getElementById('v9players').innerHTML='<h3>👥 Local Players</h3><div class="sjo9-list">'+Object.values(x.players).map(z=>`<div class="sjo9-item">${z.avatar} <b>${z.name}</b><br>Level ${z.level} • ${z.xp} XP • ${z.wins} wins<br><button onclick="SJOGamesV9.switchPlayer('${z.id}')">${z.id===x.activeProfile?'Active':'Switch'}</button> <button onclick="SJOGamesV9.deletePlayer('${z.id}')">Delete</button></div>`).join('')+'</div><button onclick="SJOGamesV9.createPlayer(prompt('Player name'))">➕ Add Player</button>';
}
function panel(){
  if(!/\/(index\.html)?$/.test(location.pathname))return; 
 if(document.getElementById('sjo-v9-panel'))return;
 const s=document.createElement('style');s.textContent=`
 #sjo-v9-panel{margin:16px auto;max-width:1150px;padding:18px;border-radius:22px;background:linear-gradient(135deg,#0f172a,#1e293b);color:#fff;font-family:system-ui;box-shadow:0 15px 45px rgba(0,0,0,.22)}
 #sjo-v9-panel h2{margin:0}.sjo9-muted{opacity:.7;font-size:12px}.sjo9-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px;margin-top:14px}.sjo9-card{padding:12px;border-radius:15px;background:rgba(255,255,255,.08)}.sjo9-big{font-size:25px;font-weight:850}.sjo9-tabs{display:flex;gap:7px;flex-wrap:wrap;margin-top:15px}.sjo9-tabs button,#sjo-v9-panel button{border:0;border-radius:10px;padding:8px 11px;font-weight:700;cursor:pointer}.sjo9-tab{display:none;margin-top:13px}.sjo9-tab.active{display:block}.sjo9-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:9px}.sjo9-item{padding:12px;border-radius:13px;background:rgba(255,255,255,.06)}.sjo9-toast{position:fixed;right:16px;bottom:16px;background:#111827;color:#fff;padding:13px 16px;border-radius:12px;z-index:99999;box-shadow:0 12px 30px rgba(0,0,0,.3)}
 `;
 document.head.appendChild(s);
 const p0=document.createElement('section');p0.id='sjo-v9-panel';
 p0.innerHTML=`<div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><div class="sjo9-muted">SJO GAMES V9 • ADVANCED OFFLINE</div><h2>🎮 Player Center</h2><div id="v9head"></div></div><div><button id="v9backup">⬇ Backup</button><button id="v9restore">⬆ Restore</button><input id="v9file" type="file" accept=".json" hidden></div></div>
 <div class="sjo9-grid" id="v9cards"></div>
 <div class="sjo9-tabs"><button data-v9="stats">📊 Stats</button><button data-v9="missions">🎯 Missions</button><button data-v9="ach">🏆 Achievements</button><button data-v9="leader">🥇 Leaderboard</button><button data-v9="history">📜 History</button><button data-v9="players">👥 Players</button></div>
 <div id="v9stats" class="sjo9-tab active"></div><div id="v9missions" class="sjo9-tab"></div><div id="v9ach" class="sjo9-tab"></div><div id="v9leader" class="sjo9-tab"></div><div id="v9history" class="sjo9-tab"></div><div id="v9players" class="sjo9-tab"></div>`;
 (document.body.firstElementChild||document.body).before(p0);
 p0.querySelectorAll('[data-v9]').forEach(b=>b.onclick=()=>{p0.querySelectorAll('.sjo9-tab').forEach(t=>t.classList.remove('active'));p0.querySelector('#v9'+b.dataset.v9).classList.add('active')});
 p0.querySelector('#v9backup').onclick=backup;p0.querySelector('#v9restore').onclick=()=>p0.querySelector('#v9file').click();p0.querySelector('#v9file').onchange=e=>e.target.files[0]&&restore(e.target.files[0]);
 render();
}
window.SJOGamesV9={record,profile:p,leaderboard,createPlayer,switchPlayer,deletePlayer,backup,restore,render,stat,mastery};
document.addEventListener('DOMContentLoaded',()=>setTimeout(panel,180));
window.addEventListener('sjo:v9:update',render);
})();
