# Contributing – jabs

> **Zielgruppe**: Menschliche Entwickler, die zum Projekt beitragen.
> **Zweck**: Setup, Workflow, Konventionen, Definition-of-Done.
> **Verwandt**: [`agent.md`](agent.md) (KI-Regelwerk – gilt sinngemäß auch für Menschen), [`GLOSSARY.md`](GLOSSARY.md) (Terminologie), [`docs/TESTING.md`](docs/TESTING.md) (Test-Strategie), [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) (Deployment).

---

## 1. Setup

### 1.1 Voraussetzungen

- **Node.js ≥ 20** (für Tests)
- **Git**
- **Beliebiger Browser** zum manuellen Spielen

Es gibt **keine** npm-`dependencies`, keinen Build-Schritt und keinen Package-Manager außer Node für Tests.

### 1.2 Klonen & Loslegen

```bash
git clone https://github.com/oliverbenduhn/jabs.git
cd jabs
npm test                  # Verifiziert, dass alles grün ist
python3 -m http.server 8080
# → http://localhost:8080
```

Öffne `index.htm` direkt, falls du keinen HTTP-Server willst – das Spiel funktioniert auch über `file://`.

### 1.3 Empfohlene Tools

| Zweck | Tool |
|---|---|
| Editor | VS Code oder Cursor |
| Live-Reload | Browser-Sync, `python3 -m http.server` + manueller Refresh, oder Live-Server-Extension |
| DevTools | Chromium DevTools (Canvas, Console, Mobile-Emulation) |
| Optional | Node ≥ 20 für `npm test` |

---

## 2. Architektur auf einen Blick

```
jabs/
├── index.htm              # HTML + CSS + JS – die gesamte Anwendung
├── index.html             # Redirect für GitHub Pages (index.htm → Root)
├── agent.md               # KI-Regelwerk
├── .cursorrules           # Cursor-Kurzregeln
├── GLOSSARY.md            # Terminologie (SSoT)
├── README.md              # Projekt-Übersicht
├── CHANGELOG.md           # Release-Notes
├── CONTRIBUTING.md        # Diese Datei
├── LICENSE                # MIT
│
├── docs/                  # Wiki + Referenz
│   ├── architecture.md    # Systemarchitektur
│   ├── game-mechanics.md  # Spiellogik im Detail
│   ├── TESTING.md         # Test-Strategie
│   ├── DEPLOYMENT.md      # Deployment-Guide
│   ├── PERFORMANCE.md     # Performance-Charakteristika
│   └── wiki/              # Detailseiten
│       ├── index.md
│       ├── data-model.md
│       ├── controls.md
│       ├── rendering.md
│       ├── powerups.md
│       └── level-system.md
│
├── test/                  # Dependency-freie Node-Tests
│   ├── check-syntax.mjs
│   └── logic-smoke.mjs
│
└── .github/
    └── workflows/
        └── test.yml       # CI: Node 20, npm test
```

### 2.1 Die goldene Regel

> **Neuer Spiel-Code gehört in `index.htm`.**

Die Single-File-Architektur ist kein Zufall. Sie ermöglicht deployment ohne Build-Pipeline, lädt sofort, ist trivial zu auditieren und reproduzierbar.

**Erlaubte Ausnahmen** (alle außerhalb von Spiel-Code):
- Dateien unter `docs/` (Dokumentation)
- Dateien unter `test/` (Tests)
- Dateien unter `.github/` (CI-Konfiguration)
- Asset-Dateien (Bilder, Fonts), falls je benötigt

Wenn du glaubst, dass eine Aufteilung von `index.htm` nötig ist, **eröffne zuerst ein Issue** mit Begründung.

---

## 3. Entwicklungs-Workflow

### 3.1 Branch-Naming

```
<typ>/<kurz-beschreibung>

Beispiele:
  fix/trajectory-edge-clamp
  feat/add-laser-powerup
  docs/glossary-update
  test/match-after-rowpush
```

Typen: `fix`, `feat`, `docs`, `test`, `refactor`, `perf`, `chore`.

### 3.2 Commit-Messages

Conventional Commits, auf Deutsch oder Englisch – Hauptsache konsistent innerhalb eines PRs:

```
fix: clampTrajektorie schneidet nicht mehr am Grid-Rand

- Update resolveAim verwendet gridLeftEdge/gridRightEdge
- Neue Substep-Logik verhindert Tunneling
- Smoke-Test "substep-collision" ergänzt
```

### 3.3 PR-Workflow

1. **Branch erstellen** vom aktuellen `main`.
2. **Implementieren** – Code, Tests, Doku.
3. **Lokal testen**: `npm test` muss grün sein.
4. **Manuell testen** im Browser (Desktop **und** Mobile-Emulation ≥ 320 px).
5. **Push** und **PR öffnen** mit Beschreibung.
6. **CI muss grün** sein, bevor ein Review sinnvoll ist.
7. **Mindestens ein Reviewer-Approval**, dann Squash-Merge.

### 3.4 Definition of Done

Ein PR ist mergebar, wenn:

- [ ] `npm test` ist grün (Syntax + alle Smoke-Tests).
- [ ] Neue Funktionalität hat einen **Smoke-Test** in `test/` (außer reine UI/Visuals).
- [ ] Keine globalen Event-Listener außerhalb von `setupEventListeners()`.
- [ ] Keine neuen Dependencies in `package.json`.
- [ ] `GLOSSARY.md` ist aktualisiert, falls neue Begriffe eingeführt wurden.
- [ ] Wiki (`docs/wiki/`) ist aktualisiert, falls Mechanik geändert wurde.
- [ ] Browser-Smoke-Test (Desktop ≥ 1024 px, Mobile ≤ 768 px) ist visuell verifiziert.
- [ ] Keine `console.log`-Debug-Statements im Diff.
- [ ] Keine Konflikt-Marker im Diff.
- [ ] Commit-Message folgt Conventional Commits.

---

## 4. Coding-Konventionen

Gilt für **menschliche** und KI-generierte Änderungen gleichermaßen. Detaillierte Liste: [`agent.md`](agent.md) §3.

### 4.1 Quick-Reference

```javascript
// Variablen
const bubble = this.grid[row][col];   // const > let > var
let shotsFired = 0;                   // nur wenn Re-Assignment nötig
// var ist verboten.

// Equality
if (bubble === null) { ... }          // === / !==
// == / != sind verboten.

// Strings
const msg = `Punkte: ${this.score}`;  // Template literals
// msg = "Punkte: " + this.score;      // verboten

// Early Return
if (!isValid) return [];
const result = computeMatches();
return result;
// Verschachtelung vermeiden.
```

### 4.2 Architektur-Checkliste (vor jedem Commit)

| Frage | Wenn nein → |
|---|---|
| Ist die neue Logik eine Instanz-Methode von `BubbleShooter`? | Refaktorieren |
| Nutzt die Topologie `getRowOffsetFlag(row)`? | `row % 2` ersetzen |
| Geht Aim durch `resolveAim()`? | Direkten `atan2` ersetzen |
| Mutiert die Logik das Grid? | Nur in `BubbleShooter`-Methoden erlaubt |
| DOM-Updates außerhalb von `updateUI()`? | In `updateUI()` verschieben |
| Schuss triggert Row-Push oder Game-Over? | In `resolveTurn()` verschieben |

### 4.3 Kommentare

- **Warum**, nicht **Was** – der Code zeigt das Was.
- Auf Deutsch (Projektkonvention).
- JSDoc für **öffentliche** Methoden (siehe `agent.md` §3.5).

```javascript
// ✅ Gut
// 480 px/s ≈ vorheriges festes 8px/Frame bei 60fps,
// jetzt zeitbasiert, damit Geschwindigkeit nicht von Hz abhängt.
const bubble = { ..., speed: 480 };

// ❌ Schlecht
// Setze Geschwindigkeit auf 480
bubble.speed = 480;
```

---

## 5. Tests

### 5.1 Schnellstart

```bash
npm test
```

Erwartete Ausgabe:

```
ok - index.htm inline script has valid JavaScript syntax
ok - getNeighbors stays consistent with rowOffsets after two addRow() pushes
ok - resolveAim clamps downward targets instead of passing them through
ok - shootBubble never launches a bubble downward
ok - placeBubble lands on a free neighbor of the collided bubble
ok - shootBubble does not push a row synchronously; resolveTurn does
ok - bomb charge is consumed on arm and blocks a second arm
ok - resetPowerUps() restores one charge per power-up

9 check(s) passed
```

Detaillierte Strategie: [`docs/TESTING.md`](docs/TESTING.md).

### 5.2 Was manuell getestet werden muss

Tests können **nicht** abdecken:

- Visuelle Korrektheit (Farben, 3D-Effekt, Layout)
- Touch-Gesten auf echten Mobile-Geräten
- Browser-spezifische Quirks
- Performance unter Last (lange Sessions, viele Bubbles)

**Checkliste für manuelle Verifikation**:
1. Desktop ≥ 1024 px: Spielen, Schießen, Match-3, Floating, Bombe, Game Over.
2. Mobile ≤ 768 px (DevTools-Emulation): Gleicher Flow + Touch-Drag-to-Aim.
3. Resize / Rotation während aktiver Bubble: Keine Teleportation.
4. Pause-Menü (`☰`): Spiel pausiert, Resume funktioniert, Focus zurück auf Menü-Button.
5. Hilfe (`?`): Lesbar, `Escape` schließt, Focus zurück auf Hilfe-Button.
6. Screenreader (VoiceOver/NVDA): Canvas hat Beschreibung, Buttons haben `aria-pressed`, Game Over wird angekündigt.

### 5.3 CI

GitHub Actions läuft `npm test` bei jedem Push und PR. Ein roter CI-Status blockt den Merge.

---

## 6. Dokumentation

### 6.1 Wann welche Datei aktualisieren?

| Änderung | Datei(en) |
|---|---|
| Neuer Begriff | `GLOSSARY.md` |
| Neue Mechanik | `docs/wiki/<topic>.md` + ggf. `GLOSSARY.md` |
| Architektur-Änderung | `docs/architecture.md` |
| Game-Logic-Änderung | `docs/game-mechanics.md` + `docs/wiki/data-model.md` |
| Neue Power-Up-Art | `docs/wiki/powerups.md` + `agent.md` §6.2 |
| Neue Tests | `docs/TESTING.md` (Coverage-Map) |
| Breaking Change | `CHANGELOG.md` + `README.md` (Status-Badge) |
| Performance-Regression | `docs/PERFORMANCE.md` |

### 6.2 Schreibstil

- **Kurz und präzise** – keine Prosa ohne Informationsgehalt.
- **Code-Beispiele statt Pseudocode** – wenn möglich direkt aus `index.htm`.
- **Tabellen** für vergleichende Listen.
- **Mermaid** für Diagramme (Architektur, Sequenz, ER).
- **Deutsch** für UI-Texte, Glossar, Kommentare. **Englisch** für Code-Bezeichner.

---

## 7. Häufige Fehler vermeiden

### 7.1 "Ich füge kurz eine Helper-Funktion außerhalb der Klasse hinzu"

→ **Nein**. Instanz-Methode werden.

### 7.2 "Ich nutze `row % 2` weil es einfacher ist"

→ **Nein**. `getRowOffsetFlag(row)`. Audit-Befund "Hoch – Row-Push desynchronisiert".

### 7.3 "Ich packe den Row-Push in `shootBubble()` weil er zeitlich passt"

→ **Nein**. `resolveTurn()`. Audit-Befund "Fünfter Schuss kann Game-Over auslösen".

### 7.4 "Ich baue eine separate Touch-Logik"

→ **Nein**. Pointer Events. Audit-Befund "Touch schießt vor Aim".

### 7.5 "Ich speichere Score in localStorage"

→ **Nein**, solange nicht explizit angefordert. Audit-Befund "Dokumentationsinkonsistenz".

### 7.6 "Ich verwende Pixi für die vielen Bubbles"

→ **Nein**. Vanilla Canvas reicht. Substep-Collision + Delta-Time sind die richtigen Antworten.

### 7.7 "Ich entferne Hilfe- und Menü-Button weil sie nichts tun"

→ Erst implementieren, dann entfernen. Audit-Befund "Hilfe und Menü sind Sackgassen".

---

## 8. Wo Hilfe holen

- **Konzeptfragen**: [`docs/architecture.md`](docs/architecture.md), [`docs/wiki/`](docs/wiki/)
- **Begriffsfragen**: [`GLOSSARY.md`](GLOSSARY.md)
- **Testfragen**: [`docs/TESTING.md`](docs/TESTING.md)
- **KI-spezifische Regeln**: [`agent.md`](agent.md)
- **Audit-Historie**: [`master-audit-2026-07-26.md`](master-audit-2026-07-26.md)
- **Issue-Tracker**: GitHub Issues

---

## 9. Code of Conduct

Standard-Erwartungen: respektvoller Umgang, konstruktives Feedback, kein Toleranzraum für Belästigung. Maintainer-Entscheidungen sind endgültig; bei Bedarf via GitHub-Diskussion eskalieren.