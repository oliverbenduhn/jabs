# jabs – just another bubble shooter

Ein klassischer Bubble-Shooter als **Single-Page-Webanwendung** – komplett in Vanilla JavaScript, ohne externe Abhängigkeiten.

<p align="center">
  <img src="https://img.shields.io/badge/status-funktional-brightgreen" alt="Status">
  <img src="https://img.shields.io/badge/JS-ES6%2B-%23f7df1e" alt="JavaScript">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License">
  <img src="https://img.shields.io/badge/dependencies-0-success" alt="Zero Dependencies">
</p>

---

## Übersicht

**jabs** ist ein Bubble-Shooter im Endlos-Modus. Du schießt farbige Bubbles auf ein hexagonales Gitter. Sobald drei oder mehr gleichfarbige Bubbles eine Gruppe bilden, platzen sie. Nicht verbundene Bubbles fallen herunter. Ziel ist es, so lange wie möglich zu überleben und einen Highscore zu erreichen. Ein "Level" ist dabei kein Sieg-Zustand, sondern ein Meilenstein: Räumst du das Grid komplett leer, beginnt ein neues, ebenso schwieriges Grid und der Level-Zähler steigt – der Endlos-Modus selbst geht ohne Unterbrechung weiter.

### Features

| Feature | Beschreibung |
|---|---|
| 🎯 **Bubble-Physik** | Bubbles prallen von Wänden ab – realistische Flugbahn |
| 🔷 **Hexagonales Gitter** | Versetzte Reihen (offset rows) für authentisches Bubble-Shooter-Layout |
| 🔴 **Match-3+ Mechanik** | 3 oder mehr gleichfarbige Bubbles werden aufgelöst |
| 🎈 **Schwebende Bubbles** | Nicht verbundene Bubbles fallen nach Matches automatisch |
| 📐 **Zielhilfe** | Gestrichelte Linie zeigt Schussrichtung an |
| 🔮 **Bubble-Warteschlange** | 5 nächste Bubbles werden angezeigt |
| ⬆️ **Level-System** | Automatischer Aufstieg nach Leeren des Spielfelds |
| 💣 **Power-Ups** | Zielhilfe (🎯) und Bombe (💣) für taktische Spielzüge |
| 📱 **Responsive Design** | Desktop (Maus) und Mobile (Touch) – vollständig optimiert |

### Tech-Stack

| Komponente | Technologie |
|---|---|
| **Sprache** | Vanilla JavaScript (ES6+ Klasse) |
| **Rendering** | HTML5 Canvas (Bubbles), SVG (Trajektorie) |
| **Layout** | CSS3 (Flexbox, `calc()`, Custom Properties) |
| **Abhängigkeiten** | Keine – zero dependencies |

---

## Quickstart

Da es sich um eine reine Client-Anwendung handelt, gibt es keinen Build-Prozess.

### Variante A: Lokal öffnen

```bash
git clone https://github.com/oliverbenduhn/jabs.git
cd jabs
open index.htm        # macOS
xdg-open index.htm    # Linux
start index.htm       # Windows
```

### Variante B: Lokaler HTTP-Server (empfohlen)

```bash
cd jabs
python3 -m http.server 8080
# → http://localhost:8080
```

### Variante C: Node.js Serve

```bash
npx serve jabs
```

---

## Steuerung

| Aktion | Desktop | Mobile |
|---|---|---|
| Zielen | Maus bewegen | Finger auf Display bewegen |
| Schießen | Linksklick | Touch |
| Zielhilfe (🎯) | Klick auf Button | Tap auf Button |
| Bombe (💣) | Klick auf Button | Tap auf Button |

---

## Spielmechanik

Das Spiel verwendet ein **hexagonales Gitter** mit 15 Spalten und versetzten Reihen. Alle 5 Schüsse rückt eine neue Reihe von oben nach.

- **Match-3+**: 3+ gleichfarbige Bubbles in einer Gruppe werden entfernt
- **Floating Bubbles**: Bubbles ohne Verbindung zur obersten Reihe fallen herunter
- **Game Over**: Wenn Bubbles die untere Grenze (Höhe der Shooter-Position) erreichen
- **Next Level**: Wenn das gesamte Spielfeld geleert ist, gibt es den nächsten Level

### Punkte-System

| Aktion | Punkte |
|---|---|
| Match (3+ Bubbles) | 10 pro Bubble |
| Schwebende Bubbles fallen | 5 pro Bubble |
| Bomben-Explosion | 15 pro getroffener Bubble |

---

## Tests

```bash
npm test
```

Führt einen JavaScript-Syntaxcheck sowie dependency-freie Node-Tests für die Kern-Spiellogik aus (Hex-Nachbarschaft, Zielwinkel-Begrenzung, Kollisions-Platzierung, Turn-Reihenfolge, Power-up-Charges). Läuft auch in CI (`.github/workflows/test.yml`).

## Deployment

Da es sich um eine statische Datei handelt, kann `index.htm` auf **jeden statischen Webserver** deployed werden:

- **GitHub Pages** – Push in `gh-pages`-Branch; `index.html` leitet auf `index.htm` weiter, damit die Pages-Root-Auflösung nicht mit 404 endet
- **Netlify / Vercel** – direktes Upload / Git-Import
- **Nginx / Apache** – Datei ins Document-Root kopieren

---

## Lizenz

[MIT](LICENSE) © 2025 Oliver Benduhn
