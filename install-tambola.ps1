$ErrorActionPreference = "Stop"
$root = (Get-Location).Path
$gamesDir = Join-Path $root "public\games"
if (!(Test-Path $gamesDir)) { throw "Run this script from the SJO Games project root (the folder containing public\games)." }
Copy-Item (Join-Path $PSScriptRoot "public\games\tambola.html") (Join-Path $gamesDir "tambola.html") -Force

# Update games.json
$jsonPath = Join-Path $gamesDir "games.json"
$games = @(Get-Content $jsonPath -Raw | ConvertFrom-Json)
if (!($games | Where-Object { $_.file -eq "tambola.html" })) {
  $games += [pscustomobject]@{ name="Tambola Number Speaker"; icon="🎙️"; category="Party Game"; file="tambola.html"; offline=$true }
  $games | ConvertTo-Json -Depth 8 | Set-Content $jsonPath -Encoding UTF8
}

# Add shared player statistics registration
$corePath = Join-Path $gamesDir "sjo-core.js"
$core = Get-Content $corePath -Raw
if ($core -notmatch "'tambola\.html'") {
  $old = "'spider-solitaire.html':{id:'spider',name:'Spider Solitaire',icon:'🕷️'}"
  $new = $old + ",`r`n 'tambola.html':{id:'tambola',name:'Tambola Number Speaker',icon:'🎙️'}"
  if (!$core.Contains($old)) { throw "Could not find Spider Solitaire entry in sjo-core.js." }
  Set-Content $corePath $core.Replace($old,$new) -Encoding UTF8
}

# Add to the games list used for Recent Played.
$indexPath = Join-Path $gamesDir "index.html"
$index = Get-Content $indexPath -Raw
$oldGame = '{"name": "Spider Solitaire", "icon": "🕷️", "tag": "Card Game", "file": "spider-solitaire.html"}'
$newGame = $oldGame + ', {"name": "Tambola Number Speaker", "icon": "🎙️", "tag": "Party Game", "file": "tambola.html"}'
if ($index.Contains($oldGame) -and $index -notmatch '"file": "tambola\.html"') { $index = $index.Replace($oldGame,$newGame) }

# Add visible game card
if ($index -notmatch 'data-name="tambola number speaker"') {
  $marker = 'data-name="spider solitaire"'
  $start = $index.IndexOf($marker)
  if ($start -lt 0) { throw "Could not find Spider Solitaire card in index.html." }
  $end = $index.IndexOf("</article>",$start)
  if ($end -lt 0) { throw "Could not find end of Spider Solitaire card." }
  $end += "</article>".Length
  $card = @'
<article class="game-card" data-name="tambola number speaker">
<button class="fav" data-file="tambola.html">☆</button>
<a href="tambola.html" class="playlink" data-file="tambola.html">
<div class="game-icon">🎙️</div><div class="tag">Party Game</div><h2>Tambola Number Speaker</h2>
<p>Voice caller • 1–90 • Auto mode</p><div class="play">PLAY NOW →</div></a></article>
'@
  $index = $index.Insert($end,$card)
}
Set-Content $indexPath $index -Encoding UTF8
Write-Host "Tambola Number Speaker installed successfully." -ForegroundColor Green
Write-Host "Next: git add . ; git commit -m 'Add Tambola number speaker' ; git push"
