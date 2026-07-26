// Pure hex-grid topology and geometry: no DOM, no scoring, no rendering.
// Extracted from BubbleShooter (src/bubbleShooter.js) as the single source of
// truth for row-offset parity, neighbor adjacency and bubble positions —
// callers (game/session logic) own score, turn resolution and UI updates.
export class HexGrid {
    constructor(canvasWidth) {
        this.bubbleRadius = 20;
        this.gridTopOffset = 0 + this.bubbleRadius;
        this.rowHeight = this.bubbleRadius * Math.sqrt(3);
        this.grid = [];
        this.columnCount = 0;
        this.rowOffsets = [];
        this.gridLeftOffset = 0;
        this.gridLeftEdge = 0;
        this.gridRightEdge = canvasWidth;
        this.gridWidth = canvasWidth;
    }

    getRowOffset(row) {
        if (row < 0) return 0;
        const flag = this.getRowOffsetFlag(row);
        return flag * this.bubbleRadius;
    }

    /**
     * Liefert den gespeicherten Versatz einer Grid-Zeile und ergänzt ihn bei Bedarf.
     *
     * @param {number} row Grid-Zeile
     * @returns {number} 0 für linksbündig, 1 für um einen Radius versetzt
     */
    getRowOffsetFlag(row) {
        if (row < 0) return 0;
        if (this.rowOffsets[row] !== undefined) {
            return this.rowOffsets[row];
        }
        if (row === 0) {
            this.rowOffsets[row] = 0;
            return 0;
        }
        const previousFlag = this.getRowOffsetFlag(row - 1);
        const flag = previousFlag === 0 ? 1 : 0;
        this.rowOffsets[row] = flag;
        return flag;
    }

    /**
     * Berechnet die Canvas-Position einer Grid-Zelle.
     *
     * @param {number} row Grid-Zeile
     * @param {number} col Grid-Spalte
     * @returns {{x: number, y: number}} Mittelpunkt der Zelle im Canvas-Raum
     */
    getBubblePosition(row, col) {
        const offsetX = this.getRowOffset(row);
        const x = this.gridLeftOffset + col * (this.bubbleRadius * 2) + this.bubbleRadius + offsetX;
        const y = this.gridTopOffset + row * this.rowHeight;
        return { x, y };
    }

    /**
     * Erzeugt eine Grid-Bubble an einer berechneten Hex-Position.
     *
     * @param {number} row Grid-Zeile
     * @param {number} col Grid-Spalte
     * @param {string} color HEX-Farbe der Bubble
     * @returns {{color: string, x: number, y: number, radius: number}} Neue Bubble
     */
    createBubble(row, col, color) {
        const { x, y } = this.getBubblePosition(row, col);
        return {
            color,
            x,
            y,
            radius: this.bubbleRadius
        };
    }

    /** Stellt sicher, dass grid[row] existiert und mindestens columnCount Slots hat. */
    ensureRowSlot(row) {
        if (!this.grid[row]) {
            this.grid[row] = new Array(this.columnCount);
        } else if (this.grid[row].length < this.columnCount) {
            this.grid[row].length = this.columnCount;
        }
    }

    /**
     * Setzt alle x/y/radius-Werte im Grid aus der aktuellen Geometrie neu.
     */
    syncPositions() {
        if (!this.grid) return;
        for (let row = 0; row < this.grid.length; row++) {
            const rowArray = this.grid[row];
            if (!rowArray) continue;
            for (let col = 0; col < rowArray.length; col++) {
                const bubble = rowArray[col];
                if (!bubble) continue;
                const { x, y } = this.getBubblePosition(row, col);
                bubble.x = x;
                bubble.y = y;
                bubble.radius = this.bubbleRadius;
            }
        }
    }

    /**
     * Liefert vorhandene Bubble-Nachbarn einer Zelle entsprechend der Hex-Topologie.
     *
     * @param {number} row Ausgangs-Zeile
     * @param {number} col Ausgangs-Spalte
     * @returns {Array<{r: number, c: number}>} Belegte Nachbarpositionen
     */
    getNeighbors(row, col) {
        const neighbors = [];
        const deltas = this.getRowOffsetFlag(row) === 0
            ? [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]]
            : [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]];

        const addNeighbor = (r, c) => {
            if (r < 0 || r >= this.grid.length) return;
            const rowArray = this.grid[r];
            if (!rowArray) return;
            if (c < 0 || c >= rowArray.length) return;
            if (!rowArray[c]) return;
            neighbors.push({ r, c });
        };

        deltas.forEach(([dr, dc]) => addNeighbor(row + dr, col + dc));

        return neighbors;
    }

    // Coordinates of empty cells adjacent to (row, col), following the
    // same hex-neighbor topology as getNeighbors().
    /**
     * Liefert freie, direkt benachbarte Kandidaten für eine Platzierung.
     *
     * @param {number} row Referenz-Zeile
     * @param {number} col Referenz-Spalte
     * @returns {Array<{row: number, col: number}>} Freie Nachbarzellen
     */
    getLocalCandidates(row, col) {
        const flag = this.getRowOffsetFlag(row);
        const deltas = flag === 0
            ? [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]]
            : [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]];
        const candidates = [];
        deltas.forEach(([dr, dc]) => {
            const r = row + dr;
            const c = col + dc;
            if (r < 0 || c < 0 || c >= this.columnCount) return;
            const rowArray = this.grid[r];
            if (rowArray && rowArray[c]) return;
            candidates.push({ row: r, col: c });
        });
        return candidates;
    }

    /**
     * Wählt die freie Grid-Zelle, die einer Landekoordinate am nächsten liegt.
     *
     * @param {number} x Lande-X im Canvas-Raum
     * @param {number} y Lande-Y im Canvas-Raum
     * @param {{row: number, col: number}|null} collision Getroffene Zelle oder null
     * @returns {{row: number, col: number}} Beste freie Position
     */
    findBestPosition(x, y, collision) {
        let candidates;
        if (collision) {
            candidates = this.getLocalCandidates(collision.row, collision.col);
        } else {
            candidates = [];
            const topRow = this.grid[0];
            for (let col = 0; col < this.columnCount; col++) {
                if (!topRow || !topRow[col]) {
                    candidates.push({ row: 0, col });
                }
            }
        }

        if (candidates.length === 0) {
            // Fallback: no free local slot (fully packed pocket) —
            // search the whole grid so the bubble doesn't vanish.
            const maxRows = this.grid.length + 1;
            for (let row = 0; row < maxRows; row++) {
                const rowArray = this.grid[row] ? this.grid[row] : [];
                for (let col = 0; col < this.columnCount; col++) {
                    if (!rowArray[col]) candidates.push({ row, col });
                }
            }
        }

        let bestRow = -1;
        let bestCol = -1;
        let minDistance = Infinity;
        candidates.forEach(({ row, col }) => {
            const { x: gridX, y: gridY } = this.getBubblePosition(row, col);
            const distance = Math.hypot(x - gridX, y - gridY);
            if (distance < minDistance) {
                minDistance = distance;
                bestRow = row;
                bestCol = col;
            }
        });

        return { row: bestRow, col: bestCol };
    }

    /**
     * Findet alle gleichfarbigen, per Hex-Nachbarschaft verbundenen Bubbles.
     *
     * @param {number} row Start-Zeile
     * @param {number} col Start-Spalte
     * @param {string} color Zu suchende HEX-Farbe
     * @param {Set<string>} [visited=new Set()] Bereits besuchte Zellen
     * @returns {Array<{r: number, c: number}>} Gefundene Grid-Positionen
     */
    findMatches(row, col, color, visited = new Set()) {
        const key = `${row}-${col}`;
        const rowArray = this.grid[row];
        if (!rowArray) return [];
        const bubble = rowArray[col];
        if (!bubble || bubble.color !== color || visited.has(key)) return [];

        visited.add(key);
        let matches = [{ r: row, c: col }];

        const neighbors = this.getNeighbors(row, col);
        neighbors.forEach(({ r, c }) => {
            matches = matches.concat(this.findMatches(r, c, color, visited));
        });

        return matches;
    }

    markConnected(row, col, connected) {
        const key = `${row}-${col}`;
        if (connected.has(key) || !this.grid[row] || !this.grid[row][col]) return;

        connected.add(key);
        const neighbors = this.getNeighbors(row, col);
        neighbors.forEach(({ r, c }) => {
            this.markConnected(r, c, connected);
        });
    }

    /**
     * Entfernt alle Bubbles ohne Verbindung zur obersten Reihe.
     *
     * @returns {number} Anzahl entfernter Bubbles
     */
    removeFloatingBubbles() {
        const connected = new Set();

        // Mark all bubbles connected to the top
        const topRow = this.grid[0] || [];
        for (let col = 0; col < topRow.length; col++) {
            if (topRow[col]) {
                this.markConnected(0, col, connected);
            }
        }

        // Remove unconnected bubbles
        let removed = 0;
        for (let row = 0; row < this.grid.length; row++) {
            for (let col = 0; col < this.grid[row].length; col++) {
                if (this.grid[row][col] && !connected.has(`${row}-${col}`)) {
                    delete this.grid[row][col];
                    removed++;
                }
            }
        }

        return removed;
    }

    /**
     * Entfernt die getroffene Bubble und ihre direkten Hex-Nachbarn.
     *
     * @param {number} row Mittelpunkt-Zeile
     * @param {number} col Mittelpunkt-Spalte
     * @returns {number} Anzahl entfernter Bubbles
     */
    removeBombCluster(row, col) {
        let removed = 0;
        const toRemove = new Set([`${row}-${col}`]);
        this.getNeighbors(row, col).forEach(({ r, c }) => {
            toRemove.add(`${r}-${c}`);
        });

        toRemove.forEach((key) => {
            const [r, c] = key.split('-').map(Number);
            const rowArray = this.grid[r];
            if (rowArray && rowArray[c]) {
                delete rowArray[c];
                removed++;
            }
        });

        return removed;
    }

    /**
     * Prüft, ob das Grid keine Bubble mehr enthält.
     *
     * @returns {boolean} true bei leerem Grid
     */
    checkWinCondition() {
        for (let row = 0; row < this.grid.length; row++) {
            for (let col = 0; col < this.grid[row].length; col++) {
                if (this.grid[row][col]) return false;
            }
        }
        return true;
    }

    /**
     * Sucht die erste Grid-Bubble, die sich mit einer fliegenden Bubble überschneidet.
     *
     * @param {{x: number, y: number, radius: number}} bubble Fliegende Bubble
     * @returns {{row: number, col: number}|null} Getroffene Grid-Zelle oder null
     */
    checkCollision(bubble) {
        for (let row = 0; row < this.grid.length; row++) {
            const rowArray = this.grid[row];
            if (!rowArray) continue;
            for (let col = 0; col < rowArray.length; col++) {
                const gridBubble = rowArray[col];
                if (!gridBubble) continue;

                const dx = bubble.x - gridBubble.x;
                const dy = bubble.y - gridBubble.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const gridRadius = gridBubble.radius || this.bubbleRadius;
                const movingRadius = bubble.radius || this.bubbleRadius;
                if (distance < movingRadius + gridRadius) {
                    return { row, col };
                }
            }
        }
        return null;
    }

    /** Fügt am oberen Rand eine neue Bubble-Reihe ein. */
    pushRow(colorProvider) {
        const cols = this.columnCount;
        const firstFlag = this.rowOffsets[0] ?? 0;
        const newFlag = firstFlag === 0 ? 1 : 0;
        this.rowOffsets.unshift(newFlag);
        const newRow = new Array(cols);
        for (let col = 0; col < cols; col++) {
            newRow[col] = this.createBubble(0, col, colorProvider());
        }

        for (let row = this.grid.length - 1; row >= 0; row--) {
            if (!this.grid[row]) continue;
            this.grid[row + 1] = this.grid[row];
        }

        this.grid[0] = newRow;
    }
}
