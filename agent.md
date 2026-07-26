# agent.md – KI-Regelwerk für jabs

> **Zielgruppe**: KI-Agenten (Claude, Cursor, Copilot, lokale Modelle), die Code-Änderungen an diesem Repository vornehmen.
> **Zweck**: Minimale Reibung, konsistente Patterns, keine Architektur-Verstöße, keine Audit-Regressionen.
> **Verwandt**: [`GLOSSARY.md`](GLOSSARY.md) (Terminologie), [`docs/architecture.md`](docs/architecture.md) (System), [`docs/wiki/`](docs/wiki/) (Datenmodell, Mechanik).
> **Audit-Stand**: `master-audit-2026-07-26.md` wurde umgesetzt – die hier kodifizierten Regeln sind die **direkten Konsequenzen** der Audit-Befunde.

---

## 0. Vor jeder Änderung

1. Lies diese Datei vollständig.
2. Lies [`GLOSSARY.md`](GLOSSARY.md), wenn ein domänenspezifischer Begriff unklar ist.
3. Konsultiere [`docs/wiki/data-model.md`](docs/wiki/data-model.md) für Fragen zum State.
4. Führe `npm test` aus, **bevor** du committest. Alle 8 Smoke-Tests müssen grün sein.

---

## 1. Projekt-Kontext

- **Projekt**: `jabs` – Bubble-Shooter in **einer** HTML-Datei (`index.htm`).
- **Zero Dependencies**: Keine npm-Pakete, kein Build-Tool, kein Framework. Reinster Vanilla JS.
- **Single-File**: Die gesamte Anwendung (HTML, CSS, JS) lebt in `index.htm`. Neue Funktionalität wird dort integriert – es sei denn, eine explizite, dokumentierte Entscheidung zur Aufteilung wird getroffen.
- **Sprache**: Deutsch für UI-Texte und Kommentare. Englisch nur für Code-Bezeichner und Standard-APIs.
- **Test-Stack**: `node --check` + dependency-freie `vm`-basierte Tests. **Kein** Jest, Mocha, Vitest.

---

## 2. Architektur-Regeln (NICHT VERLETZBAR)

### 2.1 Klassen-Struktur

Die gesamte Spiellogik ist in **einer** Klasse gekapselt: `BubbleShooter`. Alle neuen Funktionalitäten MÜSSEN als Instanz-Methoden dieser Klasse implementiert werden.

```javascript
class BubbleShooter {
    constructor()       // Canvas-Setup, Event-Listener, init
    initializeGame()    // Grid, Bubbles, UI – einmalig
    gameLoop()          // requestAnimationFrame-Schleife
    // … alle weiteren Methoden als Instanzmethoden
}
```

**Anti-Pattern (verboten)**:
- ❌ Globale Funktionen oder Variablen außerhalb der Klasse
- ❌ Zweite Spiel-Klasse, Mixins, Helper-Module
- ❌ Direkte DOM-Manipulation von außerhalb der Klasse (alle DOM-Updates über `updateUI()`)

### 2.2 Single Source of Truth (SSoT)

Jede Information hat **genau eine** autoritative Quelle. Mehrere konkurrierende Quellen für dieselbe Information haben in der Vergangenheit zu Audit-Befunden geführt.

| Information | SSoT | Verboten |
|---|---|---|
| Hex-Topologie / Reihen-Offset | `this.rowOffsets[row]` + `getRowOffsetFlag(row)` | `row % 2` für Nachbarschaft oder Position |
| Aim-Winkel und Richtung | `resolveAim(targetX, targetY)` | Direkter `Math.atan2` in `shootBubble()`, `handlePointerMove()` etc. |
| Grid-Position einer Bubble | `getBubblePosition(row, col)` | Hartcodierte Koordinaten-Formeln |
| DOM-Refresh | `updateUI()` | Direkte `textContent`/`style`-Zuweisungen in Gameplay-Methoden |
| Pointer-Down/Move/Up | `pointer*`-Events | Parallele `mousemove`/`touchmove`-Pfade |

### 2.3 State-Management

Der gesamte Spielzustand lebt als **Instanz-Eigenschaften** in `BubbleShooter`. Kein externer State.

```javascript
this.grid               // 2D-Array: grid[row][col] = { color, x, y, radius } | undefined
this.rowOffsets         // number[]: 0 oder 1 pro Reihe
this.activeBubble       // Fliegende Bubble | null
this.shooter            // { x, y, angle }
this.score              // number
this.level              // number
this.gameRunning        // boolean
this.paused             // boolean
this.shotsFired         // number
this.shotsPerRow        // number (5)
this.bombArmed          // boolean
this.aimAssistShots     // number
this.bombCharges        // number
this.aimCharges         // number
this.maxPowerUpCharges  // number (1)
this.currentAngleLimit  // number
this.baseAngleLimit     // number (π/2.5)
this.aimAngleLimit      // number (π/1.8)
```

**Anti-Pattern (verboten)**:
- ❌ DOM-Elemente als State-Container (`data-*`-Attribute für Spielzustand)
- ❌ `window`-Properties für Spielvariablen
- ❌ UI-State (z. B. `active`-Klassen) als alleinige Quelle der Wahrheit
- ❌ `localStorage` / `sessionStorage` ohne explizite Anforderung

### 2.4 Grid-Modell

Das hexagonale Grid ist ein **2D-Array** (Array von Arrays). Jede Zelle ist entweder ein Bubble-Objekt oder `undefined`.

```javascript
this.grid = [
    [ { color: '#ff595e', x: 30, y: 30, radius: 20 }, { color: '#ffca3a', ... }, ... ],
    [ ... ],
]
```

- **Reihen-Offset**: Gecached in `this.rowOffsets[row]` (0 oder 1). Berechnung über `getRowOffsetFlag(row)`.
- **Löschen**: `delete this.grid[row][col]` – nie `null`, `''`, `0` oder `false`.
- **Zeilen-Index** = Reihe von oben (`grid[0]` = oberste Reihe, **Top Row**).
- **Neue Reihen** werden per `grid[0] = newRow` oben eingefügt (`addRow`), bestehende Reihen rücken um 1 nach unten.

### 2.5 Datenfluss

```
Input (Pointer/Tastatur) → Event-Handler → resolveAim() → updateTrajectory()/shootBubble()
                                                                          ↓
                                                              gameLoop(deltaMs)
                                                                          ↓
                                                    updateActiveBubble → placeBubble
                                                                          ↓
                                                          checkMatches → removeFloatingBubbles
                                                                          ↓
                                                                  resolveTurn
                                                                          ↓
                                                            addRow / checkWin / checkGameOver
                                                                          ↓
                                                                       updateUI
```

**Regeln**:
- UI-Updates (Score, Level, Queue-Bubbles) erfolgen NUR über `updateUI()`.
- Pointer/Tastatur-Events rufen `resolveAim()` auf, niemals direkte Winkel-Berechnungen.
- Turn-Resolution erfolgt NUR in `resolveTurn()`, niemals in `shootBubble()`.

### 2.6 Turn Resolution (audit-fixiert)

`shootBubble()` erhöht **ausschließlich** den `shotsFired`-Zähler. Es löst **keinen** Row-Push, **keine** Game-Over-Prüfung und **keine** Power-Up-Logik aus.

```javascript
// shootBubble():
this.activeBubble = ...;       // fliegende Bubble
this.nextBubble();             // Queue rotieren
this.shotsFired++;             // Zähler erhöhen
// KEIN addRow(), KEIN checkGameOver(), KEIN resolveTurn()

// placeBubble() (am Ende beider Zweige):
this.resolveTurn();
```

`resolveTurn()` entscheidet erst **nach** vollständiger Platzierung, Match- und Floating-Auflösung:
1. `checkWinCondition()` → ggf. `nextLevel()` (return)
2. `shotsFired % shotsPerRow === 0` → `addRow()`
3. Sonst `checkGameOver()`

### 2.7 Aim Resolution (audit-fixiert)

**Alle** Aim-Pfade – Maus/Touch via `handlePointerMove`, Tastatur via `handleKeyDown`, Schuss via `shootBubble` – rufen **`resolveAim(targetX, targetY)`** auf. Die Methode clampst die Winkel-Differenz zur Aufwärtsachse auf `±currentAngleLimit` und liefert `{ angle, dirX, dirY }`.

```javascript
resolveAim(targetX, targetY) {
    const dx = targetX - this.shooter.x;
    const dy = targetY - this.shooter.y;
    const upAngle = -Math.PI / 2;
    let delta = Math.atan2(dy, dx) - upAngle;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;

    delta = Math.max(-this.currentAngleLimit, Math.min(this.currentAngleLimit, delta));

    const angle = upAngle + delta;
    return { angle, dirX: Math.cos(angle), dirY: Math.sin(angle) };
}
```

**Verboten**: Zweite, unbegrenzte Aim-Berechnung an einer anderen Stelle. Dies ist die einzige Stelle, an der `Math.atan2` für Schussrichtungen verwendet wird.

---

## 3. Coding Conventions

### 3.1 JavaScript

| Regel | Vorgabe |
|---|---|
| **Sprachlevel** | ES6+ (class, arrow functions, destructuring, optional chaining) |
| **Variablen** | `const` > `let` > `var` (verboten) |
| **Arrow Functions** | Bevorzugt für Callbacks und kurze Funktionen |
| **Namenskonvention** | `camelCase` für Variablen/Methoden, `PascalCase` für Klassen |
| **Early Returns** | Immer – verschachtelte if-else vermeiden |
| **Typ-Check** | Explizit: `===` / `!==` (nie `==` / `!=`) |
| **Optional Chaining** | Nutzen wo sinnvoll: `this.grid[row]?.[col]` |
| **String-Interpolation** | Template Literals (`` `${var}` ``) statt `+`-Konkatenation |
| **Magic Numbers** | Siehe §3.4 |
| **JSDoc** | Siehe §3.5 |

```javascript
// ✅ Gut
const isValid = bubble && bubble.color === color;
if (!isValid) return [];

// ❌ Schlecht
if (bubble != null) {
    if (bubble.color == color) {
        // ...
    }
}
```

### 3.2 CSS

| Regel | Vorgabe |
|---|---|
| **Box-Modell** | Immer `box-sizing: border-box` |
| **Layout** | Flexbox (`display: flex`) – kein Float |
| **Variablen** | CSS Custom Properties (`:root`) für themische Werte |
| **Responsive** | Mobile-First: `@media (max-width: 768px)` für Breakpoints |
| **Selektor-Spezifität** | Klassen-Selektoren bevorzugen, `id` nur für JS-Zugriff |

### 3.3 HTML

| Regel | Vorgabe |
|---|---|
| **Semantik** | `<div>` nur als Container; `<button type="button">` für alle klickbaren Controls |
| **IDs** | Nur für JS-Referenzen (Canvas, Overlay, Buttons) |
| **Canvas** | Einziges `<canvas id="gameCanvas">` – alles Rendering darüber |
| **Accessibility** | `aria-label`, `aria-pressed`, `aria-modal`, `role="dialog"` wo passend |

### 3.4 Magic Numbers

Konstanten mit semantischer Bedeutung gehören in den Konstruktor oder an den Anfang der Klasse – nicht inline:

```javascript
// ✅ Gut
this.shotsPerRow = 5;          // Schüsse pro neuer Reihe
this.maxPowerUpCharges = 1;    // Aufladungen pro Power-Up pro Level
const SHOOTER_SPEED_PX_PER_S = 480;
const COLLISION_SUBSTEP_FACTOR = 0.5;

// ❌ Schlecht
if (this.shotsFired % 5 === 0) { ... }
```

**Erlaubte inline-Magic-Numbers**: 0, 1, -1, 2, π, √2, √3 – alles mit offensichtlicher Bedeutung.

**Magic Numbers, die nicht extrahiert werden dürfen** (audit-relevant):
- `15` (`fixedColumns`/`columnCount`) → bereits als Instanz-Property
- `8` (`initialRows`) → bereits als Instanz-Property
- `10` (`bottomFreeRows`) → bereits als Instanz-Property
- `60` (`+60` in `lightenColor`, `-40` in `darkenColor`) → dokumentierter Pixel-Offset für Bubble-Highlight, akzeptabel inline

### 3.5 JSDoc-Konvention

Jede **öffentliche** Methode der `BubbleShooter`-Klasse erhält eine JSDoc-Annotation. Private Helfer (mit führendem `_` oder als Closure) benötigen keine Annotation.

```javascript
/**
 * Findet alle Bubbles derselben Farbe, die über Hex-Nachbarschaft verbunden sind.
 *
 * @param {number} row  Start-Zeile
 * @param {number} col  Start-Spalte
 * @param {string} color Zu matchende HEX-Farbe
 * @param {Set<string>} [visited=new Set()] Bereits besuchte Zellen
 * @returns {Array<{r:number, c:number}>} Liste der gefundenen Positionen
 */
findMatches(row, col, color, visited = new Set()) { ... }
```

**Pflichtfelder**: `@param` für jeden Parameter (Typ + Beschreibung), `@returns` für nicht-`void` Methoden.

---

## 4. Validierungs- und Sicherheits-Regeln

### 4.1 Canvas-Größe
`resizeCanvas()` MUSS bei Window-Resize und Initialisierung aufgerufen werden. Aktualisiert `bubbleRadius`, `gridWidth`, `gridLeftEdge`/`gridRightEdge`.

### 4.2 Kollisionserkennung
- Distanz-Check: `distance < radiusA + radiusB` (siehe `checkCollision()`).
- Substep-Bewegung: `steps = min(50, max(1, ceil(stepDistance / (radius * 0.5))))`.
- Rückgabe: `{ row, col }` der getroffenen Grid-Bubble oder `null`.
- `placeBubble(bubble, collision)` muss das **Collision-Objekt** verwenden, um einen freien **lokalen Nachbarn** zu finden (nicht die global nächste leere Zelle).

### 4.3 Winkelbegrenzung
- `baseAngleLimit = π / 2.5` (~72°) – Standard.
- `aimAngleLimit = π / 1.8` (~100°) – Zielhilfe.
- `currentAngleLimit` wird zwischen beiden umgeschaltet.
- Alle Aim-Pfade über `resolveAim()` clampen.

### 4.4 Aim-Clamping
`clampAimX(x)` stellt sicher, dass der Mauszeiger nicht außerhalb der Grid-Grenzen liegt.

### 4.5 Power-Up-Charges (audit-fixiert)

| Aktion | Effekt auf `*Charges` | Effekt auf `armed/active` |
|---|---|---|
| Button-Klick, erste Aktivierung | `charge--` | `armed/active = true` |
| Button-Klick, Toggle-Aus | unverändert | `armed/active = false` |
| Re-Klick nach Verbrauch | unverändert | unverändert (`charge === 0`) |
| Schuss (`shootBubble`) mit aktiver Zielhilfe | unverändert | `aimAssistShots--` |
| Schuss mit aktiver Bombe | unverändert | `bombArmed = false` |
| Level-Up / Restart / Game Over | `charge = maxPowerUpCharges` | `armed/active = false` |

UI-Hooks:
- `setPowerUpState(button, active)` toggelt CSS-Klasse `active` + `aria-pressed`.
- `updatePowerUpAvailability()` setzt `disabled` und aktualisiert `aria-label` mit Rest-Ladung.

### 4.6 Bomben-Cluster
`removeBombCluster(row, col)` entfernt die **getroffene** Bubble + alle 6 Hex-Nachbarn. Die platzierte Bomben-Bubble wird **nicht** in das Cluster einbezogen – sie zählt nicht für die 15-Punkte-Berechnung.

---

## 5. Anti-Patterns (NIEMALS verwenden)

1. ❌ **Keine neuen Canvas-Bibliotheken** (Pixi.js, Three.js, Phaser) – Vanilla Canvas API bleibt.
2. ❌ **Kein jQuery** – Vanilla DOM-APIs sind ausreichend.
3. ❌ **Keine globalen Event-Listener außerhalb von `setupEventListeners()`** (Ausnahmen: `window.load`, einmaliger Init-Trigger).
4. ❌ **Kein `setInterval` oder `setTimeout` für Spiel-Logik** – nur `requestAnimationFrame` für den Game-Loop. Timeouts nur für UI-Debouncing (z. B. Resize-Throttle).
5. ❌ **Kein direktes Mutieren des Grids außerhalb von `BubbleShooter`-Methoden**.
6. ❌ **Keinen `localStorage`-Spielstand ohne explizite Anforderung verändern** (Schema: `jabs-save-v1`; siehe `saveState()`/`loadState()`).
7. ❌ **Keine CSS `!important`** – nutze Spezifität oder Custom Properties.
8. ❌ **Kein `innerHTML` für dynamische Inhalte** – nutze DOM-Eigenschaften oder `textContent`.
9. ❌ **Kein `row % 2` für Topologie** – verwende `getRowOffsetFlag(row)`.
10. ❌ **Kein zweiter Aim-Pfad** – alle Aim-Berechnungen über `resolveAim()`.
11. ❌ **Kein Row-Push oder Game-Over in `shootBubble()`** – nur in `resolveTurn()`.
12. ❌ **Keine Touch/Mouse-Trennung** – Pointer Events sind SSoT.
13. ❌ **Keine neue Datei** für Spiel-Code – neue Dateien nur für Doku (`docs/`), Tests (`test/`) oder CI-Config (`.github/`).
14. ❌ **Keine leeren `package.json` dependencies** – die Datei enthält ausschließlich `devDependencies` für Tests.

---

## 6. Wartungshinweise für KI-Agenten

### 6.1 Neue Bubble-Farbe hinzufügen

1. In `constructor()` zur `colors`-Array hinzufügen: `this.colors = [..., '#NEUER_HEX']`.
2. In `constructor()` zur `colorSymbols`-Map hinzufügen: `'#NEUER_HEX': '◆'` (eindeutiges Glyph wählen).
3. `darkenColor()` und `lightenColor()` funktionieren automatisch (HEX-basiert).
4. **Test**: Smoke-Test erweitern, der diese Farbe durch einen Match-3-Pfad schickt.

### 6.2 Neue Power-Up-Art hinzufügen

1. Eigenen Konfig-Key in `resetPowerUps()` definieren (z. B. `this.laserCharges = this.maxPowerUpCharges`).
2. Button ins HTML (`index.htm` ~im Power-Ups-Container) einfügen: `<button id="laserBtn" ...>🔫</button>`.
3. Event-Listener in `setupEventListeners()` registrieren: `this.laserBtn.addEventListener('click', () => this.activateLaserPowerUp())`.
4. `activateLaserPowerUp()` mit Toggle-Semantik (siehe `activateBombPowerUp()` als Vorlage).
5. `setPowerUpState(this.laserBtn, ...)` und `updatePowerUpAvailability()` erweitern.
6. Logik in `shootBubble()` – `bubble.powerUp = 'laser'` setzen.
7. Effekt in `placeBubble()` auswerten (neuer Zweig nach Bomben-Zweig).
8. Reset in `resetPowerUps()` ergänzen.
9. **Wiki-Doku** in `docs/wiki/powerups.md` ergänzen.
10. **Glossar** in `GLOSSARY.md` ergänzen (falls neuer Begriff).

### 6.3 Neues Canvas-Rendering (Effekte, Partikel)

```javascript
// In gameLoop(), am Ende (nach aktiver Bubble):
this.drawMyEffect(); // Nur Zeichenbefehle – kein State

// Methode definieren:
drawMyEffect() {
    this.ctx.save();
    this.ctx.globalAlpha = 0.5;
    // … Zeichenbefehle
    this.ctx.restore();
}
```

State, der für den Effekt nötig ist (z. B. Partikel-Liste), wird als Instanz-Property geführt und in `resetPowerUps()` / `restartGame()` / `nextLevel()` initialisiert.

### 6.4 Magic Number extrahieren

Vor:
```javascript
if (this.shotsFired % 5 === 0) { this.addRow(); }
```

Nach:
```javascript
// In constructor():
this.shotsPerRow = 5;
// ...
// Im Code:
if (this.shotsFired % this.shotsPerRow === 0) { this.addRow(); }
```

**Voraussetzung**: Bestehende Tests bleiben grün. Falls eine Konstante in den Tests als Literal vorkommt, den Test **gleichzeitig** auf die Property umstellen.

### 6.5 Test schreiben

Für reine Spiellogik (keine DOM-Manipulation):

```javascript
// test/my-test.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = fs.readFileSync(new URL('../index.htm', import.meta.url), 'utf8');
const scriptSrc = html.match(/<script>([\s\S]*)<\/script>/)[1];

function createGame() {
    // DOM-Stubs wie in test/logic-smoke.mjs
    // ...
    const sandbox = vm.createContext(/* ... */);
    vm.runInContext(scriptSrc, sandbox);
    return vm.runInContext('new BubbleShooter()', sandbox);
}

const game = createGame();
assert.equal(game.shotsPerRow, 5);
```

In `package.json` ergänzen: `"test": "node test/check-syntax.mjs && node test/logic-smoke.mjs && node test/my-test.mjs"`.

### 6.6 Vor dem Commit

```bash
npm test              # Alle Tests grün?
git diff --check      # Keine Konflikt-Marker?
git status            # Keine ungewollten Dateien?
```

Falls du die Dokumentation angepasst hast:
```bash
grep -n "\[EXISTIERT\]" GLOSSARY.md   # Konsistenz prüfen
```

---

## 7. Architektur-Entscheidungen (aus Audit)

Diese Entscheidungen sind das Ergebnis von `master-audit-2026-07-26.md` und dürfen ohne expliziten Issue-Diskurs nicht revertiert werden:

| Befund | Entscheidung |
|---|---|
| Mobile Canvas kollabiert auf 150 px | `.game-area { flex: 1 1 auto; min-height: 0 }` + `100dvh` – Pflicht für `@media (max-width: 768px)` |
| Shooter vor State-Initialisierung zentriert | `resizeCanvas()` darf erst nach `initializeGame()` aufgerufen werden, oder Shooter wird nach Init explizit re-zentriert |
| Hex-Topologie nach Row-Push inkonsistent | `rowOffsets` ist SSoT; `row % 2` darf nicht für Topologie verwendet werden |
| Abwärts-Schüsse möglich | `resolveAim()` ist SSoT für Aim-Vektoren |
| Projektil teleportiert in ferne Zelle | `placeBubble(bubble, collision)` nutzt `collision` für lokale Kandidaten |
| Bomben-Cluster um Platzierung statt Treffer | `removeBombCluster(target.row, target.col)` nutzt Collision-Ziel, nicht Platzierung |
| 5. Schuss kann vor Auflösung Game Over | `resolveTurn()` ist SSoT für Schuss-Abschluss |
| Touch schießt vor Aim | Pointer Events mit `pointerdown`/`pointerup` statt Touch/Mouse-Trennung |
| Hilfe/Menü sind Sackgassen | `openDialog()`/`closeDialog()` mit Focus-Management, `Escape`-Schließen |
| Power-Ups ohne Verbrauch | `*Charges` Instanz-Properties, `resetPowerUps()` füllt auf |
| Speed abhängig von Hz | Delta-Time in `updateActiveBubble(deltaMs)` + Substeps |
| Keine Tests/CI | `test/check-syntax.mjs`, `test/logic-smoke.mjs`, `.github/workflows/test.yml` |
| Farbmatching ohne Accessibility | `colorSymbols`-Map mit eindeutigen Glyphen pro Farbe |
| Score/Level unlabeled | Text-Labels ("Level", "Punkte"), `aria-hidden` auf Emoji-Icons |
| Resize teleportiert Schuss | Substep-Bewegung verhindert Tunneling; Resize skaliert aktive Bubble proportional |
| Game Loop läuft nach Game Over | `gameRunning`/`paused` stoppen `requestAnimationFrame` |
| Diverse Doku-Inkonsistenzen | `GLOSSARY.md` als SSoT, Wiki-Links in CI verifizieren |