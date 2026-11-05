$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
$gamesDir = Join-Path $root "public\games"
if (!(Test-Path $gamesDir)) { throw "Run this script from the SJO Games project root (the folder containing public\games)." }
$source = Join-Path $PSScriptRoot "public\games\coloring-book.html"
if (!(Test-Path $source)) { throw "coloring-book.html is missing from the extracted ZIP." }
Copy-Item $source (Join-Path $gamesDir "coloring-book.html") -Force

# Add the game to games.json without duplicating it.
$jsonPath = Join-Path $gamesDir "games.json"
$games = @(Get-Content $jsonPath -Raw | ConvertFrom-Json)
if (!($games | Where-Object { $_.file -eq "coloring-book.html" })) {
  $games += [pscustomobject]@{ name="Coloring Book"; icon="🖍️"; category="Kids Creative"; file="coloring-book.html"; offline=$true }
  $games | ConvertTo-Json -Depth 8 | Set-Content $jsonPath -Encoding UTF8
}

# Register it with the shared SJO XP / coins / history system.
$corePath = Join-Path $gamesDir "sjo-core.js"
$core = Get-Content $corePath -Raw
if ($core -notmatch "'coloring-book\.html'") {
  $old = "'spider-solitaire.html':{id:'spider',name:'Spider Solitaire',icon:'🕷️'}"
  $new = $old + ",`r`n 'coloring-book.html':{id:'coloring',name:'Coloring Book',icon:'🖍️'}"
  if (!$core.Contains($old)) { throw "Could not find the Spider Solitaire entry in sjo-core.js; no further changes made." }
  $core = $core.Replace($old,$new)
  Set-Content $corePath $core -Encoding UTF8
}

# Add it to the home page's recent-games lookup list.
$indexPath = Join-Path $gamesDir "index.html"
$index = Get-Content $indexPath -Raw
$oldGame = '{"name": "Spider Solitaire", "icon": "🕷️", "tag": "Card Game", "file": "spider-solitaire.html"}'
$newGame = $oldGame + ', {"name": "Coloring Book", "icon": "🖍️", "tag": "Kids Creative", "file": "coloring-book.html"}'
if ($index.Contains($oldGame) -and $index -notmatch '"file": "coloring-book\.html"') {
  $index = $index.Replace($oldGame,$newGame)
}

# Add a visible tile to the existing game grid.
$index = Get-Content $indexPath -Raw
if ($index -notmatch 'data-name="coloring book"') {
  $marker = 'data-name="spider solitaire"'
  $start = $index.IndexOf($marker)
  if ($start -lt 0) { throw "Could not find the Spider Solitaire card in index.html." }
  $end = $index.IndexOf("</article>",$start)
  if ($end -lt 0) { throw "Could not find the end of the Spider Solitaire card." }
  $end += "</article>".Length
  $card = @'
<article class="game-card" data-name="coloring book">
<button class="fav" data-file="coloring-book.html">☆</button>
<a href="coloring-book.html" class="playlink" data-file="coloring-book.html">
<div class="game-icon">🖍️</div><div class="tag">Kids Creative</div><h2>Coloring Book</h2>
<p>Offline • Mobile friendly</p><div class="play">PLAY NOW →</div></a></article>
'@
  $index = $index.Insert($end,$card)
  Set-Content $indexPath $index -Encoding UTF8
}
Write-Host "Coloring Book installed successfully in SJO Games." -ForegroundColor Green
Write-Host "Next: git add . ; git commit -m 'Add kids coloring book game' ; git push"
