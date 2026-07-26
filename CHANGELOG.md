# Changelog – jabs

> **Format**: [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), angelehnt an [Semantic Versioning](https://semver.org/lang/de/). Versionierung bewusst minimal – `jabs` ist ein Endlos-Modus-Spiel ohne API-Stabilitäts-Versprechen.
> **Audience**: Menschliche Entwickler **und** KI-Agenten (für Release-Decisions).

---

## [Unreleased]

### Geplant

- `visibilitychange`-Listener: Game-Loop pausieren bei inaktivem Tab.
- Optional: Puppeteer/Playwright Browser-Smoke-Tests (siehe [`docs/TESTING.md`](docs/TESTING.md) §6).
- Optional: `axe-core` Accessibility-Scan in CI.
- Optional: `LocalStorage`-Highscore (Produktentscheidung steht aus – siehe Audit).

---

## [1.0.0] – 2026-07-26

### Changed – Audit-Fixes

Behebt die kritischen und hohen Befunde aus [`master-audit-2026-07-26.md`](master-audit-2026-07-26.md).

#### Kritisch

- **Mobile Layout kollabiert**: `.game-area` bekommt `flex: 1 1 auto; min-height: 0;` und `100dvh`-Höhe im `@media (max-width: 768px)`-Block.
- **Tastatur-/Screenreader-Bedienbarkeit**: Aim/Bombe/Hilfe/Menü sind native `<button type="button">`-Elemente mit `aria-label`/`aria-pressed`/`role="dialog"`/`aria-modal`.

#### Hoch

- **Hex-Topologie nach Row-Push**: `getRowOffsetFlag(row)` ist die alleinige Quelle der Wahrheit. `row % 2` wird nicht mehr für Topologie verwendet. `getNeighbors()` und `getBubblePosition()` nutzen den gecachten `rowOffsets`.
- **Winkelbegrenzung & Zielhilfe**: `resolveAim(targetX, targetY)` clampst den Winkel um die Aufwärtsachse auf `±currentAngleLimit` und liefert einen normierten Richtungsvektor. Maus, Touch, Tastatur und Schuss verwenden **alle** dieselbe Methode.
- **Projektil-Platzierung**: `placeBubble(bubble, collision)` nutzt das Collision-Ergebnis und sucht nur in den **lokalen Nachbarn** der getroffenen Zelle (Fallback: Top-Row bei Deckenkontakt; Notfall: gesamtes Grid).
- **Bomben-Cluster**: `removeBombCluster(target.row, target.col)` nutzt das Collision-Ziel, nicht die platzierte Bomben-Bubble.
- **Turn-Resolution**: `shootBubble()` löst nur den Schuss aus; `resolveTurn()` entscheidet nach Platzierung/Match/Floating über `checkWinCondition()` / `addRow()` / `checkGameOver()`.
- **Touch-Aim-Workflow**: Pointer Events (`pointerdown`/`pointermove`/`pointerup`) mit Pointer Capture ersetzen separate Touch-Pfade.
- **Hilfe/Menü-Overlays**: `openDialog()`/`closeDialog()` mit Focus-Management; `Escape` schließt; `paused`-State stoppt Game-Loop im Menü.
- **Power-Up-Charges**: `bombCharges`/`aimCharges` Instanz-Properties, `maxPowerUpCharges = 1`, Verbrauch beim Arming, `resetPowerUps()` setzt zurück, Buttons zeigen `disabled` und `aria-label` mit Rest-Ladung.
- **Delta-Time & Substeps**: `updateActiveBubble(deltaMs)` rechnet zeitbasiert (480 px/s), Substeps verhindern Tunneling.
- **Highscore-Anzeige**: Sidebar zeigt `Math.max(this.highscore, this.score)`. Persistenz bleibt aus (siehe Audit-Empfehlung).

#### Mittel (Auszug)

- **Colorblind-Accessibility**: `colorSymbols`-Map mit eindeutigen Glyphen pro Farbe; in `drawBubble()` und `updateUI()` gerendert.
- **Text-Labels für Score/Level**: Sichtbare Labels in der Sidebar.
- **Game-Loop-Stop**: `gameRunning`/`paused` beenden `requestAnimationFrame`; `startGameLoop()` setzt ihn zurück.
- **Resize-State**: `updateGridPositions()` skaliert aktive Bubble proportional; `resizeScheduled` drosselt Resize auf ein Frame.

### Added

- **`test/check-syntax.mjs`**: `node:vm`-basierte Syntax-Validierung des Inline-`<script>`-Blocks.
- **`test/logic-smoke.mjs`**: 6 Smoke-Tests (Hex-Topologie, `resolveAim`, `placeBubble`-Lokalität, `resolveTurn`/`shootBubble`-Trennung, Power-Up-Charges, `resetPowerUps`).
- **`.github/workflows/test.yml`**: CI auf Node 20 mit `npm test`.
- **`GLOSSARY.md`**: Strikte Terminologie-Definitionen als Single Source of Truth.
- **`agent.md`**: KI-Regelwerk mit Magic-Number-, JSDoc- und Test-Konventionen.
- **`.cursorrules`**: Cursor-Kurzformat für deklarative Regeln.
- **`docs/architecture.md`**: Systemarchitektur, Datenfluss, Schichten.
- **`docs/game-mechanics.md`**: Hex-Grid, Kollision, Match-3, Floating, Punkte, Level.
- **`docs/wiki/`**: Detail-Wiki (`data-model.md`, `controls.md`, `rendering.md`, `powerups.md`, `level-system.md`).

### Notes

- Vorherige Commits `cf774d7` (initiales `index.htm`), `a6e6c49` (Neighbor-Bugfix), `dac4e71` (Endless-Mode Row-Push) sind in die 1.0.0 zusammengefasst.
- `master-audit-2026-07-26.md` bleibt im Repo als historisches Dokument.

---

## Vor 1.0.0

Vor der Audit-Konsolidierung existierten mehrere themenspezifische Commits:

| Commit | Datum | Inhalt |
|---|---|---|
| `615adec` | (latest vor 1.0.0) | "Fix critical/high audit findings, add tests and CI" |
| `fbf6a35` | – | "dsf" (intermediate commit) |
| `f005672` | – | Merge PR #2: `codex/überprüfen-und-ergänzen-des-endlosmodus-designs` |
| `dac4e71` | – | Implement endless mode row additions |
| `baa1c6d` | – | Merge PR #1: `codex/mechaniken-des-spiels-überprüfen-und-korrigieren` |
| `a6e6c49` | – | Fix neighbor calculation for bubble grid |
| `cf774d7` | – | Create `index.htm` |
| `a9e6c52` | – | Update `README.md` |
| `244a374` | – | Initial commit |

Diese Commits wurden im Zuge des Audits unter dem Tag `1.0.0` zusammengefasst; das genaue Datum einzelner Pre-Audit-Commits ist im `git log` nachvollziehbar.