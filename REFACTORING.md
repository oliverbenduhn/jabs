# Refactoring – jabs

> **Zielgruppe**: KI-Agenten (und Menschen), die `index.htm` umstrukturieren, ohne die Single-File-Architektur zu sprengen oder Audit-Regressionen zu erzeugen.
> **Verwandt**: [`agent.md`](agent.md) (Architektur-Regeln), [`GLOSSARY.md`](GLOSSARY.md) (Terminologie), [`docs/architecture.md`](docs/architecture.md), [`docs/TESTING.md`](docs/TESTING.md).

---

## 1. Refactoring-Prinzipien

### 1.1 Single Source of Truth (SSoT) zuerst

Vor jedem Refactoring die Frage: **Wo lebt die Information aktuell, und wo sollte sie leben?**

Beispiel: `row % 2` wurde in `getNeighbors()`, `getBubblePosition()` und an mehreren Stellen verwendet. Die SSoT ist `getRowOffsetFlag(row)`. Refactoring bedeutet: **alle** Stellen finden und ersetzen, nicht nur eine.

### 1.2 Red-Refactor-Green

Vor jeder Umstrukturierung:

1. **Test schreiben**, der die **aktuelle** Semantik festschreibt (Red Phase, falls nötig).
2. **Refactor** durchführen.
3. **Test muss grün bleiben** (Green Phase).

Wenn ein Refactor einen Test bricht, war das Refactor **keine** äquivalente Umstrukturierung.

### 1.3 Keine Verhaltensänderung

Refactoring ändert **nur die Struktur**, nicht das Verhalten. Verhaltensänderungen sind separate Commits mit `feat:` oder `fix:`.

---

## 2. Häufige Refactoring-Patterns

### 2.1 Magic Number → Instanz-Konstante

**Vorher**:
```javascript
if (this.shotsFired % 5 === 0) { this.addRow(); }
```

**Nachher**:
```javascript
// In constructor():
this.shotsPerRow = 5;
// ...
// Im Code:
if (this.shotsFired % this.shotsPerRow === 0) { this.addRow(); }
```

**Checkliste**:
- [ ] Konstante in `constructor()` einfügen.
- [ ] Alle Vorkommen der Magic Number ersetzen (`rg "5 === 0"`).
- [ ] Tests bleiben grün.
- [ ] Falls Tests die Konstante direkt prüfen (z. B. `assert.equal(instance.shotsPerRow, 5)`), ist das ok – das ist eine bewusste Kontrakt-Bindung.

### 2.2 Direkter DOM-Zugriff → `updateUI()`

**Vorher**:
```javascript
this.score += 10;
document.getElementById('score').textContent = this.score;
```

**Nachher**:
```javascript
this.score += 10;
this.updateUI(); // Zentrale Methode, die alle DOM-Updates bündelt
```

**Checkliste**:
- [ ] Direkte `document.getElementById(...)` / `.textContent` / `.style` in Gameplay-Methoden entfernen.
- [ ] Ausnahme: Overlay-Management (`openDialog`/`closeDialog`) darf direkt mit `classList` arbeiten – das ist nicht "Gameplay-State".
- [ ] Tests bleiben grün.

### 2.3 Topologie-Konsistenz

**Vorher** (verboten):
```javascript
// In getNeighbors():
const deltas = row % 2 === 0 ? [...] : [...];
```

**Nachher**:
```javascript
// In getNeighbors():
const deltas = this.getRowOffsetFlag(row) === 0 ? [...] : [...];
```

**Checkliste**:
- [ ] `rg "row % 2"` über `index.htm` – **alle** Vorkommen müssen weg (außer z. B. Cos/Sin-Wellen-Berechnungen, die mit row parity nichts zu tun haben).
- [ ] Falls eine andere Datei betroffen ist (`docs/`, `test/`): ebenso.
- [ ] Test #1 (`getNeighbors stays consistent with rowOffsets after two addRow() pushes`) muss grün sein.

### 2.4 Aim-Konsistenz

**Vorher** (verboten):
```javascript
// In handleMouseMove():
const dx = mouseX - this.shooter.x;
const dy = mouseY - this.shooter.y;
const angle = Math.atan2(dy, dx);
// ... unbegrenzter Winkel!
```

**Nachher**:
```javascript
// In handleMouseMove():
const aim = this.resolveAim(mouseX, mouseY);
this.shooter.angle = aim.angle;
this.updateTrajectory(aim);
```

**Checkliste**:
- [ ] `rg "Math.atan2"` über `index.htm` – nur in `resolveAim()` darf das vorkommen.
- [ ] Tests #2 (`resolveAim clamps downward targets`) und #3 (`shootBubble never launches a bubble downward`) müssen grün sein.

### 2.5 Turn-Resolution-Trennung

**Vorher** (verboten):
```javascript
// In shootBubble():
this.animateBubble(bubble);
this.shotsFired++;
if (this.shotsFired % 5 === 0) {
    this.addRow(); // ← Verboten!
}
```

**Nachher**:
```javascript
// In shootBubble():
this.animateBubble(bubble);
this.shotsFired++;
// KEIN addRow() hier.

// In placeBubble(), am Ende:
this.resolveTurn(); // Entscheidet über addRow / checkWin / checkGameOver
```

**Checkliste**:
- [ ] `rg "addRow\\(\\)" index.htm` – darf nur in `resolveTurn()` und in `nextLevel()` vorkommen.
- [ ] Test #5 (`shootBubble does not push a row synchronously`) muss grün sein.

### 2.6 Power-Up-Charge-Konsistenz

**Vorher** (verboten):
```javascript
activateBombPowerUp() {
    this.bombArmed = !this.bombArmed; // Toggle ohne Charge-Verbrauch
}
```

**Nachher**:
```javascript
activateBombPowerUp() {
    if (!this.gameRunning) return;
    if (this.bombArmed) {
        this.bombArmed = false;
        this.setPowerUpState(this.bombBtn, false);
        return;
    }
    if (this.bombCharges <= 0) return;
    this.bombCharges--;
    this.bombArmed = true;
    this.setPowerUpState(this.bombBtn, true);
    this.updatePowerUpAvailability();
}
```

**Checkliste**:
- [ ] `rg "bombCharges|aimCharges"` – muss in `resetPowerUps()`, `activate*PowerUp()` und `updatePowerUpAvailability()` vorkommen.
- [ ] Tests #6 (`bomb charge is consumed on arm`) und `#resetPowerUps()` müssen grün sein.

---

## 3. Risikoreiche Refactorings (mit Vorsicht)

### 3.1 Spielfile-Splitting

**Verboten ohne Issue-Diskurs**: Die Anwendung in mehrere Dateien aufteilen.

Falls je nötig:

1. **Issue eröffnen** mit Begründung (z. B. "Spiel wird zu groß zum Auditieren").
2. **Plan** im Issue dokumentieren, welche Klassen/Module wo leben sollen.
3. **Tests zuerst erweitern** (decken den aktuellen Code 1:1 ab).
4. **Refactor in kleinen Commits**:
   - Commit 1: Konstante `FOO` aus `index.htm` in `src/constants.js` extrahieren, Import in `index.htm`.
   - Commit 2: Klasse `Bar` extrahieren.
   - …
5. **Nach jedem Commit**: `npm test` muss grün sein.
6. **Wenn alle Module extrahiert sind**: Build-Step einführen (ES-Module reichen, kein Bundler nötig).

### 3.2 Rendering-Library einführen

**Verboten**: Pixi.js, Three.js, Phaser, etc.

Falls je Performance-Probleme auftreten:

1. **Profilieren** mit Chrome DevTools (siehe [`docs/PERFORMANCE.md`](docs/PERFORMANCE.md) §9).
2. **Optimierungen** zuerst versuchen:
   - Spatial Hashing für `checkCollision()`
   - Off-Screen-Canvas für statische Bubbles
   - `willReadFrequently = false` setzen
3. **Library als letzten Ausweg** – Issue mit Profiling-Daten und Begründung.

### 3.3 localStorage für Highscore

**Status**: Audit-Empfehlung, nicht umgesetzt.

Falls je umgesetzt:

1. **Produktentscheidung explizit** machen (Issue-Diskurs).
2. **Datenschutz-Hinweis** in README aufnehmen.
3. **Test**: `localStorage`-Stub für Smoke-Tests, separate Test-Datei für Persistenz.
4. **Reset-Funktion** anbieten (für Cookie-Clearing-Nutzer).

---

## 4. Anti-Refactoring-Patterns

### 4.1 "Ich extrahiere mal eben eine Helper-Funktion"

→ **Nein**. Alles in `BubbleShooter` als Methode.

### 4.2 "Ich nutze eine Closure für private State"

→ **Nur wenn** der State wirklich nicht von außen zugänglich sein muss. Sonst Instanz-Property.

### 4.3 "Ich teile `updateActiveBubble` in zwei Funktionen auf"

→ Erst Sinn prüfen. Die Methode ist 30 Zeilen, gut lesbar. Aufteilen macht sie **nicht** klarer.

### 4.4 "Ich füge JSDoc zu **jeder** Methode hinzu"

→ Nur zu **öffentlichen** Methoden. Private Helper mit `_`-Prefix brauchen keine JSDoc.

### 4.5 "Ich konsolidiere ähnliche Methoden in eine"

→ Erst wenn sie **wirklich identisch** sind. `activateAimPowerUp()` und `activateBombPowerUp()` sehen ähnlich aus, haben aber unterschiedliche State (`aimAssistShots` vs. `bombArmed`).

---

## 5. Refactoring-Workflow (Schritt für Schritt)

```
1. Issue / Audit-Befund identifizieren
       ↓
2. Aktuellen Code lesen und verstehen (ggf. Tests als Spezifikation)
       ↓
3. Test schreiben, falls keiner existiert (Red)
       ↓
4. Refactor in kleinsten möglichen Schritten
       ↓
5. Nach jedem Schritt: npm test grün?
       ↓
6. Commit mit aussagekräftiger Message
       ↓
7. Am Ende: manueller Browser-Test
       ↓
8. PR öffnen, Reviewer zuweisen
```

### 5.1 Commit-Beispiele

```
refactor: extrahiere shotsPerRow-Konstante

- this.shotsPerRow = 5 in constructor()
- Ersetzt Magic Number in resolveTurn()
- Test bleibt grün
```

```
refactor: zentralisiere Aim-Berechnung in resolveAim

- handleMouseMove, handleKeyDown, shootBubble rufen jetzt resolveAim()
- Math.atan2-Aufrufe ausserhalb von resolveAim entfernt
- Tests #2 und #3 bleiben grün
```

```
refactor: trenne Turn-Resolution von shootBubble

- shootBubble erhöht nur shotsFired
- resolveTurn entscheidet über addRow / checkWin / checkGameOver
- Test #5 bleibt grün
```

---

## 6. Refactoring-Checkliste vor PR

- [ ] `npm test` ist grün.
- [ ] Keine Verhaltensänderung (separater Commit, falls doch nötig).
- [ ] SSoT-Regeln eingehalten (`rowOffsets`, `resolveAim`, `resolveTurn`, `updateUI`).
- [ ] Anti-Pattern-Checkliste in `agent.md` §5 durchgegangen.
- [ ] `GLOSSARY.md` aktualisiert, falls neue Begriffe.
- [ ] Wiki (`docs/wiki/`) aktualisiert, falls Mechanik geändert wurde.
- [ ] Konflikt-Marker im Diff geprüft.
- [ ] Commit-Message beschreibt **was** und **warum**, nicht nur "refactor".

---

## 7. Wenn etwas schief geht

### 7.1 "Mein Refactor bricht einen Test, aber der Test war vorher grün"

1. **Nicht sofort den Test anpassen** – das ist eine Audit-Regression in spe.
2. **Verstehen, warum** der Test jetzt rot ist:
   - Hast du eine SSoT gebrochen?
   - Hast du ein Verhalten geändert, das du nicht ändern wolltest?
3. **Fix den Refactor**, nicht den Test.

### 7.2 "Ich kann die SSoT nicht eindeutig identifizieren"

→ [`GLOSSARY.md`](GLOSSARY.md) konsultieren. Wenn dort nicht definiert: Issue erstellen.

### 7.3 "Mein Refactor führt eine neue Magic Number ein"

→ Konstante extrahieren (siehe §2.1). Wenn die Magic Number **wirklich** nur lokal gilt: im Code kommentieren mit Quelle/Begründung.

### 7.4 "Ich will eine Library hinzufügen, weil X einfacher wäre"

→ Erst [`agent.md`](agent.md) §5 lesen. Dann Issue mit Begründung. **Standard-Antwort: nein.**