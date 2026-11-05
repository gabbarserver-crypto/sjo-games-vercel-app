/* SJO UI v10 — theme sync, win confetti, tiny haptics */
(function(){
 var de=document.documentElement;
 function theme(){var t=null;try{t=localStorage.getItem('sjo_v4_theme')}catch(e){}
  if(!t)t=(window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';
  de.setAttribute('data-sjo-theme',t);
  var m=document.querySelector('meta[name=theme-color]');if(m)m.content=t==='dark'?'#0a0f1f':'#111827'}
 theme();window.addEventListener('storage',theme);
 if(window.matchMedia)try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',theme)}catch(e){}
 function buzz(n){try{navigator.vibrate&&navigator.vibrate(n)}catch(e){}}
 document.addEventListener('click',function(e){if(e.target.closest&&e.target.closest('button'))buzz(8)},true);
 function confetti(){
  if(matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  var c=document.createElement('canvas');c.className='sjo-confetti';document.body.appendChild(c);
  var x=c.getContext('2d'),W=c.width=innerWidth,H=c.height=innerHeight,cols=['#6366f1','#8b5cf6','#06b6d4','#f59e0b','#ec4899','#10b981'];
  var ps=Array.from({length:130},function(){return{x:W/2+(Math.random()-.5)*80,y:H*.55,vx:(Math.random()-.5)*14,vy:-Math.random()*15-5,s:Math.random()*7+4,r:Math.random()*6,vr:(Math.random()-.5)*.4,c:cols[Math.random()*cols.length|0]}});
  var t0=performance.now();
  (function f(t){var dt=t-t0;x.clearRect(0,0,W,H);
   ps.forEach(function(p){p.vy+=.38;p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;x.save();x.translate(p.x,p.y);x.rotate(p.r);x.fillStyle=p.c;x.globalAlpha=Math.max(0,1-dt/2600);x.fillRect(-p.s/2,-p.s/3,p.s,p.s*.6);x.restore()});
   if(dt<2700)requestAnimationFrame(f);else c.remove()})(t0);
  buzz([20,40,20]);
 }
 window.SJOFX={confetti:confetti};
 // fire confetti when a win overlay opens (not for losses/draws)
 function watch(){
  document.querySelectorAll('.overlay').forEach(function(o){
   var was=false;
   new MutationObserver(function(){
    var open=getComputedStyle(o).display!=='none';
    if(open&&!was){var txt=(o.textContent||'').toLowerCase();
     if(/you win|level clear|great run|wins!|you won|congrat|solved|nice|well done|completed/.test(txt)&&!/computer wins|you lose|lost|draw|folded/.test(txt))setTimeout(confetti,150);else buzz(30)}
    was=open}).observe(o,{attributes:true,attributeFilter:['style','class']});
  });
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watch);else watch();
})();
