# Test-Strategie – jabs

> **Zweck**: Welche Tests existieren, was sie abdecken, was bewusst nicht getestet wird, wie man neue Tests schreibt.
> **Verwandt**: [`agent.md`](../agent.md) §6.5 (Test-Rezepte), [`CONTRIBUTING.md`](../CONTRIBUTING.md) §5 (manuelle Tests).

---

## 1. Übersicht

| Ebene | Tool | Datei | Was wird geprüft |
|---|---|---|---|
| Syntax | `node:vm` `Script` | `test/check-syntax.mjs` | Inline `<script>` in `index.htm` ist valides JavaScript |
| Logik-Smoke | `node:vm` `createContext` + DOM-Stubs | `test/logic-smoke.mjs` | 6 Invarianten der Spiellogik |
| CI | GitHub Actions | `.github/workflows/test.yml` | Beide Tests bei jedem Push und PR |
| Manuell | Browser + DevTools | – | Visuelle Korrektheit, Mobile, Accessibility |

**Test-Stack-Philosophie**: Null `dependencies`. Alle Tests laufen mit Node-Standard-Bibliothek (`node:fs`, `node:vm`, `node:assert`, `node:url`, `node:path`). Kein Jest, Mocha, Vitest, Playwright.

---

## 2. Was wird getestet

### 2.1 Syntax (`check-syntax.mjs`)

```javascript
const html = fs.readFileSync('index.htm', 'utf8');
const scriptSrc = html.match(/<script>([\s\S]*)<\/script>/)[1];
new vm.Script(scriptSrc, { filename: 'index.htm (inline script)' });
```

- **Coverage**: 100 % des `<script>`-Inhalts.
- **Was es fängt**: Tippfehler, vergessene Klammern, ungültige Syntax.
- **Was es nicht fängt**: Logische Fehler, Runtime-Errors (das Script wird nicht ausgeführt).

### 2.2 Logik-Smoke (`logic-smoke.mjs`)

Sechs Invarianten, die direkt aus dem Audit abgeleitet sind:

| # | Test | Schützt vor |
|---|---|---|
| 1 | `getNeighbors stays consistent with rowOffsets after two addRow() pushes` | Audit "Hoch – Hex-Topologie nach Row-Push inkonsistent" |
| 2 | `resolveAim clamps downward targets instead of passing them through` | Audit "Hoch – Winkelbegrenzung wirkt nicht auf Schuss" |
| 3 | `shootBubble never launches a bubble downward` | Audit "Hoch – Abwärtsschüsse" |
| 4 | `placeBubble lands on a free neighbor of the collided bubble` | Audit "Hoch – Projektil teleportiert in ferne Zelle" |
| 5 | `shootBubble does not push a row synchronously; resolveTurn does` | Audit "Hoch – 5. Schuss kann Game-Over vor Auflösung auslösen" |
| 6 | `bomb charge is consumed on arm and blocks a second arm` + `resetPowerUps()` | Audit "Hoch – Power-Ups ohne Verbrauchsressource" |

Jeder Test:
1. Erstellt ein DOM-Stub-Set (siehe `makeElement()` / `createGame()`).
2. Lädt das `<script>` per `vm.createContext`.
3. Instanziiert `new BubbleShooter()`.
4. Ruft öffentliche Methoden auf.
5. Validiert mit `node:assert/strict`.

### 2.3 Coverage-Map

| Mechanik | Getestet? | Test-Nummer |
|---|---|---|
| Hex-Topologie (`getNeighbors`, `getRowOffsetFlag`) | ✅ | #1 |
| Aim-Clamping (`resolveAim`) | ✅ | #2 |
| Aim-Pfad im Schuss (`shootBubble`) | ✅ | #3 |
| Lokale Platzierung (`placeBubble`) | ✅ | #4 |
| Turn-Resolution (`resolveTurn` vs. `shootBubble`) | ✅ | #5 |
| Power-Up-Charges (`bombCharges`, `aimCharges`) | ✅ | #6 |
| Win-Condition (`checkWinCondition`) | ❌ | – |
| Match-Logik (`findMatches`, `checkMatches`) | ❌ | – |
| Floating-Removal (`removeFloatingBubbles`) | ❌ | – |
| Game-Over (`checkGameOver`) | ❌ | – |
| Bomben-Cluster (`removeBombCluster`) | ❌ | – |
| Rendering (`drawBubble`, `gameLoop`) | ❌ | siehe §4 |
| Event-Handler (`handlePointer*`, `handleKeyDown`) | ❌ | siehe §4 |
| Resize / Responsive (`resizeCanvas`) | ❌ | siehe §4 |
| Persistence (Highscore) | ❌ | – (existiert nicht) |

**Bewusste Lücken** sind solche, die entweder (a) visuell sind oder (b) eine vollständige DOM-Umgebung benötigen, die der dependency-freie Ansatz bewusst vermeidet.

---

## 3. Was wird bewusst NICHT getestet

### 3.1 Visuelle Korrektheit

- 3D-Effekt der Bubbles (Radialverlauf, Highlight, Schatten)
- Farbverläufe und Hex-Layout
- SVG-Trajektorie

→ **Manuell** in DevTools.

### 3.2 Browser-spezifisches Verhalten

- Pointer Capture auf iOS Safari
- Touch-Gesten auf echten Geräten
- Canvas-Performance auf Low-End-Mobilgeräten

→ **Manuell** auf echten Geräten oder BrowserStack.

### 3.3 Accessibility

- Screenreader-Ausgabe (VoiceOver, NVDA)
- Tastatur-Navigation
- Fokus-Reihenfolge

→ **Manuell** + geplant: `axe-core` CLI-Lauf.

### 3.4 Performance

- Framerate über Zeit
- Speicherverbrauch nach langer Session
- Layout-Thrashing bei Resize

→ **Manuell** via Chrome DevTools Performance-Tab.

---

## 4. Wie man einen neuen Test schreibt

### 4.1 Rezept: Pure-Logic-Test

Für eine Spiellogik-Methode, die ohne DOM-Interaktion auskommt:

```javascript
// test/my-test.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(__dirname, '..', 'index.htm'), 'utf8');
const scriptSrc = html.match(/<script>([\s\S]*)<\/script>/)[1];

// DOM-Stubs (kopiere aus test/logic-smoke.mjs, anpassen wenn nötig)
function makeElement(id) { /* ... */ }
function createGame() {
    const documentStub = { /* ... */ };
    const windowStub = { /* ... */ };
    const sandbox = { /* ... */ };
    vm.createContext(sandbox);
    vm.runInContext(scriptSrc, sandbox);
    return vm.runInContext('new BubbleShooter()', sandbox);
}

let passed = 0;
function check(name, fn) {
    try {
        fn(createGame());
        passed++;
        console.log(`ok - ${name}`);
    } catch (err) {
        console.error(`FAIL - ${name}`);
        console.error(`  ${err.message}`);
        process.exitCode = 1;
    }
}

check('my new invariant', (instance) => {
    // Arrange
    instance.someMethod();
    // Act
    const result = instance.anotherMethod();
    // Assert
    assert.equal(result, 42);
});

console.log(`\n${passed} check(s) passed`);
```

### 4.2 Rezept: Test in `npm test` einbinden

In `package.json`:

```json
"scripts": {
    "test": "node test/check-syntax.mjs && node test/logic-smoke.mjs && node test/my-test.mjs"
}
```

### 4.3 Rezept: Test gegen Audit-Befund schreiben

Wenn du einen Audit-Befund behebst:

1. **Test zuerst schreiben** (Red Phase) – Test muss fehlschlagen, weil der Bug existiert.
2. **Fix implementieren** – Code ändern.
3. **Test muss grün werden** (Green Phase).
4. **Commit**: `fix: ...` mit Verweis auf den Audit-Befund.

### 4.4 Rezept: Test, der echte DOM-Initialisierung braucht

Falls ein Test Canvas-Context oder echte Browser-APIs braucht, erwäge stattdessen:

- **Unit-Test der Logik** (siehe 4.1) – isoliere den Pure-Logic-Teil.
- **Manueller Test** mit dokumentiertem Browser-Setup.
- **Headless-Browser-Test** (Puppeteer/Playwright) – **nur wenn** dependency-frei nicht möglich ist. Dies erfordert eine Ausnahme von der Zero-Dependencies-Regel und sollte im Issue-Tracker begründet werden.

---

## 5. CI-Integration

### 5.1 Workflow-Datei

`.github/workflows/test.yml`:

```yaml
name: Test
on:
  push:
  pull_request:
jobs:
  logic-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm test
```

### 5.2 Lokal vor dem Push

```bash
npm test
```

Erwartete Ausgabe (8 grüne Checks):

```
ok - index.htm inline script has valid JavaScript syntax
ok - getNeighbors stays consistent with rowOffsets after two addRow() pushes
ok - resolveAim clamps downward targets instead of passing them through
ok - shootBubble never launches a bubble downward
ok - placeBubble lands on a free neighbor of the collided bubble
ok - shootBubble does not push a row synchronously; resolveTurn does
ok - bomb charge is consumed on arm and blocks a second arm
ok - resetPowerUps() restores one charge per power-up

7 check(s) passed
```

### 5.3 Was tun bei rotem CI?

1. **Logs lesen** – welche Assertion ist fehlgeschlagen?
2. **Lokal reproduzieren**: `npm test` lokal.
3. **Fix implementieren** oder Test korrigieren (wenn Test falsch spezifiziert war).
4. **Reviewer fragen**, falls unklar.

---

## 6. Roadmap (optionale Test-Erweiterungen)

Nicht im aktuellen Scope, aber dokumentiert für künftige PRs:

| Geplant | Zweck | Aufwand |
|---|---|---|
| `test/win-condition.mjs` | `checkWinCondition()` für leeres Grid, einzelne Bubble, vollständig gefülltes Grid | Niedrig |
| `test/match-3.mjs` | Match-3 mit horizontaler Linie, Match-4, kein Match bei nur 2 | Mittel |
| `test/floating.mjs` | Floating-Erkennung nach isoliertem Bottom-Bubble | Mittel |
| `test/bomb-cluster.mjs` | Bomben-Cluster: 1 + 6 Nachbarn, Edge-Case mit Grid-Rand | Mittel |
| `test/aim-clamp.mjs` | `clampAimX()` an Grid-Grenzen | Niedrig |
| `test/game-over.mjs` | `checkGameOver()` an Grenze und darunter | Niedrig |
| Browser-Tests (Puppeteer/Playwright) | Visuelle Smoke-Tests Desktop + Mobile + Accessibility-Scan | Hoch (deps) |

Jeder dieser Tests folgt dem 4.1-Rezept. Bei Beitrag: Issue vorher absprechen, um Doppelarbeit zu vermeiden.