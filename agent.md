# agent.md – KI-Regelwerk für jabs

> **Zielgruppe**: KI-Agenten (Claude, Cursor, Copilot), die Code-Änderungen an diesem Repository vornehmen.
> **Zweck**: Minimale Reibung, konsistente Patterns, keine Architektur-Verstöße.

---

## 1. Projekt-Kontext (immer zuerst lesen)

- **Projekt**: `jabs` – ein Bubble-Shooter in einer einzigen HTML-Datei (`index.htm`).
- **Zero Dependencies**: Keine npm-Pakete, kein Build-Tool, kein Framework. Reinster Vanilla JS.
- **Single-File**: Die gesamte Anwendung (HTML, CSS, JS) lebt in **einer Datei**. Neue Funktionalität wird dort integriert – es sei denn, eine bewusste Entscheidung zur Aufteilung wird getroffen.
- **Sprache**: Deutsch für UI-Texte und Kommentare. Englisch nur für Code-Bezeichner und Standard-APIs.

---

## 2. Architektur-Regeln (NICHT VERLETZBAR)

### 2.1 Klassen-Struktur

Die gesamte Spiellogik ist in einer einzigen Klasse gekapselt: `BubbleShooter`. Alle neuen Funktionalitäten MÜSSEN als Methoden dieser Klasse implementiert werden.

```javascript
class BubbleShooter {
    constructor()     // Canvas-Setup, Event-Listener, init
    initializeGame()  // Grid, Bubbles, UI – einmalig
    gameLoop()        // requestAnimationFrame-Schleife
    // … alle weiteren Methoden als Instanzmethoden
}
```

**Anti-Pattern (verboten)**:
- ❌ Globale Funktionen oder Variablen außerhalb der Klasse
- ❌ Zweite Spiel-Klasse oder Mixins – alles in `BubbleShooter`
- ❌ Direkte DOM-Manipulation von außerhalb der Klasse

### 2.2 State-Management

Der gesamte Spielzustand lebt als **Instanz-Eigenschaften** in `BubbleShooter`. Kein externer State.

```javascript
this.grid           // 2D-Array: grid[row][col] = { color, x, y, radius } | undefined
this.activeBubble   // Fliegender Bubble { x, y, vx, vy, color, radius, powerUp }
this.shooter        // { x, y, angle } – Shooter-Position und Winkel
this.score          // number
this.level          // number
this.gameRunning    // boolean
```

**Anti-Pattern (verboten)**:
- ❌ DOM-Elemente als State-Container (`data-*`-Attribute für Spielzustand)
- ❌ `window`-Properties für Spielvariablen
- ❌ UI-State (z. B. `active`-Klassen) als alleinige Quelle der Wahrheit

### 2.3 Grid-Modell

Das hexagonale Grid ist ein **2D-Array** (Array von Arrays). Jede Zelle ist entweder ein Bubble-Objekt oder `undefined`.

```javascript
this.grid = [
    [ { color: '#ff595e', x: 30, y: 30, radius: 20 }, { color: '#ffca3a', ... }, ... ],
    [ ... ],
]
```

- **Reihen-Offset**: Gerade Reihen (`row % 2 === 0`) haben die erste Bubble bei x = 0 + radius; ungerade haben einen Offset von `bubbleRadius`.
- **Löschen**: `delete this.grid[row][col]` – nicht `null` oder leere Strings.
- **Zeilen-Index** = Reihe von oben (`grid[0]` = oberste Reihe).
- **Neue Reihen** werden per `unshift` oben eingefügt (`addRow`).

### 2.4 Datenfluss

```
Input (Maus/Touch) → Event-Handler → State-Änderung → gameLoop() → Canvas-Rendering
```

**Regel**: UI-Updates (Score, Level, Queue-Bubbles) erfolgen NUR über `updateUI()`. Keine manuellen DOM-Updates in Event-Handlern oder Gameplay-Methoden.

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
| **Semantik** | `<div>` nur als Container; kein `<table>` für Layout |
| **IDs** | Nur für JS-Referenzen (Canvas, Overlay, Buttons) |
| **Canvas** | Einziges `<canvas id="gameCanvas">` – alles Rendering darüber |

---

## 4. Validierungs- und Sicherheits-Regeln

- **Canvas-Größe**: `resizeCanvas()` MUSS bei Window-Resize und Initialisierung aufgerufen werden. Dies aktualisiert `bubbleRadius`, `gridWidth`, `gridLeftEdge`/`gridRightEdge`.
- **Kollisionserkennung**: Bubbles werden per Distanz-Check (`distance < radiusA + radiusB`) gegen das Grid geprüft; die Methode `checkCollision()` gibt `{ row, col }` des getroffenen Grid-Bubbles zurück oder `null`.
- **Winkelbegrenzung**: Der Schusswinkel ist auf `baseAngleLimit` (standard) bzw. `aimAngleLimit` (mit Zielhilfe) begrenzt. Der Shooter kann nicht außerhalb dieser Limits zielen.
- **Aim-Clamping**: `clampAimX(x)` stellt sicher, dass der Mauszeiger nicht außerhalb der Grid-Grenzen liegt.

---

## 5. Anti-Patterns (NIEMALS verwenden)

1. ❌ **Keine neuen Canvas-Bibliotheken** (Pixi.js, Three.js, Phaser) – Vanilla Canvas API bleibt.
2. ❌ **Kein jQuery** – Vanilla DOM-APIs sind ausreichend.
3. ❌ **Keine globalen Event-Listener außerhalb von `setupEventListeners()`**.
4. ❌ **Kein `setInterval` oder `setTimeout` für Spiel-Logik** – nur `requestAnimationFrame` für den Game-Loop.
5. ❌ **Kein direktes Mutieren des Grids außerhalb von `BubbleShooter`-Methoden**.
6. ❌ **Kein Speichern von Spielständen in `localStorage` ohne explizite Anforderung**.
7. ❌ **Keine CSS `!important` – nutze Spezifität oder Custom Properties**.
8. ❌ **Kein `innerHTML` für dynamische Inhalte** – nutze DOM-Eigenschaften oder `textContent`.

---

## 6. Wartungshinweise für KI-Agenten

### Neue Bubbles-Farbe hinzufügen

```javascript
// In constructor(): zur colors-Array hinzufügen
this.colors = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ff924c', '#2ec4b6', '#f72585', '#NEUER_HEX'];
```

### Neue Power-Up-Art hinzufügen

1. Eigenen Konfig-Key in `resetPowerUps()` definieren.
2. Button ins HTML (index.htm ~Zeile 110) einfügen.
3. Event-Listener in `setupEventListeners()` registrieren.
4. Logik in `shootBubble()` – `bubble.powerUp` setzen.
5. Effekt in `placeBubble()` auswerten.
6. UI-Update in `updateUI()` ergänzen.

### Neues Canvas-Rendering (Effekte, Partikel)

```javascript
// In gameLoop(), nach Bestehendem:
this.drawMyEffect(); // Nur Zeichenbefehle – kein State

// Methode definieren:
drawMyEffect() {
    this.ctx.save();
    this.ctx.globalAlpha = 0.5;
    // … Zeichenbefehle
    this.ctx.restore();
}
```
