# Master Audit – jabs

**Datum:** 2026-07-26  
**Audit-Scope:** aktueller Working Tree (`index.htm`, `README.md`, `agent.md`, `docs/**`)  
**Stack:** Vanilla JavaScript, HTML5 Canvas, SVG, CSS; keine Runtime-Abhängigkeiten  
**Status:** **nicht release-fähig**

## Executive Summary

Die Anwendung ist syntaktisch lauffähig und besitzt eine grundsätzlich nachvollziehbare Game-Loop-Struktur. Mehrere zentrale Produktversprechen sind jedoch aktuell nicht erfüllt:

- Die mobile Darstellung kollabiert auf eine nur 150 px hohe Spielfläche; Grid und Shooter liegen nicht im selben Koordinatenraum.
- Nach jedem ungeraden Row-Push stimmt die visuelle Hex-Geometrie nicht mehr mit der logischen Nachbarschaft überein.
- Die dokumentierte Winkelbegrenzung wirkt nicht auf den tatsächlichen Schuss; auch die Zielhilfe beeinflusst die Schussrichtung nicht.
- Touch-Nutzer schießen bereits beim Aufsetzen des Fingers und können daher nicht erst zielen und dann auslösen.
- Hilfe- und Menü-Schaltflächen sind Sackgassen; Tastatur- und Screenreader-Nutzung sind für Kernfunktionen nicht möglich.
- Es gibt keine automatisierten Tests oder CI-Gates, obwohl mehrere Fehler mit kleinen deterministischen Tests vermeidbar wären.

### Befundübersicht

| Schweregrad | Anzahl |
|---|---:|
| Kritisch | 2 |
| Hoch | 10 |
| Mittel | 10 |
| Niedrig | 5 |
| Vorschlag | 3 |

## Methodik und Evidenz

1. **Architektur-/Struktur-Scan:** kompletter Datei- und Abhängigkeits-Scan, Prüfung des Working Trees und der Dokumentation.
2. **Workflow-Tracing:** Zielen → Schießen → Flug → Kollision → Platzierung → Match/Floating → Row-Push/Game-Over sowie Power-ups, Restart und Levelwechsel.
3. **Statische Analyse:** vollständige Prüfung der 1.215 Zeilen in `index.htm` sowie Abgleich mit `README.md`, `agent.md` und `docs/**`.
4. **Browser-Smoke-Tests:** Headless Chrome mit Desktop-, Tablet-, Portrait- und Landscape-Viewports.
5. **Basiskontrollen:** JavaScript-Syntaxprüfung mit `node --check`; Prüfung auf doppelte IDs und vorhandene QA-/CI-Konfiguration.

**Bestanden:** JavaScript-Syntax, keine doppelten HTML-IDs, Desktop-Grundrendering.  
**Fehlgeschlagen:** mobile Layout-Smokes, funktionaler Abgleich der Winkelbegrenzung, Hex-Nachbarschaft nach Row-Push.  
**Nicht vorhanden:** Unit-Tests, Browser-/Accessibility-Tests, Linting, Format-Check, CI und Deployment-Smoke-Test.

---

# 🚨 Kritisch

## 🚨 Kritisch – Mobile Spielfläche kollabiert; Grid und Shooter sind voneinander getrennt
- **Kategorie:** Responsive Bug / Kern-Workflow
- **Betroffene Datei(en) / Komponente(n):** `index.htm:19-39`, `index.htm:257-286`, `index.htm:388-455`, `index.htm:486-513`
- **Problembeschreibung:** Im mobilen Column-Layout bleibt `.game-area` `flex: none`, erhält aber keine nutzbare Höhe. Der Canvas fällt deshalb auf seine intrinsische Höhe von 150 px zurück. `updateGridMetrics()` berechnet daraus einen Bubble-Radius von nur ca. 1,54 px und eine Grid-Breite von ca. 47,77 px. Gleichzeitig wird `resizeCanvas()` ausgeführt, bevor `this.shooter` existiert; der Shooter wird anschließend in der Mitte des vollen Canvas statt in der Mitte des Grids initialisiert. Im Browser-Smoke-Test ergaben sich bei mobilem Layout: Canvas `500 × 150`, Grid-Breite `47,77`, Shooter-X `250` statt ca. `23,89`. Die 470 px breite Shooter-Leiste wird zusätzlich durch `overflow: hidden` abgeschnitten.
- **Auswirkung:** Das Spiel ist auf Smartphones praktisch unspielbar. Bubbles erscheinen als winziger Block oben links; der Schuss startet außerhalb des logischen Spielfelds und wird beim ersten Physik-Frame an dessen Rand teleportiert. Queue bzw. Power-up-Buttons sind auf typischen Portrait-Breiten teilweise nicht sichtbar oder nicht antippbar. Die README-Aussage „Mobile/Touch – vollständig optimiert“ ist falsch.
- **Lösungsvorschlag:** Der mobile Container braucht einen expliziten verfügbaren Höhenanteil, und alle Metriken müssen erst nach vollständiger State-Initialisierung berechnet werden:
  ```css
  @media (max-width: 768px) {
      .game-container { height: 100dvh; }
      .sidebar { order: 0; height: 120px; }
      .game-area { order: 1; flex: 1 1 auto; min-height: 0; }
      .shooter-area { width: 100%; justify-content: center; flex-wrap: wrap; }
  }
  ```
  `this.shooter` vor dem ersten `resizeCanvas()` initialisieren oder nach `initializeGame()` zwingend erneut zentrieren. Viewport-Tests für 320, 390, 768 und 769 px ergänzen.

## 🚨 Kritisch – Kernspiel und zentrale Controls sind für Tastatur und Screenreader nicht bedienbar
- **Kategorie:** Barrierefreiheit / Prozess-Sackgasse
- **Betroffene Datei(en) / Komponente(n):** `index.htm:293`, `index.htm:309-312`, `index.htm:315-321`, `index.htm:327-339`, `index.htm:598-636`
- **Problembeschreibung:** Das Canvas besitzt weder Fallback-Inhalt noch zugänglichen Namen oder textuelle Zustandsrepräsentation. Zielen und Schießen haben keinen Keyboard-Pfad. Aim, Bombe, Hilfe und Menü sind nicht fokussierbare `<div>`-Elemente ohne Button-Semantik. Der Game-Over-Dialog hat weder Dialog-/Live-Region-Semantik noch Fokusmanagement.
- **Auswirkung:** Nutzer ohne Zeigegerät können das Spiel nicht spielen und nicht einmal Power-ups aktivieren. Screenreader-Nutzer erhalten keine Information über Grid, Spielende oder die Bedeutung der Zahlen in der Sidebar. Wesentliche Anforderungen aus WCAG 2.1.1 (Keyboard), 1.1.1 (Non-text Content) und 4.1.2 (Name, Role, Value) werden verfehlt.
- **Lösungsvorschlag:** Native `<button type="button">`-Elemente mit `aria-label` und `aria-pressed` einsetzen; Keyboard-Steuerung für Winkel und Schuss ergänzen; Canvas mit Fallback und Statuszusammenfassung versehen; Overlay als Dialog auszeichnen und Fokus auf Neustart setzen:
  ```html
  <canvas id="gameCanvas" aria-label="Bubble-Shooter-Spielfeld">
      Dein Browser unterstützt das Spielfeld nicht.
  </canvas>
  <button id="aimBtn" aria-label="Zielhilfe" aria-pressed="false">🎯</button>
  <div id="gameOverlay" role="dialog" aria-modal="true"
       aria-labelledby="overlayTitle" aria-describedby="overlayMessage">
  ```

---

# 🔴 Hoch

## 🚨 Hoch – Row-Push desynchronisiert visuelle Geometrie und logische Nachbarschaft
- **Kategorie:** Bug / Datenmodell
- **Betroffene Datei(en) / Komponente(n):** `index.htm:538-574`, `index.htm:1006-1023`, `index.htm:1083-1100`
- **Problembeschreibung:** Die Bubble-Position nutzt `rowOffsets`; `addRow()` fügt abwechselnd ein Offset-Flag ein. `getNeighbors()` ignoriert diese Quelle der Wahrheit und entscheidet ausschließlich anhand von `row % 2`. Nach jedem ungeraden Row-Push beginnen die Offsets mit `[1, 0, 1, …]`, während die Nachbarschaft weiterhin `[0, 1, 0, …]` annimmt. Physisch nicht berührende Bubbles gelten dadurch als Nachbarn; tatsächlich berührende werden ausgelassen.
- **Auswirkung:** Match-3 entfernt falsche Gruppen oder übersieht echte Matches. Floating-Erkennung kann befestigte Bubbles fallen lassen bzw. schwebende erhalten. Bomben treffen falsche Nachbarn. Der Fehler betrifft nach dem ersten Row-Push nahezu jede Kernmechanik.
- **Lösungsvorschlag:** `getRowOffsetFlag(row)` als alleinige Topologie-Quelle verwenden und die Delta-Auswahl daraus ableiten. Deterministische Tests für Nachbarn, Match, Floating und Bombe vor/nach mindestens zwei `addRow()`-Aufrufen ergänzen.

## 🚨 Hoch – Winkelbegrenzung und Zielhilfe wirken nicht auf den tatsächlichen Schuss
- **Kategorie:** Bug / Prozess-Logik
- **Betroffene Datei(en) / Komponente(n):** `index.htm:638-700`, `index.htm:714-753`, `index.htm:786-797`, `agent.md:131-134`
- **Problembeschreibung:** `handleMouseMove()` begrenzt nur `this.shooter.angle`. `updateTrajectory()` und `shootBubble()` berechnen ihre Vektoren erneut aus den ungebegrenzten Zielkoordinaten und ignorieren diesen Winkel. Ein Klick direkt unterhalb des Shooters erzeugt daher trotz Limit `vy = +8`. Die Zielhilfe verlängert faktisch nur die SVG-Linie; sie erweitert keinen realen Schussbereich.
- **Auswirkung:** Verbotene Abwärtsschüsse werden akzeptiert, verschwinden unten aus dem Canvas und verbrauchen Queue, Power-up und Schusszähler. Das zentrale Zielhilfe-Power-up hält sein Funktionsversprechen nicht.
- **Lösungsvorschlag:** Eine einzige Methode `resolveAim(targetX, targetY)` einführen, die den Winkel um die Aufwärtsachse begrenzt und einen normierten Richtungsvektor liefert. Sowohl Preview als auch `shootBubble()` müssen exakt diesen Vektor verwenden. Abwärtsziele entweder begrenzen oder explizit ablehnen.

## 🚨 Hoch – Projektil wird global in die nächste leere Zelle teleportiert
- **Kategorie:** Bug / Kollisionslogik
- **Betroffene Datei(en) / Komponente(n):** `index.htm:774-777`, `index.htm:878-965`
- **Problembeschreibung:** `checkCollision()` liefert die getroffene Grid-Zelle, doch `updateActiveBubble()` verwirft diese Information. `findBestPosition()` durchsucht anschließend jede leere Zelle des gesamten Grids und wählt nur nach euklidischer Nähe. Es gibt keine Bedingung, dass die Zielzelle ein freier Nachbar der kollidierten Bubble oder vom Einschlag aus erreichbar ist.
- **Auswirkung:** Bei gefüllter lokaler Umgebung kann eine Bubble in eine entfernte Lücke oder abgeschlossene Tasche springen. Visuelle Kollision und tatsächlicher Anwendungszustand weichen auseinander; darauf basierende Matches wirken willkürlich.
- **Lösungsvorschlag:** Das Collision-Ergebnis an `placeBubble(bubble, collision)` weiterreichen. Primär nur freie Nachbarn der getroffenen Zelle prüfen; bei Deckenkontakt nur gültige Top-Row-Zellen. Wenn kein gültiger Slot existiert, definiert Game-Over bzw. eine kontrollierte Fallback-Regel auslösen.

## 🚨 Hoch – Bombenexplosion ist um die Platzierungszelle statt um das Trefferziel zentriert
- **Kategorie:** Bug / Power-up
- **Betroffene Datei(en) / Komponente(n):** `index.htm:774-777`, `index.htm:818-834`, `index.htm:899-930`; `docs/wiki/powerups.md:67-116`
- **Problembeschreibung:** Da das Collision-Ergebnis verloren geht, wird erst die Bomben-Bubble in einer freien Zelle eingefügt und anschließend `removeBombCluster(row, col)` um diese Zelle ausgeführt. Die frisch eingesetzte Bombe zählt selbst als „getroffene Bubble“ und bringt 15 Punkte. Nachbarn des tatsächlich kollidierten Ziels können stehen bleiben.
- **Auswirkung:** Explosion und Punktestand widersprechen dem sichtbaren Treffer und der Dokumentation „getroffene Bubble + alle 6 Nachbarn“.
- **Lösungsvorschlag:** Explosion direkt um `{row, col}` aus `checkCollision()` ausführen, ohne die Projektil-Bubble ins Grid einzusetzen. Nur bereits vorhandene Grid-Bubbles zählen und bepunktet werden.

## 🚨 Hoch – Fünfter Schuss kann Game-Over auslösen, bevor sein Treffer ausgewertet wird
- **Kategorie:** Prozess-Lücke / State Transition
- **Betroffene Datei(en) / Komponente(n):** `index.htm:748-753`, `index.htm:1083-1113`
- **Problembeschreibung:** Die neue Reihe wird unmittelbar beim Abschuss eingefügt, nicht nach Platzierung und Match-Auflösung. `addRow()` ruft sofort `checkGameOver()` auf. Ein fünfter Schuss, der durch Match/Floating das Feld retten würde, kann deshalb vor seinem Einschlag abgebrochen werden; `triggerGameOver()` setzt `activeBubble = null`.
- **Auswirkung:** Spieler verlieren trotz eines bereits abgefeuerten rettenden Schusses. Die Reihenfolge ist aus Nutzersicht unfair und erzeugt eine Sackgasse im laufenden Zug.
- **Lösungsvorschlag:** Einen Zug erst nach Platzierung vollständig abschließen: `place → resolve effect/match → floating → increment shot → optional addRow → game-over/win`. Diese Transition in eine zentrale `resolveTurn()`-Methode verlagern.

## 🚨 Hoch – Touch schießt vor dem Zielen
- **Kategorie:** UX / Mobile Workflow
- **Betroffene Datei(en) / Komponente(n):** `index.htm:600-624`; `README.md:73-80`
- **Problembeschreibung:** `touchstart` ruft sofort `handleClick()` auf. `touchmove`, das Winkel und Trajektorie aktualisiert, kann naturgemäß erst danach eintreten. Ein Drag-to-aim-and-release-Workflow ist unmöglich.
- **Auswirkung:** Mobile Nutzer müssen blind beim ersten Kontakt schießen; die Zielvorschau ist vor dem Schuss nicht nutzbar. Die Steuerung ist nicht äquivalent zur Desktop-Interaktion.
- **Lösungsvorschlag:** Auf `pointerdown` mit Pointer Capture beginnen, während `pointermove` zielen und erst bei `pointerup` schießen. Maus und Touch über Pointer Events vereinheitlichen.

## 🚨 Hoch – Hilfe und Menü sind sichtbare, aber funktionslose Sackgassen
- **Kategorie:** Fehlende Funktion / UI-Inkonsistenz
- **Betroffene Datei(en) / Komponente(n):** `index.htm:174-197`, `index.htm:337-339`, `index.htm:598-636`
- **Problembeschreibung:** `#helpBtn` und `#menuBtn` haben Pointer-Cursor und Hover-Effekt, werden im JavaScript aber nie referenziert und erhalten keine Listener.
- **Auswirkung:** Zwei prominent angebotene Prozesse enden ohne Reaktion. Nutzer erhalten weder Spielanleitung noch Pause/Einstellungen und verlieren Vertrauen in weitere Controls.
- **Lösungsvorschlag:** Vor Release entweder echte Hilfe-/Pause-Overlays implementieren oder beide Controls vollständig entfernen. Bei Implementierung native Buttons und Escape-/Back-Navigation vorsehen.

## 🚨 Hoch – Power-ups besitzen trotz dokumentiertem Maximum keine Verbrauchsressource
- **Kategorie:** Logik-Lücke / Balancing
- **Betroffene Datei(en) / Komponente(n):** `index.htm:786-815`; `docs/wiki/powerups.md:7-12`, `docs/wiki/powerups.md:163-176`
- **Problembeschreibung:** Die Dokumentation nennt je Power-up maximal eine Aufladung und setzt Power-ups bei Levelwechsel zurück. Im State existiert jedoch nur „armed/active“. Nach jedem Schuss kann die Bombe oder Zielhilfe sofort erneut aktiviert werden; eine verfügbare Aufladung wird nie verbraucht.
- **Auswirkung:** Bomben sind unbegrenzt verfügbar und trivialisieren Match-, Floating- und Progressionsmechanik. UI und dokumentierter Ressourcenstatus stimmen nicht überein.
- **Lösungsvorschlag:** Explizite Counts wie `bombCharges` und `aimCharges` einführen, beim Aktivieren/Abschuss atomar verbrauchen, Buttons bei 0 deaktivieren und Count zugänglich anzeigen. Falls unbegrenzte Nutzung gewollt ist, Dokumentation, UI und Balancing entsprechend ändern.

## 🚨 Hoch – Spielgeschwindigkeit hängt von der Display-Hz-Zahl ab
- **Kategorie:** Bug / Asynchronitäts-Management
- **Betroffene Datei(en) / Komponente(n):** `index.htm:723-728`, `index.htm:760-765`, `index.htm:1186-1205`
- **Problembeschreibung:** Die Bubble bewegt sich fest um 8 Pixel pro `requestAnimationFrame`. Es gibt keine Delta-Time. Auf 120-Hz-Displays fliegt sie ungefähr doppelt so schnell wie bei 60 Hz. Bei kleinen Radien kann der 8-Pixel-Schritt komplette Bubbles überspringen, da Kollisionen nur nach jedem diskreten Schritt geprüft werden.
- **Auswirkung:** Gameplay, Reaktionszeit und Kollisionszuverlässigkeit sind geräteabhängig; Highscores sind nicht vergleichbar. Auf dem kollabierten mobilen Grid ist Tunneling besonders wahrscheinlich.
- **Lösungsvorschlag:** RAF-Timestamp verwenden (`position += velocityPxPerSecond * deltaSeconds`), Delta begrenzen und für schnelle Bewegungen Swept-/Substep-Collision einsetzen.

## 🚨 Hoch – Das ausgewiesene Highscore-Ziel existiert nicht
- **Kategorie:** Fehlende Kernfunktion / Produktinkonsistenz
- **Betroffene Datei(en) / Komponente(n):** `README.md:14-16`, `index.htm:327-335`, `index.htm:862-872`
- **Problembeschreibung:** Die README definiert das Erreichen eines Highscores als Spielziel. Die Anwendung zeigt und speichert ausschließlich den aktuellen Score; beim Neustart wird er auf 0 gesetzt. Es gibt weder Session-Bestwert noch persistierten Highscore.
- **Auswirkung:** Der zentrale Endlosmodus besitzt kein nachhaltiges Ziel und kein Feedback, ob ein neuer Rekord erreicht wurde.
- **Lösungsvorschlag:** Produktentscheidung explizit treffen. Für echten Highscore einen validierten Bestwert speichern, im UI anzeigen und beim Game-Over „Neuer Highscore“ kommunizieren. Falls Persistenz unerwünscht ist, mindestens einen Session-Highscore führen und README anpassen.

---

# 🟠 Mittel

## 🚨 Mittel – Farbmatching ist ausschließlich farbcodiert
- **Kategorie:** Accessibility / UI
- **Betroffene Datei(en) / Komponente(n):** `index.htm:361`, `index.htm:1149-1176`
- **Problembeschreibung:** Acht Bubble-Typen unterscheiden sich nur über Farbe. Es gibt keine Muster, Symbole, Konturen oder alternative Palette.
- **Auswirkung:** Nutzer mit Farbsehschwächen können spielrelevante Typen nicht zuverlässig unterscheiden.
- **Lösungsvorschlag:** Jede Farbe zusätzlich mit eindeutigem Symbol/Muster rendern oder einen farbenblindfreundlichen Modus mit reduzierter, geprüfter Palette anbieten.

## 🚨 Mittel – Game-Over-Overlay kommuniziert Zustand nicht zugänglich und verwaltet Fokus nicht
- **Kategorie:** Accessibility / Feedback
- **Betroffene Datei(en) / Komponente(n):** `index.htm:203-255`, `index.htm:315-321`, `index.htm:837-861`
- **Problembeschreibung:** Das Overlay wird nur visuell eingeblendet. Es gibt keine Live-Ankündigung, Dialogsemantik, Fokusverschiebung oder Rückgabe des Fokus nach Restart.
- **Auswirkung:** Assistive Technologien bemerken das Spielende unter Umständen nicht; Keyboard-Nutzer müssen den Neustart-Button erst suchen.
- **Lösungsvorschlag:** `role="dialog"`, `aria-modal`, Label-/Description-Referenzen, Fokus auf `restartBtn` und saubere Fokus-Rückgabe implementieren.

## 🚨 Mittel – Score und Level sind semantisch unlabeled
- **Kategorie:** Accessibility / UI-Inkonsistenz
- **Betroffene Datei(en) / Komponente(n):** `index.htm:327-335`, `index.htm:1122-1139`
- **Problembeschreibung:** Die Bedeutung der Zahlen ergibt sich ausschließlich aus Emoji-Icons. Es gibt keine sichtbaren oder versteckten Labels und keine Live-Region für Änderungen.
- **Auswirkung:** Screenreader geben potenziell nur „Stern, 1, Pokal, 0“ aus; Score und Level sind nicht eindeutig.
- **Lösungsvorschlag:** Textlabels („Level“, „Punkte“) ergänzen, dekorative Emojis mit `aria-hidden="true"` versehen und Score-Updates sparsam über `aria-live="polite"` melden.

## 🚨 Mittel – Resize kann einen laufenden Schuss teleportieren oder verwerfen
- **Kategorie:** Bug / Responsive State
- **Betroffene Datei(en) / Komponente(n):** `index.htm:402-455`, `index.htm:518-536`, `index.htm:760-783`
- **Problembeschreibung:** Beim Resize werden Radius, Canvas, Grid und Shooter neu skaliert. Eine aktive Bubble erhält aber nur einen neuen Radius und ein X-Clamping; Y und Geschwindigkeit bleiben im alten Koordinatensystem.
- **Auswirkung:** Bei Rotation oder Fenstergrößenwechsel springt die Bubble, kollidiert unerwartet oder wird unterhalb des neuen Canvas kommentarlos verworfen, obwohl Queue/Schuss bereits verbraucht wurden.
- **Lösungsvorschlag:** Während eines aktiven Schusses Resize aufschieben, den Schuss kontrolliert abbrechen und zurückerstatten oder alle Positionen/Geschwindigkeiten proportional transformieren.

## 🚨 Mittel – Game Loop läuft nach Game-Over und bei statischem Zustand endlos weiter
- **Kategorie:** Performance / Ressourcenmanagement
- **Betroffene Datei(en) / Komponente(n):** `index.htm:848-859`, `index.htm:1186-1205`
- **Problembeschreibung:** `requestAnimationFrame()` wird bedingungslos erneut geplant. Auch nach Game-Over werden Grid und teure Radialverläufe in jedem Frame neu gezeichnet.
- **Auswirkung:** Unnötige CPU-/GPU- und Akku-Last, besonders auf Mobilgeräten. Mehrfachinstanziierung würde zusätzlich mehrere permanente Loops erzeugen.
- **Lösungsvorschlag:** Physik und Rendering über `dirty`/`gameRunning` steuern, bei Game-Over stoppen und bei Restart einmalig wieder starten; `visibilitychange` berücksichtigen.

## 🚨 Mittel – Keine Tests und keine CI schützen die nachweislich fragilen Invarianten
- **Kategorie:** QA / Release-Risiko
- **Betroffene Datei(en) / Komponente(n):** Repository-Root, `.github/workflows/` (fehlend), Testdateien (fehlend)
- **Problembeschreibung:** Es existieren weder Tests noch Lint-/Format-/Browser-/Accessibility-Gates. Die Paritäts-, Winkel-, Mobile- und Dead-Control-Fehler bleiben dadurch unbemerkt.
- **Auswirkung:** Jede Änderung an der 1.215-Zeilen-Datei kann Kernmechaniken regressieren; es gibt keine reproduzierbare Definition von „releasefähig“.
- **Lösungsvorschlag:** Zunächst dependency-freie Node-Tests für pure Grid-/Turn-Funktionen; anschließend Playwright für Desktop/Mobile, Tastatur und Game-Over. CI mindestens mit Syntaxcheck, Tests, Linkcheck und Deployment-Smoke-Test.

## 🚨 Mittel – Monolithische Klasse verhindert tiefe, testbare Modulgrenzen
- **Kategorie:** Architektur / Wartbarkeit
- **Betroffene Datei(en) / Komponente(n):** `index.htm:345-1207`; `agent.md:21-35`
- **Problembeschreibung:** Eine Klasse mit rund 47 Methoden übernimmt DOM-Auflösung, Layout, Input, Geometrie, Spielstate, Scoring, Rendering und Workflow. `agent.md` schreibt diese Konzentration sogar für jede neue Funktion verbindlich vor. Der doppelte Offset-/Paritätsmechanismus ist bereits ein konkretes Symptom mangelnder Änderungslokalität.
- **Auswirkung:** Logik lässt sich nur mit Browser-/DOM-Stubs testen; Änderungen haben große Blast Radius und erhöhen Merge-Konflikte.
- **Lösungsvorschlag:** Zero Dependencies beibehalten, aber tiefe Module extrahieren: `HexGrid` (pure Topologie), `GameSession` (Turn/Score/Power-ups), `Renderer` und `BrowserInput`. Die Single-Page-Auslieferung kann über ES-Module weiterhin buildlos bleiben.

## 🚨 Mittel – GitHub-Pages-Hinweis liefert ohne zusätzliche Konfiguration keine Startseite
- **Kategorie:** Deployment / Dokumentation
- **Betroffene Datei(en) / Komponente(n):** `README.md:103-109`, `index.htm`
- **Problembeschreibung:** README behauptet, Push in einen `gh-pages`-Branch genüge. Der Entry Point heißt jedoch `index.htm`; übliche GitHub-Pages-Rootauflösung erwartet `index.html`, `index.md` oder `README.md`. Eine Pages-Workflow-/Source-Konfiguration fehlt.
- **Auswirkung:** Das dokumentierte Deployment kann am Root mit 404 statt dem Spiel enden.
- **Lösungsvorschlag:** Datei in `index.html` umbenennen oder im Deployment entsprechend kopieren, Pages-Quelle/Workflow konfigurieren und die veröffentlichte Root-URL automatisiert prüfen.

## 🚨 Mittel – Levelwechsel setzt den Row-Push-Zyklus nicht eindeutig zurück
- **Kategorie:** Prozess-Inkonsistenz
- **Betroffene Datei(en) / Komponente(n):** `index.htm:750-753`, `index.htm:862-872`, `index.htm:1074-1081`; `docs/architecture.md:142`, `docs/wiki/data-model.md:127`
- **Problembeschreibung:** `nextLevel()` setzt `shotsFired` nicht zurück. Die Dokumentation bezeichnet den Zähler einmal als „seit letztem Row-Push“, an anderer Stelle als „seit Spielstart“. Ein neues Level kann daher abhängig vom alten Rest bereits nach ein bis vier Schüssen eine Reihe erhalten.
- **Auswirkung:** Level starten mit nicht sichtbarer, inkonsistenter Row-Push-Frist; Nutzer können den nächsten Push nicht nachvollziehen.
- **Lösungsvorschlag:** Semantik festlegen. Für „Schüsse bis nächste Reihe“ einen Countdown-State verwenden und bei Row-Push/Levelstart explizit zurücksetzen sowie im UI anzeigen.

## 🚨 Mittel – Endlosmodus und Level-Gewinnmodell widersprechen sich
- **Kategorie:** Produktlogik / Dokumentation
- **Betroffene Datei(en) / Komponente(n):** `README.md:14-16`, `README.md:84-91`, `docs/wiki/level-system.md:79-109`
- **Problembeschreibung:** Das Produkt wird als klassischer Endlosmodus „ohne Gewinnen“ und gleichzeitig als Folge leerbarer Levels beschrieben. Beim Leeren wird ein volles 8×15-Grid erzeugt; es gibt aber keinerlei Schwierigkeitserhöhung.
- **Auswirkung:** Ziel, Progression und Bedeutung der Levelanzeige bleiben unklar. Ein Levelwechsel fühlt sich wie ein Reset ohne Belohnung oder neue Herausforderung an.
- **Lösungsvorschlag:** Einen Modus klar wählen oder beide explizit modellieren. Bei Levels messbare Progression/Feedback hinzufügen; beim reinen Endless Mode Levelbegriff entfernen und Schwierigkeit zeit-/row-basiert erhöhen.

---

# 🟡 Niedrig

## 🚨 Niedrig – Aim-/Power-up-Zustand wird nur visuell kommuniziert
- **Kategorie:** Accessibility / UI-State
- **Betroffene Datei(en) / Komponente(n):** `index.htm:169-172`, `index.htm:805-808`
- **Problembeschreibung:** `setPowerUpState()` toggelt nur eine CSS-Klasse. Es gibt kein `aria-pressed`, keinen Restladungs-Text und kein Statusfeedback.
- **Auswirkung:** Der Zustand ist für Screenreader unsichtbar und visuell nur über Rand/Glow erkennbar.
- **Lösungsvorschlag:** `aria-pressed`, deaktivierten Zustand und sichtbaren/zugänglichen Ladungszähler synchron aktualisieren.

## 🚨 Niedrig – Zielhilfe-Linie hat schwachen Kontrast
- **Kategorie:** UI / Accessibility
- **Betroffene Datei(en) / Komponente(n):** `index.htm:199-204`
- **Problembeschreibung:** Türkis `#00bcd4` mit `opacity: 0.7` liegt auf einem sehr hellen Hintergrund; der effektive Kontrast bleibt unter dem empfohlenen 3:1-Wert für funktionale grafische Objekte.
- **Auswirkung:** Die wichtigste Zielrückmeldung ist bei geringer Sehkraft oder hellem Umgebungslicht schwer erkennbar.
- **Lösungsvorschlag:** Dunklere, voll deckende Linie mit kontrastierender Kontur verwenden und beide Zustände per visueller Prüfung absichern.

## 🚨 Niedrig – Blockierte Schüsse werden kommentarlos ignoriert
- **Kategorie:** UX / Feedback
- **Betroffene Datei(en) / Komponente(n):** `index.htm:714-722`
- **Problembeschreibung:** Während eine Bubble fliegt, beendet `shootBubble()` weitere Eingaben still.
- **Auswirkung:** Schnelle Klicks/Taps wirken defekt; Nutzer verstehen nicht, wann erneut geschossen werden kann.
- **Lösungsvorschlag:** Shooter während des Flugs sichtbar deaktivieren oder einen kurzen visuellen Impuls geben; `aria-disabled` synchronisieren.

## 🚨 Niedrig – Dokumentation enthält gebrochene und widersprüchliche Details
- **Kategorie:** Dokumentation / Inkonsistenz
- **Betroffene Datei(en) / Komponente(n):** `docs/wiki/index.md:15-18`, `docs/game-mechanics.md:24-37`, `docs/game-mechanics.md:155-185`, `agent.md:138-147`, `index.htm:388-389`, `index.htm:1209-1212`
- **Problembeschreibung:** Der Wiki-Link `../README.md` zeigt auf das nicht existente `docs/README.md`; Grid-Positionierung wird als reine `row % 2`-Logik beschrieben, obwohl `rowOffsets` genutzt wird; Floating wird als BFS bezeichnet, ist rekursive DFS; globale Listener sind laut Regel nur in `setupEventListeners()` erlaubt, Resize und Load liegen aber außerhalb.
- **Auswirkung:** Entwickler und KI-Agenten implementieren gegen eine falsche Spezifikation; Dokumentation kann bestehende Fehler verstärken.
- **Lösungsvorschlag:** Link auf `../../README.md` korrigieren, Topologie nach der Codekorrektur eindeutig dokumentieren und Markdown-Linkcheck in CI aufnehmen.

## 🚨 Niedrig – Resize-Handler ist nicht gedrosselt
- **Kategorie:** Performance
- **Betroffene Datei(en) / Komponente(n):** `index.htm:388-389`, `index.htm:402-536`
- **Problembeschreibung:** Jedes Resize-Event stößt Layoutmessung, CSS-Mutation und vollständige Grid-Neupositionierung an.
- **Auswirkung:** Kontinuierliches Resizing/Rotation kann Layout-Thrashing und Ruckeln verursachen.
- **Lösungsvorschlag:** Änderungen per `requestAnimationFrame` bündeln oder debouncen; Reads und Writes phasenweise trennen.

---

# 💡 Vorschläge

## 🚨 Vorschlag – Zugauflösung als atomare State Machine modellieren
- **Kategorie:** Architektur / Prozesssicherheit
- **Betroffene Datei(en) / Komponente(n):** `index.htm:714-1113`
- **Problembeschreibung:** Queue-Rotation, Power-up-Verbrauch, Row-Push, Platzierung, Match, Level und Game-Over sind über mehrere Methoden verteilt und teilweise in ungünstiger Reihenfolge gekoppelt.
- **Auswirkung:** Teilweise abgeschlossene Züge erzeugen schwer testbare Zwischenzustände, etwa verbrauchte Schüsse ohne Platzierung.
- **Lösungsvorschlag:** Zustände `aiming → flying → resolving → rowPush → terminal/aiming` definieren. Nur `resolveTurn()` darf Queue, Charges, Schusszähler und Progression committen.

## 🚨 Vorschlag – Visuelles Erfolgs-/Fehlerfeedback ergänzen
- **Kategorie:** UX
- **Betroffene Datei(en) / Komponente(n):** `index.htm:965-986`, `index.htm:1026-1052`, `index.htm:1122-1139`
- **Problembeschreibung:** Matches, Floating und Bomben ändern nur statisch den Score; es gibt keine lokale Erklärung oder Rückmeldung.
- **Auswirkung:** Nutzer erkennen kaum, warum sich Punkte geändert haben und welche Mechanik ausgelöst wurde.
- **Lösungsvorschlag:** Kurze Pop-/Fallanimation, `+30`-Feedback, klarer Power-up-Verbrauch und dezente Fehlerzustände ergänzen; `prefers-reduced-motion` respektieren.

## 🚨 Vorschlag – Release-Gate und Definition of Done einführen
- **Kategorie:** QA / Delivery
- **Betroffene Datei(en) / Komponente(n):** Repository-Root
- **Problembeschreibung:** „Funktional“ und „vollständig optimiert“ sind derzeit nicht durch reproduzierbare Checks gedeckt.
- **Auswirkung:** Dokumentationsclaims können dem tatsächlichen Produktzustand vorauslaufen.
- **Lösungsvorschlag:** Minimaler Gate: Syntax/Lint, pure Game-Logic-Tests, 4 Viewport-Smokes, Keyboard-Smoke, Accessibility-Scan, Linkcheck und veröffentlichte Root-URL. README-Status erst danach auf „funktional“ setzen.

---

# Empfohlene Behebungsreihenfolge

1. **Mobile Geometrie/Layout reparieren** und Viewport-Tests hinzufügen.
2. **Eine einzige Hex-Topologie-Invariante** einführen; Matches/Floating/Bomben testen.
3. **Aim-Vektor zentralisieren** und abwärts gerichtete Schüsse verhindern.
4. **Turn Resolution atomarisieren**, Row-Push erst nach Trefferauflösung durchführen.
5. **Collision-Ziel bis zur Platzierung/Bombe erhalten.**
6. **Pointer- und Keyboard-Workflows** implementieren; Controls semantisch korrigieren.
7. **Dead Controls und Power-up-Charges** klären/implementieren.
8. **Delta-Time, Loop-Stopp und Resize-State** korrigieren.
9. **CI, Deployment und Dokumentation** synchronisieren.

# Release-Empfehlung

**NO-GO.** Vor einem öffentlichen Release müssen mindestens beide kritischen und die ersten sechs hohen Befunde behoben sowie durch automatisierte Regressionstests abgesichert werden.
