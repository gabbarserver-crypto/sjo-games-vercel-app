(function(){
const KEY='sjo_v6_data';
const GAMES={
 'sudoku.html':{id:'sudoku',name:'Sudoku',icon:'🧩'},
 'tic-tac-toe.html':{id:'ttt',name:'Tic-Tac-Toe',icon:'❌⭕'},
 'art-block-puzzle.html':{id:'art',name:'Art Block Puzzle',icon:'🎨'},
 'ludo.html':{id:'ludo',name:'Ludo',icon:'🎲'},
 'bubble-shooter.html':{id:'bubble',name:'Bubble Shooter',icon:'🫧'},
 'snake-ladder.html':{id:'snake',name:'Snake & Ladder',icon:'🐍'},
 'teen-patti.html':{id:'teen',name:'Teen Patti',icon:'🃏'},
 'spider-solitaire.html':{id:'spider',name:'Spider Solitaire',icon:'🕷️'},
 'coloring-book.html':{id:'coloring',name:'Coloring Book',icon:'🖍️'}
};
const defaults=()=>({version:6,name:'Player',avatar:'🎮',xp:0,coins:100,played:0,wins:0,losses:0,draws:0,streak:0,bestStreak:0,totalScore:0,favs:[],recent:[],daily:{date:'',count:0,rewarded:false},achievements:[],history:[],games:Object.fromEntries(Object.values(GAMES).map(g=>[g.id,{played:0,wins:0,losses:0,draws:0,score:0,bestScore:0,streak:0,bestStreak:0,lastPlayed:null,extra:{}}]))});
function migrate(){let d;try{d=JSON.parse(localStorage.getItem(KEY)||'null')}catch(e){} if(d&&d.version===6)return d; let old=null;try{old=JSON.parse(localStorage.getItem('sjo_v4_data')||localStorage.getItem('sjo_v4_data')||'null')}catch(e){}; d=defaults(); if(old){Object.assign(d,{name:old.name||d.name,avatar:old.avatar||d.avatar,xp:old.xp||0,coins:old.coins??100,favs:old.favs||[],recent:old.recent||[]});} localStorage.setItem(KEY,JSON.stringify(d));return d}
let data=migrate();
function save(){localStorage.setItem(KEY,JSON.stringify(data));}
function gameId(){const f=location.pathname.split('/').pop();return GAMES[f]?.id||null}
function addXP(n){data.xp+=Math.max(0,n|0)}
function reward(type,score){let xp=type==='win'?30:type==='draw'?15:8;let coins=type==='win'?20:type==='draw'?10:5; if(score>0){xp+=Math.min(25,Math.floor(score/100));coins+=Math.min(15,Math.floor(score/250));} addXP(xp);data.coins+=coins;return {xp,coins}}
function ensureGame(id){if(!data.games[id])data.games[id]={played:0,wins:0,losses:0,draws:0,score:0,bestScore:0,streak:0,bestStreak:0,lastPlayed:null,extra:{}};return data.games[id]}
function achievementCheck(){const unlocked=new Set(data.achievements);const all=[
 ['first','🎮 First Victory','Win your first game',data.wins>=1],['five','🔥 Five Wins','Win 5 games',data.wins>=5],['streak5','🔥 Hot Streak','Reach a 5-win streak',data.bestStreak>=5],['all6','🌈 All-Rounder','Play all 8 games',Object.values(data.games).every(g=>g.played>0)],['master6','👑 Master Player','Win at least once in all 6 games',Object.values(data.games).every(g=>g.wins>0)],['score1000','⭐ Score Hunter','Earn 1,000 total score',data.totalScore>=1000],['coins250','🪙 Coin Collector','Reach 250 coins',data.coins>=250],['level5','🚀 Level 5','Reach level 5',Math.floor(data.xp/100)+1>=5],['sudoku10','🧩 Sudoku Solver','Solve 10 Sudoku puzzles',data.games.sudoku?.wins>=10],['ttt10','❌ TTT Champion','Win 10 Tic-Tac-Toe games',data.games.ttt?.wins>=10],['bubble10','🫧 Bubble Expert','Clear 10 Bubble Shooter levels',data.games.bubble?.wins>=10],['art5000','🎨 Art Master','Score 5,000 in Art Block Puzzle',data.games.art?.bestScore>=5000],['ludo10','🎲 Ludo Champion','Win 10 Ludo games',data.games.ludo?.wins>=10],['teen10','🃏 Teen Patti Pro','Win 10 Teen Patti rounds',data.games.teen?.wins>=10],['spider5','🕷️ Spider Master','Win 5 Spider Solitaire games',data.games.spider?.wins>=5]
]; all.forEach(a=>{if(a[3]&&!unlocked.has(a[0]))data.achievements.push(a[0])}); return all}
function record(result,score=0,extra={}){const id=gameId();if(!id)return;const g=ensureGame(id);const now=new Date().toISOString();const type=result==='win'?'wins':result==='loss'?'losses':'draws';g.played++;g[type]++;g.score+=Math.max(0,score|0);g.bestScore=Math.max(g.bestScore,score|0);g.lastPlayed=now;if(result==='win'){g.streak++;g.bestStreak=Math.max(g.bestStreak,g.streak);data.streak++;data.bestStreak=Math.max(data.bestStreak,data.streak)}else if(result==='loss'){g.streak=0;data.streak=0}else{g.streak=0}
 data.played++;data.wins+=result==='win'?1:0;data.losses+=result==='loss'?1:0;data.draws+=result==='draw'?1:0;data.totalScore+=Math.max(0,score|0);const r=reward(result,score);data.history.unshift({game:id,result,score:score|0,xp:r.xp,coins:r.coins,at:now,extra});data.history=data.history.slice(0,100);const path=location.pathname.split('/').pop();data.recent=[path,...data.recent.filter(x=>x!==path)].slice(0,5);const day=now.slice(0,10);if(data.daily.date!==day){data.daily={date:day,count:0,rewarded:false}};data.daily.count=Math.min(2,data.daily.count+1);if(data.daily.count>=2&&!data.daily.rewarded){data.daily.rewarded=true;data.coins+=25;addXP(20)} achievementCheck();save();
 window.dispatchEvent(new CustomEvent('sjo:v6',{detail:data}));
}
function level(){return Math.floor(data.xp/100)+1}
function get(){return data}
window.SJO={record,save,get,level,achievementCheck,GAMES,KEY};
})();
