# Instagram-Reels (1080×1920, Englisch)

Nimmt die echte App im Demo-Modus (`?embed=1`, englische Demo-Daten aus `demo-en.js`) in einem iPad-Rahmen auf.

```bash
npx http-server -p 8080 -c-1   # im Repo-Wurzelverzeichnis
node scripts/reels/record.js flashcards            # → scripts/reels/out/flashcards.mp4
node scripts/reels/record.js planner --preview     # schnelles Kontaktblatt zum Prüfen
```

Neue Reels: `reels/<name>.js` anlegen (Headlines `hls`, Kamera `cam`, Cursor `cur`, Aktionen `acts`, Abschluss `end`).
Musik und Tipp-Geräusche erzeugt `music.py` (eigener, lizenzfreier Track). Braucht Playwright (Chromium), ffmpeg, Python mit numpy.
