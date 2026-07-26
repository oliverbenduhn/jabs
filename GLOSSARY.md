# Glossar – jabs

> **Zweck**: Strikte, eindeutige Definitionen aller domänenspezifischen Begriffe.
> **Zielgruppe**: Menschliche Entwickler **und** KI-Agenten. Jeder andere Doku-Text, jeder Code-Kommentar und jede KI-Antwort muss diese Definitionen verwenden – keine Synonyme, keine stillschweigenden Umdeutungen.
> **Single Source of Truth**: Wenn ein Begriff hier nicht steht, ist er nicht offiziell. Wenn ein anderer Doku-Text abweicht, ist das ein Bug.

---

## 1. Spiel-Domäne

### Bubble
Eine einzelne Spielkugel. Konzeptuell identisch mit "Ball" oder "Kugel", aber im Projekt immer **"Bubble"** (auch im UI-Text).
- **Datenstruktur**: Plain Object `{ color, x, y, radius, [dirX, dirY, speed, powerUp] }` – siehe `docs/wiki/data-model.md`.
- **Lebenszyklus**: `createBubble()` → optional `activeBubble` (fliegend) → `placeBubble()` ins Grid → `delete grid[r][c]` (entfernt).
- **Rendering**: `drawBubble()` – Canvas 2D, mit Radial-Gradient + Highlight + Symbol.
- **Niemals**: "Ball", "Kugel", "Sphere", "Orb".

### Color (Farbe)
HEX-String aus der Palette `['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ff924c', '#2ec4b6', '#f72585']`.
- Jede Farbe hat ein **eindeutiges Glyph** (Symbol) in `this.colorSymbols` für **Colorblind-Accessibility** – Matching basiert zusätzlich auf dem Glyph, nicht nur auf der Farbe.
- **Niemals**: "Rot/Gelb/..." als Quellcode-Bezeichner. Im UI-Text darf "rot" stehen, im Code immer HEX.

### Hex Grid (Hexagonales Gitter)
Das 2D-Spielfeld `this.grid: Array<Array<Bubble | undefined>>` mit **versetzten Reihen**.
- **Spalten** (Columns): `this.columnCount = 15` (fix).
- **Reihen** (Rows): wachsen dynamisch durch `addRow()`, starten bei `this.initialRows = 8`.
- **Reihen-Offset**: Jede zweite Reihe ist um `bubbleRadius` horizontal versetzt – Versatz wird in `this.rowOffsets[row]` (0 oder 1) gecached.
- **Koordinatenursprung**: Oben links; `grid[0]` = oberste (Top Row), `grid[grid.length - 1]` = unterste.
- **Topologie-Quelle**: `getRowOffsetFlag(row)` ist **die einzige** Quelle der Wahrheit für die Hex-Nachbarschaft. **`row % 2` darf nirgendwo für Topologie verwendet werden** – das ist die Ursache für den Audit-Befund "Hoch – Row-Push desynchronisiert visuelle Geometrie und logische Nachbarschaft".

### Top Row
`grid[0]` – die oberste, erste Reihe. Bubbles, die hier stehen (oder davon aus rekursiv erreichbar sind), sind **connected** (verbunden). Floating-Detection startet immer von hier.

### Hex Neighbor (Hex-Nachbar)
Eine Zelle `(r', c')`, die zu `(r, c)` gemäß der Hex-Topologie benachbart ist.
- Maximal **6 Nachbarn** pro Zelle.
- Deltas je nach `getRowOffsetFlag(r)`:
  - Flag `0`: `[[0,-1], [0,1], [-1,-1], [-1,0], [1,-1], [1,0]]`
  - Flag `1`: `[[0,-1], [0,1], [-1,0], [-1,1], [1,0], [1,1]]`
- **Quelle**: `getNeighbors(row, col)`.

### Row Push
Das Einfügen einer neuen Reihe am oberen Rand des Grids. Erfolgt nach jeweils `this.shotsPerRow = 5` Schüssen.
- **Auslöser**: `resolveTurn()` → `addRow()`.
- **Wichtig**: Row Push passiert **nach** der Platzierung und Match-Auflösung des auslösenden Schusses – niemals synchron in `shootBubble()` (Audit-Befund "Hoch – Fünfter Schuss kann Game-Over auslösen, bevor sein Treffer ausgewertet wird").
- **Mechanik**: Neue Reihe wird oben eingefügt (`grid[0] = newRow`), bestehende Reihen rücken um 1 nach unten (`grid[row + 1] = grid[row]`).
- **Folge**: `updateGridPositions()` → `checkGameOver()`.

### Match (3+)
Eine Gruppe von **3 oder mehr Bubbles derselben Farbe**, die über Hex-Nachbarschaft miteinander verbunden sind.
- **Erkennung**: `findMatches(row, col, color)` per rekursiver Tiefensuche.
- **Auflösung**: Bubbles werden per `delete grid[r][c]` entfernt, **10 Punkte pro Bubble** gutgeschrieben.
- **Folge**: `removeFloatingBubbles()`.

### Floating Bubble (Schwebende Bubble)
Eine Bubble im Grid, die **nicht** (per Hex-Nachbarschaft) mit der Top Row verbunden ist.
- Nach jedem Match oder jeder Bombe-Explosion wird `removeFloatingBubbles()` aufgerufen.
- **Erkennung**: Rekursive DFS `markConnected()` ausgehend von `grid[0]`; nicht markierte Bubbles sind floating.
- **Auflösung**: Per `delete grid[r][c]` entfernt, **5 Punkte pro Bubble**.

### Cluster
Eine Menge von Grid-Zellen, die für die **Bombe** gleichzeitig entfernt werden.
- Besteht aus: Treffer-Bubble + allen 6 Hex-Nachbarn (sofern existent).
- **Quelle**: `removeBombCluster(row, col)`.
- **Wichtig**: Die **getroffene** Bubble zählt, **nicht** die platzierte Bomben-Bubble selbst (Audit-Korrektur).
- **Punkte**: **15 pro entfernter Bubble**.

### Win Condition
Bedingung für Level-Aufstieg: Das Grid ist **vollständig leer** (kein einziges Bubble-Objekt mehr vorhanden).
- **Quelle**: `checkWinCondition()`.
- **Folge**: `nextLevel()` → `level++`, frisches Grid, Power-Ups reset.

### Game Over
Endzustand des aktuellen Spiels.
- **Bedingung**: Mindestens eine Grid-Bubble erreicht `y >= shooter.y - 2 * bubbleRadius` (siehe `checkGameOver()`).
- **Folge**: `gameRunning = false`, `activeBubble = null`, `resetPowerUps()`, Game-Over-Overlay mit Punktestand.

### Endless Mode (Endlos-Modus)
Spielmodus ohne finalen Sieg-Zustand. Level-Aufstieg erzeugt ein **gleich schwieriges** neues Grid; das Spiel endet nur durch Game Over.
- Der `level`-Zähler ist ein **Meilenstein**, kein Sieg-Zustand.

---

## 2. Spielmechanik-State

### Active Bubble (Fliegende Bubble)
Eine einzelne Bubble, die gerade durch `shootBubble()` erzeugt wurde und sich durch das Grid bewegt.
- Existiert maximal einmal gleichzeitig: `this.activeBubble: ActiveBubble | null`.
- **Bewegung**: Zeitbasiert (`speed * deltaMs`), mit **Substep-Collision** (max `radius * 0.5` pro Substep) gegen Tunneling.
- **Lebenszyklus**: Erzeugt in `shootBubble()` → bewegt in `updateActiveBubble(deltaMs)` → platziert in `placeBubble()` oder verworfen (unterer Rand) → `activeBubble = null`.

### Shooter
Position und Winkel der Abschuss-Vorrichtung am unteren Bildrand.
- **Datenstruktur**: `{ x: number, y: number, angle: number }`.
- **Position**: `x = gridLeftEdge + gridWidth / 2`, `y = canvas.height - 100`.
- **Winkel**: Initial `-Math.PI / 2` (genau nach oben), begrenzt auf `±baseAngleLimit` bzw. `±aimAngleLimit`.

### Aim / Aiming
Vorgang des Zielens per Maus, Touch oder Pfeiltasten.
- **Single Source of Truth**: `resolveAim(targetX, targetY)` – **alle** Aim-Pfade (Maus, Touch, Tastatur, Schuss) rufen diese Methode auf. Es gibt keinen zweiten, unbegrenzten Pfad.
- **Output**: `{ angle, dirX, dirY }` – Winkel + normierter Richtungsvektor.

### Resolve Aim (resolveAim)
Die zentrale Methode, die aus Ziel-Koordinaten einen **begrenzten** Winkel und Richtungsvektor berechnet:
- **Algorithmus**: Delta von Aufwärtsachse (`-π/2`) berechnen, auf `[-π, π]` normalisieren, auf `±currentAngleLimit` clampen, dann Winkel und Vektor zurückgeben.
- **Audit-Befund-bezogen**: Verhindert, dass ein Abwärts-Klick einen nach unten gerichteten Schuss auslöst.

### Angle Limit (Winkelbegrenzung)
Maximaler Schwenkbereich des Shooters um die Aufwärtsachse.
- **Normal**: `baseAngleLimit = Math.PI / 2.5` (~72°).
- **Mit Zielhilfe**: `aimAngleLimit = Math.PI / 1.8` (~100°).
- **Aktiv**: `currentAngleLimit` – wird zwischen den beiden Werten umgeschaltet.

### Trajectory (Trajektorie)
Visuelle Vorschau-Linie (gestrichelt) vom Shooter zur aktuellen Zielposition.
- Implementiert als SVG `<line>`, nicht im Canvas.
- **Längenlimit**: 200 px (normal) bzw. 280 px (Zielhilfe).
- **Update**: `updateTrajectory(aim)` bei jeder Maus-/Touch-/Tastatur-Bewegung.

### Turn (Zug)
Ein vollständiger Spielerzug: Schuss → Flug → Platzierung → Match/Floating → Row-Push oder Win oder Game-Over.
- **Atomar**: Alle Effekte eines Schusses werden innerhalb eines `resolveTurn()`-Aufrufs abgeschlossen, bevor der nächste Schuss akzeptiert wird.
- **Single Source of Truth**: `resolveTurn()` am Ende von `placeBubble()`.
- **Niemals**: Schusszähler erhöhen oder Row-Push in `shootBubble()` triggern.

### Power-Up
Sonderfähigkeit, die mit einer **Aufladung** (Charge) bezahlt wird.
- **Liste**: Zielhilfe (Aim), Bombe (Bomb).
- **Max Charges pro Level**: `maxPowerUpCharges = 1`.
- **Verbrauch**: Beim **Arming** (Scharfschalten), nicht beim Schuss.
- **Reset**: Bei Level-Aufstieg, Neustart und Game Over (`resetPowerUps()`).

### Charge (Aufladung)
Zähler für die verfügbare Anzahl einer Power-Up-Aktivierung.
- `this.aimCharges`, `this.bombCharges`.
- Start: `maxPowerUpCharges` (Standard 1) bei `resetPowerUps()`.
- Verbrauch: `charge--` direkt nach erfolgreichem Arming.
- **Anzeige**: Button wird per `disabled` deaktiviert und `aria-label` zeigt Rest-Ladung.

### Armed (Scharfgeschaltet)
Zustand eines Power-Ups, der beim nächsten Schuss angewendet wird.
- `this.aimAssistShots > 0` (Zielhilfe) oder `this.bombArmed === true` (Bombe).
- **Toggle**: Erneutes Klicken auf den Button deaktiviert ohne Schuss-Verbrauch (sofern noch keine Charge verbraucht wurde).

### Resolve Turn (resolveTurn)
Die Methode, die einen abgeschlossenen Schuss in den nächsten Spielzustand überführt.
- **Reihenfolge**:
  1. `checkWinCondition()` → ggf. `nextLevel()` (return).
  2. `shotsFired % shotsPerRow === 0` → `addRow()`.
  3. Sonst `checkGameOver()`.
- **Aufgerufen**: Einmal am Ende von `placeBubble()`, sowohl im normalen als auch im Bomben-Zweig.

---

## 3. Eingabe / Steuerung

### Pointer Event
Einheitliches Event für Maus, Touch und Stift – ersetzt separate `mousemove`/`touchmove`-Pfade.
- **Verwendete Events**: `pointermove`, `pointerdown`, `pointerup`, `pointercancel`.
- **Vorteil**: Ein einziger Code-Pfad für alle Eingabegeräte; konsistentes Verhalten zwischen Desktop und Mobile.

### Pointer Capture
Browser-Mechanismus, die Event-Lieferung an ein bestimmtes Element zu binden, auch wenn der Pointer dessen Grenzen verlässt.
- **Verwendet in**: `handlePointerDown()` mit `setPointerCapture()`, `handlePointerUp()` mit `releasePointerCapture()`.
- **Zweck**: Touch-Nutzer können ziehen und zielen, ohne den Canvas zu verlassen.

### Aim Clamp
Begrenzung der X-Koordinate des Zielpunkts auf den Grid-Innenraum.
- **Methode**: `clampAimX(x)` → `[gridLeftEdge + radius, gridRightEdge - radius]`.
- **Zweck**: Verhindert, dass die Trajektorie außerhalb des Grid-Rands zeigt.

---

## 4. Rendering

### Canvas Frame
Ein einzelner `requestAnimationFrame`-Tick.
- **Quelle**: `gameLoop(timestamp)`.
- **Reihenfolge**: `clearRect` → `updateActiveBubble` → Grid zeichnen → Active Bubble zeichnen → nächstes `requestAnimationFrame`.

### Delta Time (deltaMs)
Zeit in Millisekunden seit dem vorherigen Frame.
- **Berechnung**: `timestamp - lastFrameTime`, gedeckelt auf max. 100 ms (verhindert Riesen-Sprünge nach Tab-Inaktivität).
- **Zweck**: Framerate-unabhängige Bewegung (480 px/s statt 8 px/Frame).

### Substep (Collision Substep)
Aufteilung einer Frame-Bewegung in mehrere kleinere Schritte zur Vermeidung von Tunneling.
- **Berechnung**: `steps = ceil(stepDistance / (radius * 0.5))`, gedeckelt auf 50.
- **Pro Substep**: Kollisionscheck + Wand-Bounce.

### Draw Bubble
Eine Bubble auf den Canvas zeichnen mit 3D-Effekt.
- **Methode**: `drawBubble(x, y, color, radius = this.bubbleRadius)`.
- **Komposition**: Schatten → Radialverlauf → Highlight → Colorblind-Symbol.
- **Wichtig**: Keine State-Mutation – nur Zeichenbefehle.

---

## 5. Architektur / Code

### BubbleShooter (Klasse)
Die einzige Klasse der gesamten Anwendung. Alle Spiellogik, Rendering, Events und State-Management sind als Instanz-Methoden gekapselt.
- **Konstruktor**: `constructor()` ruft `resizeCanvas()` → `initializeGame()` → `setupEventListeners()` → `startGameLoop()`.
- **Verboten**: Globale Funktionen, zweite Spiel-Klasse, Mixins.

### Single Source of Truth (SSoT)
Prinzip: Jede Information hat **genau eine** autoritative Quelle im Code.
- **Beispiele**:
  - Hex-Topologie: `getRowOffsetFlag(row)` (nicht `row % 2`).
  - Aim-Winkel: `resolveAim()` (nicht `handleMouseMove` direkt).
  - Grid-Offsets: `this.rowOffsets` (nicht `row % 2`).
  - DOM-Updates: `updateUI()` (nicht direkte `textContent`-Zuweisungen in Gameplay-Methoden).

### updateUI
Die **einzige** Methode, die DOM-Elemente direkt manipuliert (außer Overlays/Shooter-State).
- Wird aufgerufen nach: Score-Änderung, Level-Änderung, Bubble-Wechsel, Power-Up-Status, Game-Over-Show.

### Vanilla (Zero Dependencies)
Projektphilosophie: keine npm-Pakete, kein Build-Tool, kein Framework, kein CDN.
- **Begründung**: Single-File-Auslieferung, keine Build-Pipeline, keine Sicherheits-Audit-Pflicht.
- **Verboten**: `package.json` mit `dependencies` (nur `devDependencies` für Tests erlaubt).

---

## 6. Test / Qualität

### Logic Smoke Test
Dependency-freier Node-Test, der die Spiellogik ohne Browser ausführt.
- **Pattern**: `vm.createContext` + DOM-Stubs + `vm.runInContext(scriptSrc, sandbox)`.
- **Datei**: `test/logic-smoke.mjs`.
- **Coverage**: Hex-Nachbarschaft nach `addRow()`, `resolveAim()`-Clamping, `placeBubble()`-Lokalität, Turn-Resolution, Power-Up-Charges.

### Syntax Check
Validierung, dass das `<script>`-Block in `index.htm` valides JavaScript ist.
- **Datei**: `test/check-syntax.mjs`.
- **Methode**: `new vm.Script(scriptSrc)`.

### CI
GitHub Actions Workflow `.github/workflows/test.yml`.
- **Trigger**: Push und Pull Request auf `main`.
- **Schritte**: `actions/checkout@v4` → `actions/setup-node@v4` (Node 20) → `npm test`.

---

## 7. Verbotene Begriffe (Anti-Vokabular)

Diese Wörter **dürfen nicht** im Code, in Kommentaren oder in Doku-Texten als Synonyme verwendet werden:

| Verboten | Verwende stattdessen | Begründung |
|---|---|---|
| Ball / Kugel / Sphere | **Bubble** | Projektkonvention |
| Index statt row/col | **row, col** | Hex-Grid verwendet keine kartesischen Indizes |
| `row % 2` für Topologie | **`getRowOffsetFlag(row)`** | Audit-Korrektur: SSoT ist `rowOffsets` |
| `mouseClick` / `touchStart` | **`pointerdown` / `pointerup`** | Pointer-Event-Vereinheitlichung |
| "Match-3" als Mechanik | **Match (3+)** | Mindestanzahl ist 3, kann beliebig höher sein |
| "Endgegner" / "Boss" | **n/a** | Endless-Mode hat keinen Endboss |
| "lokal" (Storage) | **n/a** | Es gibt keine Persistenz |
| `localStorage` / `sessionStorage` | **n/a** | Siehe oben |