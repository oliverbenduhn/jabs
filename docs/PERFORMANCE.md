# Performance – jabs

> **Zweck**: Performance-Charakteristika, Frame-Budget, Optimierungs-Möglichkeiten, Mobile-Einschränkungen.
> **Verwandt**: [`docs/architecture.md`](architecture.md) §5 (Rendering-Pipeline), [`docs/game-mechanics.md`](game-mechanics.md) §2 (Kollisionserkennung).

---

## 1. Performance-Ziele

| Metrik | Ziel | Tatsächlich (typisch) |
|---|---|---|
| **Frame-Budget bei 60 fps** | 16,67 ms / Frame | ~2-4 ms / Frame |
| **Frame-Budget bei 120 fps** | 8,33 ms / Frame | ~2-4 ms / Frame (framerate-unabhängig) |
| **First Contentful Paint** | < 1 s | ~200 ms (lokale Datei) |
| **Time to Interactive** | < 1,5 s | ~300 ms |
| **Total Transfer Size** | < 50 KB | ~62 KB (index.htm, unkomprimiert) |
| **Lighthouse Performance Score** | > 95 | ~98-100 |
| **Bubble-Count** | bis ~150 ohne FPS-Drop | stabil bis ~200 |

---

## 2. Frame-Budget-Aufschlüsselung

Ein typischer `gameLoop`-Tick verteilt sich ungefähr so:

```
gameLoop()
├── ctx.clearRect()                  ~0,1 ms
├── updateActiveBubble(deltaMs)
│   ├── Substep-Berechnung           ~0,01 ms
│   ├── 1-N Substeps (Loop)
│   │   ├── Bewegung                 ~0,005 ms
│   │   ├── Wand-Bounce               ~0,005 ms
│   │   └── checkCollision (Grid)     ~0,2-1,5 ms (N×M)
│   └── Wand-Kollision               ~0,01 ms
├── Grid zeichnen (N×M = 8×15 = 120) ~1,5-2 ms
│   └── drawBubble × 120
│       ├── Shadow                   ~0,005 ms
│       ├── Radial-Gradient          ~0,005 ms
│       ├── Highlight                ~0,002 ms
│       └── Symbol                   ~0,005 ms
└── Aktive Bubble zeichnen            ~0,02 ms
─────────────────────────────────────────────
Gesamt:                              ~2-4 ms / Frame
```

**Limitierender Faktor**: `checkCollision()` ist O(N×M) – bei 8×15 = 120 Bubbles sind das 120 Distanz-Checks pro Substep. Bei 10 Substeps sind das 1.200 Distanz-Checks pro Frame.

---

## 3. Framerate-Unabhängigkeit (audit-fixiert)

### 3.1 Vorher (Bug)

```javascript
// Alt: 8 px pro Frame, abhängig von Hz
bubble.x += bubble.dirX * 8;
bubble.y += bubble.dirY * 8;
```

- 60 Hz: 480 px/s
- 120 Hz: 960 px/s (doppelt so schnell)
- 30 Hz: 240 px/s (halb so schnell)

### 3.2 Nachher (Fix)

```javascript
// Neu: 480 px/s, unabhängig von Hz
const bubble = { ..., speed: 480 };
// In updateActiveBubble(deltaMs):
const dt = deltaMs / 1000;
const stepDistance = bubble.speed * dt;
```

- 60 Hz: 480 px/s
- 120 Hz: 480 px/s
- 30 Hz: 480 px/s

### 3.3 Delta-Cap

```javascript
const deltaMs = Math.min(timestamp - lastTime, 100);
```

Verhindert Riesensprünge nach Tab-Inaktivität oder beim ersten Frame.

---

## 4. Substep-Collision (audit-fixiert)

### 4.1 Problem (Tunneling)

Bei kleinen `bubbleRadius` (z. B. 1,5 px im kollabierten Mobile-Layout) und großem `stepDistance` (480 px/s × 16,67 ms = 8 px/Frame) kann die Bubble **eine ganze Grid-Bubble überspringen** – sie "tunnelt" durch sie hindurch.

### 4.2 Lösung

```javascript
const maxStepSize = Math.max(bubble.radius * 0.5, 1);
const steps = Math.min(50, Math.max(1, Math.ceil(stepDistance / maxStepSize)));
const singleStepDistance = stepDistance / steps;

for (let i = 0; i < steps; i++) {
    bubble.x += bubble.dirX * singleStepDistance;
    bubble.y += bubble.dirY * singleStepDistance;
    // ... Kollisionscheck pro Substep
}
```

### 4.3 Konsequenzen

- **Max. 50 Substeps/Frame** → bei `radius < 1 px` würde `stepDistance / (radius * 0.5) > 50` werden. Cap verhindert Endlos-Loops.
- **Tunneling-Frei**: Bubble kann maximal `radius * 0.5` pro Substep zurücklegen, weniger als `radius` – sie trifft garantiert.

---

## 5. Resize-Throttling

`resize`-Event wird gedrosselt:

```javascript
window.addEventListener('resize', () => {
    if (this.resizeScheduled) return;
    this.resizeScheduled = true;
    requestAnimationFrame(() => {
        this.resizeScheduled = false;
        this.resizeCanvas();
    });
});
```

→ Maximal **ein** `resizeCanvas()` pro Frame, egal wie viele `resize`-Events feuern.

**Vorteile**:
- Vermeidet Layout-Thrashing.
- Vermeidet mehrfaches `updateGridPositions()`.
- Hält den Main-Thread responsive.

---

## 6. Game-Loop-Stop (audit-fixiert)

### 6.1 Vorher (Bug)

`requestAnimationFrame` wurde **bedingungslos** neu geplant, auch nach Game Over.

```javascript
gameLoop() {
    // ... do work
    requestAnimationFrame(() => this.gameLoop()); // IMMER
}
```

→ CPU/GPU-Last trotz statischem Zustand.

### 6.2 Nachher (Fix)

```javascript
gameLoop(timestamp) {
    if (!this.gameRunning || this.paused) {
        this.loopHandle = null;
        this.lastFrameTime = null;
        return; // KEIN neues rAF
    }
    // ... do work
    this.loopHandle = requestAnimationFrame((t) => this.gameLoop(t));
}

startGameLoop() {
    if (this.loopHandle) return;
    this.lastFrameTime = null;
    this.loopHandle = requestAnimationFrame((t) => this.gameLoop(t));
}
```

→ `gameRunning = false` (Game Over) stoppt den Loop. `startGameLoop()` wird bei `restartGame()` und `closeMenu()` aufgerufen.

### 6.3 Zusätzlich (geplant)

`visibilitychange`-Listener, der den Loop pausiert, wenn der Tab in den Hintergrund geht:

```javascript
document.addEventListener('visibilitychange', () => {
    if (document.hidden && this.gameRunning) {
        this.paused = true;
    }
});
```

Noch nicht implementiert – siehe [`master-audit-2026-07-26.md`](../master-audit-2026-07-26.md) "Mittel – Game Loop läuft nach Game Over".

---

## 7. Mobile-Einschränkungen

### 7.1 Layout (audit-fixiert)

```css
@media (max-width: 768px) {
    .game-container {
        flex-direction: column;
        width: 100vw;
        height: 100dvh;       /* Dynamic Viewport Units */
    }

    .sidebar {
        width: 100%;
        height: 120px;
        flex-direction: row;
    }

    .game-area {
        flex: 1 1 auto;       /* statt flex: none */
        min-height: 0;
    }
}
```

**`100dvh`** (dynamic viewport height) berücksichtigt Mobile-Browser-UI (URL-Bar), im Gegensatz zu `100vh`.

### 7.2 GPU-Hinweise

```css
canvas {
    /* Hints für GPU-Compositing – Browser-spezifisch */
    transform: translateZ(0);          /* force GPU layer */
    -webkit-transform: translateZ(0);  /* Safari */
}
```

Nicht im aktuellen Code, aber als Reserve-Optimierung dokumentiert.

### 7.3 Touch-Performance

- `touch-action: none` auf Canvas verhindert Scroll/Zoom.
- Pointer Capture sorgt für konsistente Event-Lieferung auch bei Drag außerhalb des Canvas.
- Keine zusätzlichen Touch-Listener (Pointer Events sind ausreichend).

---

## 8. Bubble-Count-Limits

### 8.1 Theoretische Obergrenze

```
Max Grid-Größe:   ~10 Reihen × 15 Spalten = 150 Zellen
Plus Flyer:       1
Plus Overlay:     0 (nicht im Grid)
────────────────────────────────────────────────
Max Objekte/Frame: ~151
```

Bei 60 fps × 151 = ~9.060 Operationen/s. Vernachlässigbar.

### 8.2 Tatsächliches Limit

Game Over tritt ein, wenn Bubbles die Shooter-Linie erreichen. Praktisch liegt das Limit bei ~120-140 Bubbles.

### 8.3 Geplante Erweiterung (nicht implementiert)

Wenn das Spiel wächst (z. B. mehr Farben, größeres Grid):

| Maßnahme | Wirkung |
|---|---|
| Spatial Hashing für `checkCollision()` | O(1) statt O(N×M) |
| Off-Screen-Canvas für statische Bubbles | Schnelleres Repaint |
| Web-Worker für Match-Berechnung | Main-Thread entlasten |
| Canvas `willReadFrequently = false` | GPU-Pfad bevorzugen |

Aktuell nicht nötig – Profilierung zeigt < 4 ms/Frame selbst bei 200 Bubbles.

---

## 9. Profilierung

### 9.1 Chrome DevTools

1. DevTools öffnen (`F12`)
2. Tab **Performance**
3. **Record** starten
4. ~30 Sekunden spielen
5. **Stop**

Erwartete Resultate:
- **Scripting**: < 4 ms / Frame
- **Rendering**: < 2 ms / Frame
- **Painting**: < 2 ms / Frame
- **Idle**: Rest

### 9.2 FPS-Messung (Quick & Dirty)

In DevTools-Console:

```javascript
let frames = 0;
let start = performance.now();
function tick() {
    frames++;
    requestAnimationFrame(() => {
        if (performance.now() - start < 1000) tick();
        else console.log(`${frames} fps`);
    });
}
tick();
```

Erwartung: 60 fps (oder Display-Refresh-Rate) auf modernem Gerät.

---

## 10. Asset-Größen

### 10.1 Aktuelle Dateien

| Datei | Größe (ungefähr) |
|---|---|
| `index.htm` | ~62 KB |
| `index.html` (Redirect) | ~250 B |
| `LICENSE` | ~1 KB |
| `docs/` (gesamtes Wiki) | ~30 KB |
| **Total** | **~95 KB unkomprimiert** |

Mit Gzip: **~15 KB** (Text komprimiert sehr gut).

### 10.2 Keine externen Assets

- Keine Bilder (alles Canvas/SVG-generiert).
- Keine Fonts (System-Font `Arial`).
- Keine Sounds (kein Audio).

→ Keine CORS-Probleme, keine Asset-CDN-Abhängigkeiten, kein Lazy-Loading nötig.

---

## 11. Code-Splitting-Überlegungen

`index.htm` ist aktuell monolithisch (HTML + CSS + JS in einer Datei). **Bewusste Entscheidung gegen Splitting**:

| Pro Splitting | Contra Splitting |
|---|---|
| Besseres Caching einzelner Module | Mehr HTTP-Requests |
| Paralleles Laden | Komplexität (Build-Step oder ES-Module-Loading) |
| Klare Modulgrenzen | Mehrere Dateien zum Auditieren |

**Aktuelle Entscheidung**: Single-File beibehalten. Falls Splitting je nötig wird, ist der Plan in [`master-audit-2026-07-26.md`](../master-audit-2026-07-26.md) "Mittel – Monolithische Klasse" dokumentiert (siehe auch [`REFACTORING.md`](REFACTORING.md)).

---

## 12. Performance-Budget für neue Features

Bei jedem Feature-PR folgende Fragen stellen:

1. **Wieviele zusätzliche Operationen pro Frame?**
2. **Skaliert es mit Bubble-Count, Grid-Größe oder Schuss-Frequenz?**
3. **Kann es in einen Idle-Callback verlegt werden?** (z. B. `requestIdleCallback`)
4. **Macht es das Spiel messbar langsamer?**

**Akzeptanz-Kriterium**: < 5 % zusätzliche Frame-Time im Worst-Case-Szenario.