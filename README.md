# Studix – Lern-App für Schule und Studium

Statische Web-App (kein Build-Schritt). Öffne `index.html` oder starte `npx http-server` (die Funktionen unter `/api` laufen nur auf Vercel).

- **/app** – Notizen-Editor (Formatierung, Tabellen, Formeln, Bilder, Checklisten), Zeichnen direkt in der Notiz (Stift, Marker, Radierer, Formen), Dateien & PDFs, Karteikarten (Spaced Repetition), Quiz, Planer (Aufgaben, Stundenplan, Kalender), Noten, Fokus-Timer, KI-Tutor, Suche, Backup/Import.
- **KI**: eigenen Anthropic-API-Key unter Einstellungen eintragen. Ohne Key laufen Zusammenfassung, Karteikarten und Quiz aus Dokumenten lokal.
- **Daten** liegen lokal im Browser (IndexedDB), funktionieren offline (Service Worker) und lassen sich als JSON exportieren.

## KI (Google Gemini über Vercel)
Die KI läuft serverseitig über `api/ai.js`. In Vercel unter *Settings → Environment Variables* `GEMINI_API_KEY` setzen (kostenloser Key: https://aistudio.google.com/apikey), optional `GEMINI_MODEL` (Standard `gemini-flash-lite-latest`), danach neu deployen. Der Key bleibt auf dem Server.

Die Sprachausgabe (Voice) läuft über OpenRouter mit HeyGen Voice Turbo (`api/tts.js`). In Vercel `OPENROUTER_API_KEY` setzen (https://openrouter.ai/keys); optional `OPENROUTER_TTS_MODEL` (Standard `heygen/heygen-voice-1-turbo:free`) und `OPENROUTER_TTS_VOICE` (Standard `nadine`). Ohne Key oder bei Fehlern nutzt Studix die Browser-Stimme „Thorsten“.

## Schule & Hochschule als KI-Wissen
Unter *Einstellungen → Profil → Schule & Hochschule* (und im AI-Chat über die Büroklammer → „Meine Schule …“) lassen sich bis zu drei Einrichtungen angeben, z. B. Harvard University oder eine Kantonsschule. Studix AI sucht Notensystem, Prüfungsformen und Schwerpunkte (mit Websuche, wenn Gemini verfügbar ist, sonst aus dem Modellwissen) und nutzt die Notizen als Hintergrundwissen für Chat, Sprachmodus, Lernziele, Quiz und das Feedback beim Zeichnen. Code: `schools.js`; der Kontext wird in `sysBase()` (`core.js`) angehängt und gilt als reine Daten, nie als Anweisung.

## KI-Popup im Zeichnen-Modus
Wer mit dem Lasso Gezeichnetes oder Handschrift auswählt, bekommt wie bei markiertem Text ein Popup mit Studix AI: Handschrift in Text verwandeln (an Ort und Stelle ersetzen oder ins Dokument bzw. als PDF-Anmerkung einfügen), von der KI neu zeichnen lassen, Formen begradigen (läuft ohne KI), Fehler prüfen, erklären oder frei fragen. Die Auswahl geht als Bild an die KI (Gemini; Vision). Code: `inkai.js`, Schnittstellen und der neue Strich-Typ „text“ in `ink.js`.

## Bezahlung (Studix Study Pro mit Stripe Managed Payments)
Abo-Zahlungen über Stripe Checkout mit Managed Payments (Stripe ist Verkäufer und übernimmt Mehrwertsteuer in 80+ Ländern). Das Abo wird live aus Stripe gelesen, nichts davon liegt in unserer Datenbank. Einrichtung Schritt für Schritt: [docs/PAYMENTS.md](docs/PAYMENTS.md). Rechtstexte: `legal.html` (Angaben in `config.js` → `legal`).

## Vercel CI

- `.github/workflows/vercel.yml`: Pull Requests -> Preview-Deployment (URL als PR-Kommentar), Push auf `main` -> Production.
- `.github/workflows/vercel-cleanup.yml`: bei jedem Push auf `main`, nach jedem erfolgreichen Deployment und woechentlich (So 03:17 UTC) loescht `scripts/cleanup-deployments.js` alle Deployments ausser den neuesten 10 (und nie das aktuelle Production-Deployment). Manuell startbar mit `keep` und `dry_run`.
- Benoetigte GitHub-Secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (Werte aus `vercel link` bzw. `.vercel/project.json`).
