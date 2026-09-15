# APEX AIM — Web Aim Trainer

Ein Apex-Legends-artiger Aim Trainer für den Browser, in Ego-Shooter-Perspektive.
Gebaut mit **Three.js / WebGL** und auf **flüssige 60 FPS** optimiert.

![Modi](https://img.shields.io/badge/Modi-4-red) ![Waffen](https://img.shields.io/badge/Waffen-3-orange) ![FPS-Ziel-60-green](https://img.shields.io/badge/FPS--Ziel-60-green)

## Features

- **4 Trainingsmodi**
  - **Flick / Clicking** – statische Ziele blitzschnell treffen, misst Reaktionszeit
  - **Tracking** – strafendes Ziel im Beam halten (Smoothness)
  - **Target Switching** – mehrere Ziele, schnelles Umsetzen
  - **Strafe-Duell** – ein Bot springt, strafed und schießt zurück (echtes 1v1-Gefühl)
- **3 Apex-angelehnte Waffen** mit echtem Recoil-Verhalten, Feuerrate, Magazin & Nachladen
  - R-99 (SMG), VK-47 Flatline (AR), Wingman (Pistole)
- **Live-Stats**: Score, Accuracy, Ø-Reaktionszeit, Kills, Headshots, HP
- **Persönliche Bestwerte** pro Modus (lokal im Browser gespeichert)
- **Einstellungen**: Maus-Sensitivität, FOV, Y-Invert, komplett konfigurierbares Fadenkreuz,
  Zielgröße, Lautstärke
- **Performance-Werkzeuge**: FPS-Anzeige, Perf-Modus, AA-/Schatten-Toggle, 60-FPS-Cap
- **Synthetische Sounds** (WebAudio, keine Asset-Downloads nötig)

## Starten

Am einfachsten über den mitgelieferten Mini-Server (kein `npm install` nötig):

```bash
node server.js
# oder
npm start
```

Dann im Browser öffnen: **http://localhost:8080**

Alternativen:

```bash
python3 -m http.server 8080     # dann http://localhost:8080
```

> Wichtig: Über einen HTTP-Server öffnen (nicht die Datei direkt per `file://`),
> damit die ES-Module und der Pointer-Lock zuverlässig funktionieren.

## Steuerung

| Taste | Aktion |
|-------|--------|
| **Maus** | Zielen (Pointer Lock) |
| **Linke Maustaste** | Schießen (halten bei Auto-Waffen) |
| **W A S D** | Bewegen / Strafen |
| **Leertaste** | Springen |
| **R** | Nachladen |
| **Esc** | Pause (gibt die Maus frei) |

Nach dem Klick auf **Spielen** wird die Maus „gefangen“ (Pointer Lock). Mit **Esc**
pausierst du; ein Klick auf *Weiter* fängt die Maus wieder ein.

## Technik & 60-FPS-Fokus

- Reine ES-Module, Three.js via CDN-ImportMap – kein Build-Schritt.
- Günstige Beleuchtung (Hemisphere + eine Directional Light), Schatten optional.
- Objekt-Pooling für Ziele, wenige Draw-Calls, `powerPreference: high-performance`.
- Delta-Time-basierte Spiel-Logik, optionaler 60-FPS-Cap für 120/144-Hz-Displays.
- DOM-Fadenkreuz (gestochen scharf, kostet keine GPU-Zeit).

## Projektstruktur

```
index.html          # Markup: Canvas, Menüs, HUD
css/styles.css      # UI-/HUD-Styling
js/main.js          # Game-Loop, Input, Pointer-Lock, Feuer-Logik
js/scene.js         # Three.js-Szene, Arena, Licht, Renderer
js/player.js        # FPS-Kamera, Bewegung, Recoil
js/weapons.js       # Waffen-Definitionen & Recoil-Pattern
js/targets.js       # Ziel-Pool + Bot (Duell)
js/modes.js         # Spielmodi & Statistik
js/ui.js            # Menüs, HUD, Settings-Binding, Fadenkreuz
js/settings.js      # Einstellungen + Persistenz
js/storage.js       # Bestwerte (localStorage)
js/audio.js         # Synthetische WebAudio-Sounds
server.js           # Statischer Mini-Server (0 Abhängigkeiten)
```

## Lizenz

MIT
