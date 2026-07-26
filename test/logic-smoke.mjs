// Dependency-free smoke tests for the pure game-logic invariants called out
// in master-audit-2026-07-26.md. Runs the inline <script> from index.htm in a
// sandboxed vm context with minimal DOM stubs (no real layout/rendering).
//
// Run: node test/logic-smoke.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(__dirname, '..', 'index.htm'), 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*)<\/script>/);
if (!scriptMatch) throw new Error('Could not find inline <script> in index.htm');
const scriptSrc = scriptMatch[1];

function makeElement(id) {
  const el = {
    id,
    _classes: new Set(),
    style: {},
    dataset: {},
    children: [],
    textContent: '',
    disabled: false,
    clientWidth: 1160,
    clientHeight: 800,
    classList: {
      add: (c) => el._classes.add(c),
      remove: (c) => el._classes.delete(c),
      toggle: (c, force) => {
        const on = force === undefined ? !el._classes.has(c) : force;
        if (on) el._classes.add(c); else el._classes.delete(c);
        return on;
      },
      contains: (c) => el._classes.has(c),
    },
    setAttribute(name, value) { this[`attr_${name}`] = value; },
    getAttribute(name) { return this[`attr_${name}`]; },
    addEventListener() {},
    removeEventListener() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: el.clientWidth, height: el.clientHeight }),
    focus() { this._focused = true; },
    setPointerCapture() {},
    releasePointerCapture() {},
    hasPointerCapture: () => false,
  };
  if (id === 'gameCanvas') {
    el.width = 960;
    el.height = 800;
    el.getContext = () => ({
      clearRect() {}, save() {}, restore() {}, beginPath() {}, arc() {}, fill() {},
      createRadialGradient: () => ({ addColorStop() {} }),
      fillStyle: null, shadowColor: null, shadowBlur: 0, shadowOffsetX: 0, shadowOffsetY: 0,
    });
  }
  return el;
}

function createGame() {
  const elements = new Map();
  function getElementById(id) {
    if (!elements.has(id)) elements.set(id, makeElement(id));
    return elements.get(id);
  }

  const queryables = {
    '.canvas-container': { clientWidth: 960, clientHeight: 800, style: {} },
    '.game-area': { clientWidth: 960, clientHeight: 800, style: {} },
    '.game-container': { clientWidth: 1160, clientHeight: 800, style: {} },
    '.sidebar': { clientWidth: 200, clientHeight: 800, style: {} },
  };

  const documentStub = {
    getElementById,
    querySelector: (sel) => queryables[sel] || null,
    documentElement: { style: { setProperty() {} } },
  };

  const windowStub = {
    innerWidth: 1160,
    innerHeight: 800,
    addEventListener: () => {},
  };

  function requestAnimationFrame() {
    // Never auto-fires; tests drive the logic directly instead of the RAF loop.
    return 1;
  }

  const sandbox = {
    document: documentStub,
    window: windowStub,
    requestAnimationFrame,
    Math,
    console,
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    MouseEvent: class {},
  };
  sandbox.window.document = documentStub;
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

// 1. Hex neighbor topology must follow rowOffsets, not row % 2, across pushes.
check('getNeighbors stays consistent with rowOffsets after two addRow() pushes', (instance) => {
  instance.addRow();
  instance.addRow();
  for (let row = 0; row < instance.grid.length; row++) {
    const flag = instance.getRowOffsetFlag(row);
    const neighbors = instance.getNeighbors(row, 5);
    // Every neighbor's grid-space distance to (row,5) must be close to one
    // bubble diameter (touching circles), proving the delta table matches
    // the actual offset used to place bubbles.
    const origin = instance.getBubblePosition(row, 5);
    neighbors.forEach(({ r, c }) => {
      const pos = instance.getBubblePosition(r, c);
      const dist = Math.hypot(pos.x - origin.x, pos.y - origin.y);
      const expected = instance.bubbleRadius * 2;
      assert.ok(Math.abs(dist - expected) < 0.01, `row=${row} flag=${flag} neighbor (${r},${c}) dist=${dist} expected=${expected}`);
    });
  }
});

// 2. resolveAim must clamp a straight-down target to within currentAngleLimit
//    of the upward axis, and shootBubble must use that same clamped vector.
check('resolveAim clamps downward targets instead of passing them through', (instance) => {
  const aim = instance.resolveAim(instance.shooter.x, instance.shooter.y + 500);
  assert.ok(aim.dirY < 0, `expected an upward-biased direction, got dirY=${aim.dirY}`);
});

check('shootBubble never launches a bubble downward', (instance) => {
  instance.activeBubble = null;
  instance.shootBubble(instance.shooter.x, instance.shooter.y + 500);
  assert.ok(instance.activeBubble, 'expected a bubble to be launched');
  assert.ok(instance.activeBubble.dirY < 0, `expected dirY < 0, got ${instance.activeBubble.dirY}`);
});

// 3. Collision target must constrain placement to a local neighbor, not the
//    globally nearest empty cell.
check('placeBubble lands on a free neighbor of the collided bubble', (instance) => {
  const targetRow = instance.initialRows - 1, targetCol = 5; // bottom filled row: has free cells below it
  const collision = { row: targetRow, col: targetCol };
  const localCandidatesBefore = instance.getLocalCandidates(targetRow, targetCol);
  assert.ok(localCandidatesBefore.length > 0, 'test setup needs at least one free local slot');
  const target = instance.getBubblePosition(targetRow, targetCol);
  const bubble = { x: target.x, y: target.y, color: '#000', radius: instance.bubbleRadius, powerUp: null };
  instance.shotsFired = 1; // avoid resolveTurn's row-push branch (0 % shotsPerRow === 0) firing here
  instance.placeBubble(bubble, collision);
  const landedLocally = localCandidatesBefore.some(
    (c) => instance.grid[c.row] && instance.grid[c.row][c.col] && instance.grid[c.row][c.col].color === '#000'
  );
  assert.ok(landedLocally, "bubble should land on one of the collided cell's free neighbors, not a distant cell");
});

// 4. Turn resolution: addRow() must not fire until after placement resolves.
check('shootBubble does not push a row synchronously; resolveTurn does', (instance) => {
  const freshRows = instance.grid.length;
  instance.shotsFired = instance.shotsPerRow - 1; // next shot should trigger a push
  instance.activeBubble = null;
  instance.shootBubble(instance.shooter.x, instance.shooter.y - 500);
  assert.equal(instance.grid.length, freshRows, 'addRow must not run inside shootBubble');
});

// 5. Power-up charges: arming twice without a level reset must be blocked.
check('bomb charge is consumed on arm and blocks a second arm', (instance) => {
  instance.resetPowerUps();
  instance.activateBombPowerUp(); // arm (consumes the only charge)
  assert.equal(instance.bombArmed, true);
  instance.activateBombPowerUp(); // disarm
  assert.equal(instance.bombArmed, false);
  instance.activateBombPowerUp(); // try to re-arm with no charges left
  assert.equal(instance.bombArmed, false, 'should not be able to re-arm with 0 charges');
});

check('resetPowerUps() restores one charge per power-up', (instance) => {
  instance.resetPowerUps();
  assert.equal(instance.bombCharges, 1);
  assert.equal(instance.aimCharges, 1);
});

console.log(`\n${passed} check(s) passed`);
