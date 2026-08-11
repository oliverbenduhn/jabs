// Extracted verbatim from the former inline <script> in index.htm.
// Pure lift-and-shift: no logic changes. Enables real ES-module imports
// for tests and subsequent module splits (HexGrid, GameSession, Renderer, ...).
import { HexGrid } from './hexGrid.js';

export class BubbleShooter {
    /**
     * Erstellt das Spiel, bindet DOM-Elemente und startet Initialisierung sowie Game-Loop.
     */
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.trajectoryLine = document.getElementById('trajectoryLine');
        this.trajectory = document.getElementById('trajectory');
        this.aimBtn = document.getElementById('aimBtn');
        this.bombBtn = document.getElementById('bombBtn');
        this.overlay = document.getElementById('gameOverlay');
        this.overlayTitle = document.getElementById('overlayTitle');
        this.overlayMessage = document.getElementById('overlayMessage');
        this.restartBtn = document.getElementById('restartBtn');
        this.helpBtn = document.getElementById('helpBtn');
        this.menuBtn = document.getElementById('menuBtn');
        this.helpOverlay = document.getElementById('helpOverlay');
        this.helpCloseBtn = document.getElementById('helpCloseBtn');
        this.menuOverlay = document.getElementById('menuOverlay');
        this.menuScoreEl = document.getElementById('menuScore');
        this.resumeBtn = document.getElementById('resumeBtn');
        this.menuRestartBtn = document.getElementById('menuRestartBtn');
        this.srStatus = document.getElementById('srStatus');
        this.highscoreEl = document.getElementById('highscore');
        this.currentBubbleEl = document.getElementById('currentBubble');

        this.topPadding = 0;
        this.hexGrid = new HexGrid(this.canvas.width);
        this.topBoundary = this.hexGrid.gridTopOffset - this.hexGrid.bubbleRadius;
        this.radiusScaleFactor = 1;
        this.colors = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ff924c', '#2ec4b6', '#f72585'];
        // Distinct glyph per color so matching doesn't rely on color
        // perception alone (colorblind-accessible).
        this.colorSymbols = {
            '#ff595e': '●',
            '#ffca3a': '▲',
            '#8ac926': '■',
            '#1982c4': '◆',
            '#6a4c93': '★',
            '#ff924c': '✚',
            '#2ec4b6': '▼',
            '#f72585': '◉',
        };
        this.currentBubble = null;
        this.nextBubbles = [];
        this.score = 0;
        this.highscore = 0;
        this.storageKey = 'jabs-save-v1';
        this.level = 1;
        this.gameRunning = true;
        this.paused = false;
        this.activeDialogTrigger = null;
        this.shotsFired = 0;
        this.shotsPerRow = 5;
        this.bubbleSpeedPxPerSecond = 480;
        this.normalTrajectoryLength = 200;
        this.aimAssistTrajectoryLength = 280;
        this.trajectoryVerticalEpsilon = 0.0001;
        this.collisionSubstepRadiusFactor = 0.5;
        this.maxCollisionSubsteps = 50;
        this.maxFrameDeltaMs = 100;
        this.shooterBottomOffset = 100;
        this.activeBubble = null;
        this.baseAngleLimit = Math.PI / 2.5;
        this.aimAngleLimit = Math.PI / 1.8;
        this.currentAngleLimit = this.baseAngleLimit;
        this.keyboardAimDelta = 0;
        this.keyboardAimStep = Math.PI / 36;
        this.aimAssistShots = 0;
        this.bombArmed = false;
        this.maxPowerUpCharges = 1;
        this.bombCharges = this.maxPowerUpCharges;
        this.aimCharges = this.maxPowerUpCharges;
        this.fixedColumns = 15;
        this.initialRows = 8;
        this.bottomFreeRows = 10;

        this.shooter = {
            x: this.canvas.width / 2,
            y: this.canvas.height - this.shooterBottomOffset,
            angle: -Math.PI / 2
        };

        this.resizeCanvas();

        this.loopHandle = null;
        this.lastFrameTime = null;

        this.initializeGame();
        this.setupEventListeners();
        this.startGameLoop();
    }
    
    resizeCanvas() {
        const container = document.querySelector('.canvas-container');
        const gameArea = document.querySelector('.game-area');
        const gameContainer = document.querySelector('.game-container');
        const sidebar = document.querySelector('.sidebar');
        const isStacked = window.innerWidth <= 768;

        const sidebarWidthValue = sidebar ? sidebar.clientWidth : parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width')) || 200;
        document.documentElement.style.setProperty('--sidebar-width', `${sidebarWidthValue}px`);
        let availableWidth = this.canvas.width;
        if (gameContainer) {
            if (isStacked) {
                availableWidth = gameContainer.clientWidth;
            } else {
                availableWidth = Math.max(gameContainer.clientWidth - sidebarWidthValue, 0);
            }
        } else if (gameArea) {
            availableWidth = gameArea.clientWidth;
        }

        const availableHeight = gameArea ? gameArea.clientHeight : this.canvas.height;

        this.updateGridMetrics(availableWidth, availableHeight);

        const gridWidth = Math.min(this.hexGrid.gridWidth, availableWidth || this.hexGrid.gridWidth);
        document.documentElement.style.setProperty('--game-width', `${gridWidth}px`);
        if (gameArea) {
            gameArea.style.width = isStacked ? '100%' : gridWidth + 'px';
        }
        if (container) {
            container.style.width = isStacked ? '100%' : gridWidth + 'px';
        }
        if (gameContainer) {
            if (isStacked) {
                gameContainer.style.width = '100vw';
            } else {
                const totalWidth = Math.min(gridWidth + sidebarWidthValue, window.innerWidth);
                gameContainer.style.width = totalWidth + 'px';
            }
        }

        const canvasWidth = isStacked && container ? (container.clientWidth || gridWidth) : gridWidth;
        this.canvas.width = canvasWidth;
        this.canvas.height = container && container.clientHeight ? container.clientHeight : availableHeight;
        this.trajectory.style.width = this.canvas.width + 'px';
        this.trajectory.style.height = this.canvas.height + 'px';
        this.topBoundary = this.hexGrid.gridTopOffset - this.hexGrid.bubbleRadius;
        this.updateGridPositions();

        if (this.shooter) {
            this.shooter.x = this.hexGrid.gridLeftEdge + this.hexGrid.gridWidth / 2;
            this.shooter.y = this.canvas.height - this.shooterBottomOffset;
            this.shooter.x = this.clampAimX(this.shooter.x);
        }
    }
    
    /**
     * Initialisiert einen neuen oder gespeicherten Spielzustand und aktualisiert die UI.
     */
    initializeGame() {
        this.resetPowerUps();
        this.activeBubble = null;
        if (!this.loadState()) {
            this.createInitialGrid();
            this.generateNextBubbles();
            this.currentBubble = this.getRandomColor();
        }
        this.updateUI();
    }

    // Persist just enough to resume after a reload (F5): grid
    // contents, offsets, queue and score/level counters. Positions
    // aren't stored — updateGridMetrics()/updateGridPositions()
    // recompute them from row/col on load.
    saveState() {
        try {
            const state = {
                version: 1,
                score: this.score,
                highscore: this.highscore,
                level: this.level,
                shotsFired: this.shotsFired,
                currentBubble: this.currentBubble,
                nextBubbles: this.nextBubbles,
                rowOffsets: this.hexGrid.rowOffsets,
                grid: this.hexGrid.grid.map((row) => (row ? row.map((b) => (b ? b.color : null)) : null)),
                bombCharges: this.bombCharges,
                aimCharges: this.aimCharges,
                bombArmed: this.bombArmed,
                aimAssistShots: this.aimAssistShots,
            };
            localStorage.setItem(this.storageKey, JSON.stringify(state));
        } catch (e) {
            // localStorage unavailable (private mode, quota, etc.) — skip persistence.
        }
    }

    loadState() {
        try {
            const raw = localStorage.getItem(this.storageKey);
            if (!raw) return false;
            const state = JSON.parse(raw);
            if (!state || state.version !== 1 || !Array.isArray(state.grid)) return false;

            this.score = state.score || 0;
            this.highscore = state.highscore || 0;
            this.level = state.level || 1;
            this.shotsFired = state.shotsFired || 0;
            this.currentBubble = state.currentBubble || this.getRandomColor();
            this.nextBubbles = Array.isArray(state.nextBubbles) && state.nextBubbles.length === 5
                ? state.nextBubbles
                : null;
            this.hexGrid.rowOffsets = Array.isArray(state.rowOffsets) ? state.rowOffsets : [];
            this.hexGrid.grid = state.grid.map((row) => {
                if (!row) return [];
                const rowArray = new Array(row.length);
                row.forEach((color, col) => {
                    if (color) rowArray[col] = { color };
                });
                return rowArray;
            });

            // Restore power-up charges/armed state too — otherwise a
            // reload would refill a spent charge via resetPowerUps(),
            // which runs before loadState() in initializeGame().
            this.bombCharges = typeof state.bombCharges === 'number' ? state.bombCharges : this.maxPowerUpCharges;
            this.aimCharges = typeof state.aimCharges === 'number' ? state.aimCharges : this.maxPowerUpCharges;
            this.bombArmed = !!state.bombArmed;
            this.aimAssistShots = state.aimAssistShots || 0;
            this.currentAngleLimit = this.aimAssistShots > 0 ? this.aimAngleLimit : this.baseAngleLimit;
            this.setPowerUpState(this.bombBtn, this.bombArmed);
            this.setPowerUpState(this.aimBtn, this.aimAssistShots > 0);
            this.updatePowerUpAvailability();

            this.updateGridMetrics(this.canvas.width, this.canvas.height);
            this.updateGridPositions();
            if (!this.nextBubbles) this.generateNextBubbles();
            return true;
        } catch (e) {
            return false;
        }
    }

    clearSavedState() {
        try {
            localStorage.removeItem(this.storageKey);
        } catch (e) {
            // ignore
        }
    }
    
    /**
     * Erstellt das anfängliche, vollständig belegte Hex-Grid.
     */
    createInitialGrid() {
        this.updateGridMetrics(this.canvas.width, this.canvas.height);
        const rows = this.initialRows;
        this.hexGrid.grid = [];
        this.hexGrid.rowOffsets = [];

        for (let row = 0; row < rows; row++) {
            const cols = this.hexGrid.columnCount;
            const rowArray = new Array(cols);
            const offsetFlag = row % 2;
            this.hexGrid.rowOffsets.push(offsetFlag);
            for (let col = 0; col < cols; col++) {
                rowArray[col] = this.hexGrid.createBubble(row, col, this.getRandomColor());
            }
            this.hexGrid.grid[row] = rowArray;
        }
        this.updateGridPositions();
    }

    updateGridMetrics(availableWidth, availableHeight) {
        const previousRadius = this.hexGrid.bubbleRadius;
        this.hexGrid.columnCount = this.fixedColumns;
        const widthUnits = Math.max(this.hexGrid.columnCount * 2 + 1, 1);
        const fallbackWidth = this.hexGrid.gridWidth || this.canvas.width || widthUnits * this.hexGrid.bubbleRadius;
        const targetWidth = (availableWidth && availableWidth > 0) ? availableWidth : fallbackWidth;
        const effectiveWidth = Math.max(targetWidth, widthUnits);
        const radiusByWidth = effectiveWidth / widthUnits;

        const canvasHeight = (availableHeight && availableHeight > 0) ? availableHeight : this.canvas.height;
        const shooterY = canvasHeight - this.shooterBottomOffset;
        const rows = Math.max(this.hexGrid.grid.length || 0, this.initialRows);
        const freeRows = this.bottomFreeRows;
        const denom = ((rows - 1 + freeRows) * Math.sqrt(3)) + 3;
        const heightAvailable = Math.max(shooterY - this.topPadding, 1);
        const radiusByHeight = heightAvailable / denom;

        const newRadius = Math.min(radiusByWidth, radiusByHeight);

        this.hexGrid.bubbleRadius = newRadius;
        this.hexGrid.rowHeight = this.hexGrid.bubbleRadius * Math.sqrt(3);
        this.hexGrid.gridTopOffset = this.topPadding + this.hexGrid.bubbleRadius;
        this.topBoundary = this.hexGrid.gridTopOffset - this.hexGrid.bubbleRadius;
        this.radiusScaleFactor = previousRadius > 0 ? this.hexGrid.bubbleRadius / previousRadius : 1;

        const usedWidth = widthUnits * this.hexGrid.bubbleRadius;
        this.hexGrid.gridWidth = usedWidth;
        this.hexGrid.gridLeftOffset = 0;
        this.hexGrid.gridLeftEdge = 0;
        this.hexGrid.gridRightEdge = usedWidth;

        document.documentElement.style.setProperty('--game-width', `${usedWidth}px`);
    }

    updateGridPositions() {
        this.hexGrid.syncPositions();
        if (this.activeBubble) {
            // Rescale the flying bubble's position by the same factor
            // the grid just scaled by, so a resize/rotation mid-shot
            // doesn't teleport or drop it relative to the board.
            const scale = this.radiusScaleFactor || 1;
            this.activeBubble.x *= scale;
            this.activeBubble.y *= scale;
            this.activeBubble.radius = this.hexGrid.bubbleRadius;
            this.activeBubble.x = Math.max(this.hexGrid.gridLeftEdge + this.hexGrid.bubbleRadius, Math.min(this.hexGrid.gridRightEdge - this.hexGrid.bubbleRadius, this.activeBubble.x));
        }
    }

    /**
     * Begrenzt eine Ziel-X-Koordinate auf den horizontalen Spielbereich.
     *
     * @param {number} x X-Koordinate im Canvas-Raum
     * @returns {number} Geklammerte X-Koordinate
     */
    clampAimX(x) {
        const left = this.hexGrid.gridLeftEdge + this.hexGrid.bubbleRadius;
        const right = this.hexGrid.gridRightEdge - this.hexGrid.bubbleRadius;
        if (right <= left) {
            const fallbackLeft = this.hexGrid.bubbleRadius;
            const fallbackRight = (this.hexGrid.gridWidth || this.canvas.width) - this.hexGrid.bubbleRadius;
            return Math.max(fallbackLeft, Math.min(fallbackRight, x));
        }
        return Math.max(left, Math.min(right, x));
    }

    getRandomColor() {
        return this.colors[Math.floor(Math.random() * this.colors.length)];
    }
    
    /** Erzeugt die Queue der nächsten fünf Bubble-Farben. */
    generateNextBubbles() {
        this.nextBubbles = [];
        for (let i = 0; i < 5; i++) {
            this.nextBubbles.push(this.getRandomColor());
        }
    }
    
    setupEventListeners() {
        // Unified pointer events: aim on down/move, shoot on release.
        // This lets touch users drag to aim before firing, the same
        // way mouse users can move before clicking.
        this.canvas.addEventListener('pointermove', (e) => this.handlePointerMove(e));
        this.canvas.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
        this.canvas.addEventListener('pointerup', (e) => this.handlePointerUp(e));
        this.canvas.addEventListener('pointercancel', () => this.handlePointerCancel());

        if (this.aimBtn) {
            this.aimBtn.addEventListener('click', () => this.activateAimPowerUp());
        }

        if (this.bombBtn) {
            this.bombBtn.addEventListener('click', () => this.activateBombPowerUp());
        }

        if (this.restartBtn) {
            this.restartBtn.addEventListener('click', () => this.restartGame());
        }

        if (this.helpBtn) {
            this.helpBtn.addEventListener('click', () => this.openHelp());
        }
        if (this.helpCloseBtn) {
            this.helpCloseBtn.addEventListener('click', () => this.closeHelp());
        }

        if (this.menuBtn) {
            this.menuBtn.addEventListener('click', () => this.openMenu());
        }
        if (this.resumeBtn) {
            this.resumeBtn.addEventListener('click', () => this.closeMenu());
        }
        if (this.menuRestartBtn) {
            this.menuRestartBtn.addEventListener('click', () => {
                this.closeMenu();
                this.restartGame();
            });
        }

        window.addEventListener('keydown', (e) => this.handleKeyDown(e));

        // Throttle to one resizeCanvas() per animation frame instead
        // of once per resize/rotation event.
        window.addEventListener('resize', () => {
            if (this.resizeScheduled) return;
            this.resizeScheduled = true;
            requestAnimationFrame(() => {
                this.resizeScheduled = false;
                this.resizeCanvas();
            });
        });
    }

    handleKeyDown(e) {
        if (e.key === 'Escape') {
            if (this.helpOverlay && !this.helpOverlay.classList.contains('hidden')) {
                this.closeHelp();
            } else if (this.menuOverlay && !this.menuOverlay.classList.contains('hidden')) {
                this.closeMenu();
            }
            return;
        }

        if (!this.gameRunning || this.paused) return;
        if (this.helpOverlay && !this.helpOverlay.classList.contains('hidden')) return;
        if (this.menuOverlay && !this.menuOverlay.classList.contains('hidden')) return;

        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            const direction = e.key === 'ArrowLeft' ? -1 : 1;
            this.keyboardAimDelta = Math.max(
                -this.currentAngleLimit,
                Math.min(this.currentAngleLimit, this.keyboardAimDelta + direction * this.keyboardAimStep)
            );
            const upAngle = -Math.PI / 2;
            const angle = upAngle + this.keyboardAimDelta;
            this.shooter.angle = angle;
            const aim = { angle, dirX: Math.cos(angle), dirY: Math.sin(angle) };
            this.lastAimX = this.shooter.x + aim.dirX * 200;
            this.lastAimY = this.shooter.y + aim.dirY * 200;
            this.updateTrajectory(aim);
        } else if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            if (this.lastAimX === undefined) {
                const upAngle = -Math.PI / 2;
                this.lastAimX = this.shooter.x;
                this.lastAimY = this.shooter.y - 200;
            }
            this.shootBubble(this.lastAimX, this.lastAimY);
            if (this.trajectoryLine) this.trajectoryLine.style.display = 'none';
        }
    }

    openHelp() {
        this.openDialog(this.helpOverlay, this.helpCloseBtn, this.helpBtn);
    }

    closeHelp() {
        this.closeDialog(this.helpOverlay);
    }

    openMenu() {
        if (!this.gameRunning) return;
        this.paused = true;
        if (this.menuScoreEl) this.menuScoreEl.textContent = this.score;
        this.openDialog(this.menuOverlay, this.resumeBtn, this.menuBtn);
    }

    closeMenu() {
        this.paused = false;
        this.closeDialog(this.menuOverlay);
        this.startGameLoop();
    }

    openDialog(overlayEl, focusEl, triggerEl) {
        if (!overlayEl) return;
        this.activeDialogTrigger = triggerEl || null;
        overlayEl.classList.remove('hidden');
        if (focusEl && focusEl.focus) focusEl.focus();
    }

    closeDialog(overlayEl) {
        if (!overlayEl) return;
        overlayEl.classList.add('hidden');
        if (this.activeDialogTrigger && this.activeDialogTrigger.focus) {
            this.activeDialogTrigger.focus();
        }
        this.activeDialogTrigger = null;
    }

    announce(message) {
        if (this.srStatus) this.srStatus.textContent = message;
    }
    
    handlePointerMove(e) {
        if (this.paused) return;
        const rect = this.canvas.getBoundingClientRect();
        const rawX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const mouseX = this.clampAimX(rawX);

        const aim = this.resolveAim(mouseX, mouseY);
        this.shooter.angle = aim.angle;
        this.lastAimX = mouseX;
        this.lastAimY = mouseY;

        this.updateTrajectory(aim);
    }

    handlePointerDown(e) {
        if (this.paused) return;
        e.preventDefault();
        if (this.canvas.setPointerCapture) {
            this.canvas.setPointerCapture(e.pointerId);
        }
        this.isAiming = true;
        this.handlePointerMove(e);
    }

    handlePointerUp(e) {
        if (!this.isAiming) return;
        this.isAiming = false;
        if (this.canvas.hasPointerCapture && this.canvas.hasPointerCapture(e.pointerId)) {
            this.canvas.releasePointerCapture(e.pointerId);
        }
        this.handlePointerMove(e);
        this.trajectoryLine.style.display = 'none';
        if (!this.gameRunning) return;
        this.shootBubble(this.lastAimX, this.lastAimY);
    }

    handlePointerCancel() {
        this.isAiming = false;
    }

    /**
     * Berechnet die begrenzte Schussrichtung aus einer Zielkoordinate.
     * Diese Single Source of Truth hält Vorschau und tatsächlichen Schuss synchron.
     *
     * @param {number} targetX Ziel-X im Canvas-Raum
     * @param {number} targetY Ziel-Y im Canvas-Raum
     * @returns {{angle: number, dirX: number, dirY: number}} Winkel und Einheitsvektor
     */
    resolveAim(targetX, targetY) {
        const dx = targetX - this.shooter.x;
        const dy = targetY - this.shooter.y;
        const upAngle = -Math.PI / 2;
        let delta = Math.atan2(dy, dx) - upAngle;
        while (delta > Math.PI) delta -= Math.PI * 2;
        while (delta < -Math.PI) delta += Math.PI * 2;

        const limit = this.currentAngleLimit;
        delta = Math.max(-limit, Math.min(limit, delta));

        const angle = upAngle + delta;
        return { angle, dirX: Math.cos(angle), dirY: Math.sin(angle) };
    }

    /**
     * Zeichnet die begrenzte Trajektorie für die aktuelle Aim-Richtung.
     *
     * @param {{angle: number, dirX: number, dirY: number}} aim Ergebnis von resolveAim()
     */
    updateTrajectory(aim) {
        const line = this.trajectoryLine;
        const startX = this.shooter.x;
        const startY = this.shooter.y;

        const maxDistance = this.aimAssistShots > 0
            ? this.aimAssistTrajectoryLength
            : this.normalTrajectoryLength;
        const endX = startX + aim.dirX * maxDistance;
        const endY = startY + aim.dirY * maxDistance;

        let finalEndX = endX;
        let finalEndY = endY;
        const leftBound = this.hexGrid.gridLeftEdge + this.hexGrid.bubbleRadius;
        const rightBound = this.hexGrid.gridRightEdge - this.hexGrid.bubbleRadius;
        const adjustEnd = (boundX) => {
            const denom = endX - startX;
            if (Math.abs(denom) < this.trajectoryVerticalEpsilon) {
                finalEndX = boundX;
                finalEndY = endY;
            } else {
                const ratio = (boundX - startX) / denom;
                finalEndX = boundX;
                finalEndY = startY + (endY - startY) * ratio;
            }
        };
        if (finalEndX < leftBound) {
            adjustEnd(leftBound);
        } else if (finalEndX > rightBound) {
            adjustEnd(rightBound);
        }
        
        line.setAttribute('x1', startX);
        line.setAttribute('y1', startY);
        line.setAttribute('x2', finalEndX);
        line.setAttribute('y2', finalEndY);
        line.style.display = 'block';
    }
    
    /**
     * Erstellt und startet eine Bubble für die angegebene Zielkoordinate.
     *
     * @param {number} targetX Ziel-X im Canvas-Raum
     * @param {number} targetY Ziel-Y im Canvas-Raum
     */
    shootBubble(targetX, targetY) {
        if (this.activeBubble) {
            return;
        }

        const aimX = this.clampAimX(targetX);
        const aim = this.resolveAim(aimX, targetY);
        this.shooter.angle = aim.angle;

        // Zeitbasierte Geschwindigkeit, unabhängig von der Bildrate.
        const bubble = {
            x: this.shooter.x,
            y: this.shooter.y,
            dirX: aim.dirX,
            dirY: aim.dirY,
            speed: this.bubbleSpeedPxPerSecond,
            color: this.currentBubble,
            radius: this.hexGrid.bubbleRadius,
            powerUp: null
        };

        if (this.bombArmed) {
            bubble.powerUp = 'bomb';
            this.bombArmed = false;
            this.setPowerUpState(this.bombBtn, false);
        }

        if (this.aimAssistShots > 0) {
            this.aimAssistShots--;
            if (this.aimAssistShots === 0) {
                this.currentAngleLimit = this.baseAngleLimit;
                this.setPowerUpState(this.aimBtn, false);
            }
        }
        
        this.animateBubble(bubble);
        this.nextBubble();
        this.shotsFired++;
    }
    
    animateBubble(bubble) {
        this.activeBubble = bubble;
    }

    /**
     * Bewegt die aktive Bubble in kollisionssicheren Teilschritten.
     *
     * @param {number} deltaMs Vergangene Zeit seit dem letzten Frame in Millisekunden
     */
    updateActiveBubble(deltaMs) {
        if (!this.activeBubble) return;

        const bubble = this.activeBubble;
        const dt = deltaMs / 1000;
        const stepDistance = bubble.speed * dt;
        // Substep the movement so fast frames (or small bubbles) can't
        // tunnel through a grid bubble between two collision checks.
        const maxStepSize = Math.max(
            bubble.radius * this.collisionSubstepRadiusFactor,
            1
        );
        const steps = Math.min(
            this.maxCollisionSubsteps,
            Math.max(1, Math.ceil(stepDistance / maxStepSize))
        );
        const singleStepDistance = stepDistance / steps;

        const leftEdge = this.hexGrid.gridLeftEdge;
        const rightEdge = this.hexGrid.gridRightEdge;

        for (let i = 0; i < steps; i++) {
            bubble.x += bubble.dirX * singleStepDistance;
            bubble.y += bubble.dirY * singleStepDistance;

            if (bubble.x - bubble.radius <= leftEdge || bubble.x + bubble.radius >= rightEdge) {
                bubble.dirX = -bubble.dirX;
                bubble.x = Math.max(leftEdge + bubble.radius, Math.min(rightEdge - bubble.radius, bubble.x));
            }

            const collision = this.hexGrid.checkCollision(bubble);
            // Trigger when the bubble's TOP edge reaches the ceiling
            // (y - r <= 0), not when its center does — otherwise the
            // bubble overshoots the top by a full radius before snapping.
            if (collision || bubble.y - bubble.radius <= this.topBoundary) {
                this.placeBubble(bubble, collision);
                this.activeBubble = null;
                return;
            }

            if (bubble.y - bubble.radius > this.canvas.height) {
                this.activeBubble = null;
                return;
            }
        }
    }

    /** Aktiviert oder deaktiviert die Zielhilfe für den nächsten Schuss. */
    activateAimPowerUp() {
        if (!this.gameRunning) return;
        if (this.aimAssistShots > 0) {
            this.aimAssistShots = 0;
            this.currentAngleLimit = this.baseAngleLimit;
            this.setPowerUpState(this.aimBtn, false);
            return;
        }
        if (this.aimCharges <= 0) return;
        this.aimCharges--;
        this.aimAssistShots = 1;
        this.currentAngleLimit = this.aimAngleLimit;
        this.setPowerUpState(this.aimBtn, true);
        this.updatePowerUpAvailability();
    }

    /** Aktiviert oder deaktiviert die Bombe für den nächsten Schuss. */
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

    setPowerUpState(button, active) {
        if (!button) return;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
    }

    // A charge is consumed the moment a power-up is armed, not when
    // it's fired — matches docs/wiki/powerups.md's "max one charge
    // per level" rule instead of allowing infinite re-arming.
    updatePowerUpAvailability() {
        if (this.aimBtn) {
            const canArm = this.aimCharges > 0 || this.aimAssistShots > 0;
            this.aimBtn.disabled = !canArm;
            this.aimBtn.setAttribute('aria-label', `Zielhilfe (${Math.max(this.aimCharges, 0)} übrig)`);
        }
        if (this.bombBtn) {
            const canArm = this.bombCharges > 0 || this.bombArmed;
            this.bombBtn.disabled = !canArm;
            this.bombBtn.setAttribute('aria-label', `Bombe (${Math.max(this.bombCharges, 0)} übrig)`);
        }
    }

    /** Setzt Aufladungen, aktivierte Zustände und Winkelbegrenzung zurück. */
    resetPowerUps() {
        this.aimAssistShots = 0;
        this.bombArmed = false;
        this.currentAngleLimit = this.baseAngleLimit;
        this.bombCharges = this.maxPowerUpCharges;
        this.aimCharges = this.maxPowerUpCharges;
        this.updatePowerUpAvailability();
        this.setPowerUpState(this.aimBtn, false);
        this.setPowerUpState(this.bombBtn, false);
    }

    showOverlay(title, message) {
        if (!this.overlay) return;
        if (this.overlayTitle) {
            this.overlayTitle.textContent = title;
        }
        if (this.overlayMessage) {
            this.overlayMessage.textContent = message;
        }
        this.announce(`${title}. ${message}`);
        this.openDialog(this.overlay, this.restartBtn, null);
    }

    hideOverlay() {
        this.closeDialog(this.overlay);
    }

    /** Beendet die laufende Partie, speichert den Highscore und zeigt das Overlay. */
    triggerGameOver() {
        if (!this.gameRunning) return;
        this.gameRunning = false;
        this.activeBubble = null;
        this.resetPowerUps();
        if (this.score > this.highscore) {
            this.highscore = this.score;
        }
        this.clearSavedState();
        this.updateUI();
        this.showOverlay('Game Over', `Punkte: ${this.score}`);
    }

    /** Setzt die Partie auf Level 1 zurück und startet den Game-Loop erneut. */
    restartGame() {
        this.hideOverlay();
        if (this.score > this.highscore) {
            this.highscore = this.score;
        }
        this.score = 0;
        this.level = 1;
        this.shotsFired = 0;
        this.gameRunning = true;
        this.paused = false;
        this.activeBubble = null;
        this.resetPowerUps();
        this.createInitialGrid();
        this.generateNextBubbles();
        this.currentBubble = this.getRandomColor();
        this.updateUI();
        if (this.trajectoryLine) {
            this.trajectoryLine.style.display = 'none';
        }
        this.startGameLoop();
    }
    
    /**
     * Platziert eine Bubble oder löst deren Bombenwirkung aus und beendet anschließend den Turn.
     *
     * @param {{x: number, y: number, color: string, powerUp: string|null}} bubble Zu platzierende Bubble
     * @param {{row: number, col: number}|null} collision Getroffene Zelle oder null bei Deckenkontakt
     */
    placeBubble(bubble, collision) {
        const { row, col } = this.hexGrid.findBestPosition(bubble.x, bubble.y, collision);

        if (row < 0 || col < 0) return;

        this.hexGrid.ensureRowSlot(row);
        this.hexGrid.getRowOffsetFlag(row);

        if (bubble.powerUp === 'bomb') {
            // Explode around the bubble that was actually hit, not the
            // freshly placed one — the projectile itself never joins the grid.
            const target = collision || { row, col };
            const removed = this.hexGrid.removeBombCluster(target.row, target.col);
            if (removed > 0) {
                this.score += removed * 15;
                this.updateUI();
            }
            this.resolveFloatingBubbles();
            this.resolveTurn();
            return;
        }

        this.hexGrid.grid[row][col] = this.hexGrid.createBubble(row, col, bubble.color);
        this.checkMatches(row, col);
        this.resolveTurn();
    }

    /** Entfernt schwebende Bubbles über HexGrid und vergibt Punkte dafür. */
    resolveFloatingBubbles() {
        const removed = this.hexGrid.removeFloatingBubbles();
        if (removed > 0) {
            this.score += removed * 5;
            this.updateUI();
        }
    }

    /**
     * Schließt einen Turn nach allen Schusseffekten ab: Win, Row Push oder Game Over.
     */
    resolveTurn() {
        if (this.hexGrid.checkWinCondition()) {
            this.nextLevel();
            return;
        }
        if (this.shotsFired % this.shotsPerRow === 0) {
            this.addRow();
        } else {
            this.checkGameOver();
        }
    }

    /**
     * Entfernt einen verbundenen Match aus mindestens drei gleichfarbigen Bubbles.
     *
     * @param {number} row Start-Zeile
     * @param {number} col Start-Spalte
     */
    checkMatches(row, col) {
        const color = this.hexGrid.grid[row][col].color;
        const matches = this.hexGrid.findMatches(row, col, color);

        if (matches.length >= 3) {
            // Remove matches
            matches.forEach(({ r, c }) => {
                delete this.hexGrid.grid[r][c];
            });

            this.score += matches.length * 10;
            this.updateUI();

            // Check for floating bubbles
            this.resolveFloatingBubbles();
        }
    }
    
    /** Startet das nächste Level mit neuem Grid, neuer Queue und aufgefüllten Power-Ups. */
    nextLevel() {
        this.level++;
        this.shotsFired = 0;
        this.resetPowerUps();
        this.createInitialGrid();
        this.generateNextBubbles();
        this.currentBubble = this.getRandomColor();
        this.updateUI();
    }

    /** Fügt am oberen Rand eine neue Bubble-Reihe ein und prüft auf Game Over. */
    addRow() {
        this.hexGrid.pushRow(() => this.getRandomColor());
        this.updateGridPositions();
        this.checkGameOver();
        if (this.gameRunning) {
            this.saveState();
        }
    }

    /** Prüft, ob eine Bubble die Shooter-Linie erreicht hat. */
    checkGameOver() {
        const limit = this.shooter.y - this.hexGrid.bubbleRadius * 2;
        for (let row = 0; row < this.hexGrid.grid.length; row++) {
            for (let col = 0; col < this.hexGrid.grid[row].length; col++) {
                const bubble = this.hexGrid.grid[row][col];
                if (bubble && bubble.y >= limit) {
                    this.triggerGameOver();
                    return;
                }
            }
        }
    }
    
    nextBubble() {
        this.currentBubble = this.nextBubbles.shift();
        this.nextBubbles.push(this.getRandomColor());
        this.updateUI();
    }
    
    /** Aktualisiert alle DOM-Anzeigen aus dem aktuellen Spielzustand. */
    updateUI() {
        document.getElementById('score').textContent = this.score;
        document.getElementById('level').textContent = this.level;
        if (this.highscoreEl) {
            this.highscoreEl.textContent = Math.max(this.highscore, this.score);
        }


        // Update current bubble
        const currentBubbleEl = this.currentBubbleEl;
        currentBubbleEl.style.background = `radial-gradient(circle, ${this.currentBubble}, ${this.darkenColor(this.currentBubble)})`;
        currentBubbleEl.textContent = this.colorSymbols[this.currentBubble] || '';

        // Update queue
        for (let i = 0; i < 5; i++) {
            const queueEl = document.getElementById(`queue${i + 1}`);
            if (this.nextBubbles[i]) {
                queueEl.style.background = `radial-gradient(circle, ${this.nextBubbles[i]}, ${this.darkenColor(this.nextBubbles[i])})`;
                queueEl.style.border = `3px solid ${this.darkenColor(this.nextBubbles[i])}`;
                queueEl.textContent = this.colorSymbols[this.nextBubbles[i]] || '';
            }
        }

        if (this.gameRunning) {
            this.saveState();
        }
    }

    darkenColor(color) {
        // Simple color darkening
        const hex = color.replace('#', '');
        const r = Math.max(0, parseInt(hex.substr(0, 2), 16) - 40);
        const g = Math.max(0, parseInt(hex.substr(2, 2), 16) - 40);
        const b = Math.max(0, parseInt(hex.substr(4, 2), 16) - 40);
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
    
    drawBubble(x, y, color, radius = this.hexGrid.bubbleRadius) {
        this.ctx.save();
        
        // Shadow
        this.ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        this.ctx.shadowBlur = 5;
        this.ctx.shadowOffsetX = 2;
        this.ctx.shadowOffsetY = 2;
        
        // Main bubble
        const gradient = this.ctx.createRadialGradient(x - radius/3, y - radius/3, 0, x, y, radius);
        gradient.addColorStop(0, this.lightenColor(color));
        gradient.addColorStop(1, color);
        
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Highlight
        this.ctx.shadowColor = 'transparent';
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.beginPath();
        this.ctx.arc(x - radius/3, y - radius/3, radius/3, 0, Math.PI * 2);
        this.ctx.fill();

        // Color-independent symbol for colorblind accessibility.
        const symbol = this.colorSymbols[color];
        if (symbol) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
            this.ctx.font = `${Math.max(radius, 1)}px sans-serif`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(symbol, x, y);
        }

        this.ctx.restore();
    }
    
    lightenColor(color) {
        const hex = color.replace('#', '');
        const r = Math.min(255, parseInt(hex.substr(0, 2), 16) + 60);
        const g = Math.min(255, parseInt(hex.substr(2, 2), 16) + 60);
        const b = Math.min(255, parseInt(hex.substr(4, 2), 16) + 60);
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
    
    /**
     * Rendert einen Frame, aktualisiert die Physik und plant den nächsten Frame.
     *
     * @param {number} timestamp requestAnimationFrame-Zeitstempel
     */
    gameLoop(timestamp) {
        // Stop scheduling frames once the game isn't actively running —
        // restartGame()/closeMenu() call startGameLoop() to resume.
        if (!this.gameRunning || this.paused) {
            this.loopHandle = null;
            this.lastFrameTime = null;
            return;
        }

        const lastTime = this.lastFrameTime ?? timestamp;
        const deltaMs = Math.min(timestamp - lastTime, this.maxFrameDeltaMs);
        this.lastFrameTime = timestamp;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.currentBubbleEl) {
            this.currentBubbleEl.classList.toggle('shooter-bubble--busy', !!this.activeBubble);
        }

        this.updateActiveBubble(deltaMs);

        // Draw grid
        for (let row = 0; row < this.hexGrid.grid.length; row++) {
            for (let col = 0; col < this.hexGrid.grid[row].length; col++) {
                const bubble = this.hexGrid.grid[row][col];
                if (bubble) {
                    this.drawBubble(bubble.x, bubble.y, bubble.color);
                }
            }
        }

        if (this.activeBubble) {
            this.drawBubble(this.activeBubble.x, this.activeBubble.y, this.activeBubble.color, this.activeBubble.radius);
        }

        this.loopHandle = requestAnimationFrame((t) => this.gameLoop(t));
    }

    /** Startet den requestAnimationFrame-Loop, falls er nicht bereits läuft. */
    startGameLoop() {
        if (this.loopHandle) return;
        this.lastFrameTime = null;
        this.loopHandle = requestAnimationFrame((t) => this.gameLoop(t));
    }
}
