const CACHE='sjo-games-v14';
const ASSETS=['./','./index.html','./sjo-core.js','./sudoku.html','./tic-tac-toe.html','./art-block-puzzle.html','./ludo.html','./snake-ladder.html','./bubble-shooter.html','./teen-patti.html','./spider-solitaire.html','./icons/spider-solitaire.png','./games.json','./manifest.json','./icon.svg','./sjo-ui.css','./sjo-fx.js','./icon-192.png','./icon-512.png','./favicon-32.png','./favicon.ico','./apple-touch-icon.png'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return res}).catch(()=>caches.match('./index.html')))));
