SJO Tambola Number Speaker add-on

Features:
- Random caller for numbers 1–90, without repeats
- Hindi, English (India), and English (US) browser voice options
- Auto caller with 3, 5, 7, or 10 second interval
- Manual Next, Repeat, Pause, and New Game
- Live 1–90 board with called numbers highlighted
- Last 12 calls, copy called numbers, and fullscreen mode
- Mobile-friendly; uses browser speech synthesis (internet not required for the game itself)

Install:
1. Extract this ZIP into your SJO Games project root (folder containing public/).
2. Open PowerShell in that project root.
3. Run: powershell -ExecutionPolicy Bypass -File .\install-tambola.ps1
4. Then: git add .
   git commit -m "Add Tambola number speaker"
   git push

Note: The spoken voice is provided by the browser/device. Available voices depend on the device's installed speech voices.
