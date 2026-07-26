# jabs – just another bubble shooter

Ein klassischer Bubble-Shooter als **Single-Page-Webanwendung** – komplett in Vanilla JavaScript, ohne externe Abhängigkeiten.

<p align="center">
  <img src="https://img.shields.io/badge/status-audited%20%26%20release--ready-brightgreen" alt="Status">
  <img src="https://img.shields.io/badge/JS-ES6%2B-%23f7df1e" alt="JavaScript">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License">
  <img src="https://img.shields.io/badge/dependencies-0-success" alt="Zero Dependencies">
  <img src="https://img.shields.io/badge/tests-9%20passing-success" alt="Tests">
  <img src="https://img.shields.io/badge/single--file-1%20htm-informational" alt="Single File">
</p>

---

## Übersicht

**jabs** ist ein Bubble-Shooter im Endlos-Modus. Du schießt farbige Bubbles auf ein hexagonales Gitter. Sobald drei oder mehr gleichfarbige Bubbles eine Gruppe bilden, platzen sie. Nicht verbundene Bubbles fallen herunter. Ziel ist es, so lange wie möglich zu überleben und einen Highscore zu erreichen. Ein "Level" ist dabei kein Sieg-Zustand, sondern ein Meilenstein: Räumst du das Grid komplett leer, beginnt ein neues, ebenso schwieriges Grid und der Level-Zähler steigt – der Endlos-Modus selbst geht ohne Unterbrechung weiter.

### Features

| Feature | Beschreibung |
|---|---|
| 🎯 **Bubble-Physik** | Bubbles prallen von Wänden ab – framerate-unabhängige Geschwindigkeit (480 px/s) |
| 🔷 **Hexagonales Gitter** | Versetzte Reihen (offset rows) für authentisches Bubble-Shooter-Layout |
| 🔴 **Match-3+ Mechanik** | 3 oder mehr gleichfarbige Bubbles werden aufgelöst, Floating Bubbles fallen |
| 🎈 **Schwebende Bubbles** | Nicht verbundene Bubbles fallen nach Matches automatisch (5 Pkt/Bubble) |
| 📐 **Zielhilfe** | Gestrichelte SVG-Linie zeigt Schussrichtung an, winkelbegrenzt |
| 🔮 **Bubble-Warteschlange** | 5 nächste Bubbles werden angezeigt |
| ⬆️ **Level-System** | Automatischer Aufstieg nach Leeren des Spielfelds |
| 💣 **Power-Ups** | Zielhilfe (🎯) und Bombe (💣) mit begrenzten Aufladungen pro Level |
| 🎨 **Colorblind-Accessibility** | Jede Farbe hat ein eindeutiges Glyph, Matching ist nicht farbabhängig |
| 📱 **Responsive Design** | Desktop (Maus/Tastatur) und Mobile (Touch/Pointer Capture) |
| 🧪 **Getestet** | 8 Smoke-Tests + Syntax-Check in CI |
| ♿ **Accessibility** | Pointer Events, Tastatur-Bedienung, ARIA-Labels, Dialog-Semantik |
| 📏 **Zero Dependencies** | Keine npm-Pakete, kein Build-Tool, kein Framework |
| 🎯 **Single Source of Truth** | Strikte Architektur (`resolveAim`, `getRowOffsetFlag`, `resolveTurn`) |

### Tech-Stack

| Komponente | Technologie |
|---|---|
| **Sprache** | Vanilla JavaScript (ES6+ Klasse) |
| **Rendering** | HTML5 Canvas (Bubbles), SVG (Trajektorie) |
| **Layout** | CSS3 (Flexbox, `calc()`, Custom Properties, `100dvh`) |
| **Tests** | Node ≥ 20 (`node:vm`, dependency-frei) |
| **CI** | GitHub Actions |
| **Build** | Keiner – direkt ausführbar |
| **Abhängigkeiten** | Keine – zero dependencies |

---

## Quickstart

Da es sich um eine reine Client-Anwendung handelt, gibt es keinen Build-Prozess.

### Variante A: Direkt öffnen

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

| Aktion | Desktop | Mobile | Tastatur |
|---|---|---|---|
| Zielen | Maus bewegen | Finger auf Display ziehen | `←` / `→` |
| Schießen | Linksklick | Loslassen nach Ziehen | `Leertaste` / `Enter` |
| Zielhilfe (🎯) | Klick auf Button | Tap auf Button | – |
| Bombe (💣) | Klick auf Button | Tap auf Button | – |
| Hilfe (?) | Klick auf Button | Tap auf Button | – |
| Pause (☰) | Klick auf Button | Tap auf Button | `Escape` |
| Neustart | Button im Overlay | Button im Overlay | – |

**Pointer Events**: Maus und Touch laufen über denselben Code-Pfad mit Pointer Capture – Touch-Nutzer können ziehen und dann loslassen, statt beim ersten Kontakt blind zu schießen.

**Winkel-Limit**: Standard ±72°, mit Zielhilfe ±100°.

---

## Spielmechanik

Das Spiel verwendet ein **hexagonales Gitter** mit 15 Spalten und versetzten Reihen. Alle 5 Schüsse rückt eine neue Reihe von oben nach.

- **Match-3+**: 3+ gleichfarbige Bubbles in einer Gruppe werden entfernt (10 Pkt/Bubble)
- **Floating Bubbles**: Bubbles ohne Verbindung zur obersten Reihe fallen herunter (5 Pkt/Bubble)
- **Game Over**: Wenn Bubbles die untere Grenze (`shooter.y - 2 × radius`) erreichen
- **Next Level**: Wenn das gesamte Spielfeld geleert ist, gibt es den nächsten Level
- **Bombe**: Entfernt die getroffene Bubble + alle 6 Hex-Nachbarn (15 Pkt/Bubble)

### Punkte-System

| Aktion | Punkte |
|---|---|
| Match (3+ Bubbles) | 10 pro Bubble |
| Schwebende Bubbles fallen | 5 pro Bubble |
| Bomben-Explosion | 15 pro getroffener Bubble |

### Architektur-Garantien

- **`resolveAim()`**: Alle Aim-Pfade (Maus, Touch, Tastatur, Schuss) clampen den Winkel auf `±currentAngleLimit`. Keine Abwärtsschüsse.
- **`resolveTurn()`**: Row-Push und Game-Over passieren erst nach vollständiger Schuss-Auflösung. Keine Race-Conditions.
- **`getRowOffsetFlag(row)`**: Hex-Topologie folgt `rowOffsets`, nicht `row % 2`. Stimmig vor und nach `addRow()`.
- **`updateUI()`**: Einziger Ort für DOM-Updates aus dem Gameplay.

---

## Tests

```bash
npm test
```

Führt einen JavaScript-Syntaxcheck sowie 8 dependency-freie Node-Tests für die Kern-Spiellogik aus:

1. Hex-Nachbarschaft nach `addRow()`-Pushes
2. `resolveAim()` clampt Abwärtsziele
3. `shootBubble()` startet nie abwärts
4. `placeBubble()` platziert lokal, nicht global
5. `resolveTurn()` ist SSoT für Schuss-Abschluss
6. Power-Up-Charges werden beim Arming verbraucht
7. `resetPowerUps()` füllt die Aufladungen wieder auf
8. Spielstand (Grid, Score, Level und Charges) wird nach Reload wiederhergestellt

Läuft auch in CI (`.github/workflows/test.yml`). Details: [`docs/TESTING.md`](docs/TESTING.md).

---

## Dokumentation

| Dokument | Zielgruppe | Zweck |
|---|---|---|
| **[`README.md`](README.md)** | Mensch | Diese Datei – Einstieg, Features, Quickstart |
| **[`CONTRIBUTING.md`](CONTRIBUTING.md)** | Mensch | Entwickler-Workflow, Konventionen, Definition of Done |
| **[`CHANGELOG.md`](CHANGELOG.md)** | Mensch | Versionierte Release-Notes |
| **[`LICENSE`](LICENSE)** | – | MIT-Lizenz |
| **[`GLOSSARY.md`](GLOSSARY.md)** | Mensch + KI | Strikte Terminologie-Definitionen (SSoT) |
| **[`agent.md`](agent.md)** | KI | KI-Regelwerk: Architektur, Anti-Patterns, Conventions |
| **[`.cursorrules`](.cursorrules)** | KI (Cursor) | Deklarative Kurzregeln |
| **[`REFACTORING.md`](REFACTORING.md)** | KI + Mensch | Sichere Refactoring-Rezepte |
| **[`docs/architecture.md`](docs/architecture.md)** | Mensch | Systemarchitektur, Datenfluss, Schichten |
| **[`docs/game-mechanics.md`](docs/game-mechanics.md)** | Mensch | Spiellogik im Detail |
| **[`docs/TESTING.md`](docs/TESTING.md)** | Mensch | Test-Strategie, Coverage-Map |
| **[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)** | Mensch | GitHub Pages, Netlify, Vercel, Nginx, Apache |
| **[`docs/PERFORMANCE.md`](docs/PERFORMANCE.md)** | Mensch | Frame-Budget, Substeps, Mobile-Limits |
| **[`docs/wiki/`](docs/wiki/index.md)** | Mensch | Detailseiten (Data-Model, Controls, Rendering, Power-Ups, Level-System) |

---

## Deployment

Da es sich um eine statische Datei handelt, kann `index.htm` auf **jeden statischen Webserver** deployed werden:

- **GitHub Pages** – `index.html` leitet auf `index.htm` um, damit die Pages-Root-Auflösung nicht mit 404 endet. Workflow-Konfiguration: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) §3.
- **Netlify** – direktes Upload / Git-Import (`netlify.toml` optional).
- **Vercel** – statisches Hosting (`vercel.json` optional).
- **Nginx / Apache** – Datei ins Document-Root kopieren (Konfiguration in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)).
- **Custom Domain** – siehe [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) §9.

**Health-Check nach Deploy**: 9 Tests grün (1 Syntax-Check + 8 Smoke-Tests), Browser lädt Canvas, keine 404 in der Console.

---

## Lizenz

[MIT](LICENSE) © 2025 Oliver Benduhn

---

## Mitwirkende

- **Oliver Benduhn** – Projekt-Erfinder und Maintainer
- **Codex/Claude** – Audit (`master-audit-2026-07-26.md`) und iterative Fixes

Beiträge sind willkommen – siehe [`CONTRIBUTING.md`](CONTRIBUTING.md).