// Dependency-free smoke tests for the pure game-logic invariants called out
// in master-audit-2026-07-26.md. Imports the real BubbleShooter module and
// runs it against minimal DOM/localStorage stubs installed on globalThis
// (no real layout/rendering).
//
// Run: node test/logic-smoke.mjs
import assert from 'node:assert/strict';
import { BubbleShooter } from '../src/bubbleShooter.js';

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

function makeLocalStorage(store = new Map()) {
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
}

function createGame(sharedLocalStorageStore) {
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

  globalThis.document = {
    getElementById,
    querySelector: (sel) => queryables[sel] || null,
    documentElement: { style: { setProperty() {} } },
  };

  globalThis.window = {
    innerWidth: 1160,
    innerHeight: 800,
    addEventListener: () => {},
    document: globalThis.document,
  };

  globalThis.requestAnimationFrame = function requestAnimationFrame() {
    // Never auto-fires; tests drive the logic directly instead of the RAF loop.
    return 1;
  };

  globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });
  globalThis.localStorage = makeLocalStorage(sharedLocalStorageStore);

  return new BubbleShooter();
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
  for (let row = 0; row < instance.hexGrid.grid.length; row++) {
    const flag = instance.hexGrid.getRowOffsetFlag(row);
    const neighbors = instance.hexGrid.getNeighbors(row, 5);
    // Every neighbor's grid-space distance to (row,5) must be close to one
    // bubble diameter (touching circles), proving the delta table matches
    // the actual offset used to place bubbles.
    const origin = instance.hexGrid.getBubblePosition(row, 5);
    neighbors.forEach(({ r, c }) => {
      const pos = instance.hexGrid.getBubblePosition(r, c);
      const dist = Math.hypot(pos.x - origin.x, pos.y - origin.y);
      const expected = instance.hexGrid.bubbleRadius * 2;
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
  const localCandidatesBefore = instance.hexGrid.getLocalCandidates(targetRow, targetCol);
  assert.ok(localCandidatesBefore.length > 0, 'test setup needs at least one free local slot');
  const target = instance.hexGrid.getBubblePosition(targetRow, targetCol);
  const bubble = { x: target.x, y: target.y, color: '#000', radius: instance.hexGrid.bubbleRadius, powerUp: null };
  instance.shotsFired = 1; // avoid resolveTurn's row-push branch (0 % shotsPerRow === 0) firing here
  instance.placeBubble(bubble, collision);
  const landedLocally = localCandidatesBefore.some(
    (c) => instance.hexGrid.grid[c.row] && instance.hexGrid.grid[c.row][c.col] && instance.hexGrid.grid[c.row][c.col].color === '#000'
  );
  assert.ok(landedLocally, "bubble should land on one of the collided cell's free neighbors, not a distant cell");
});

// 4. Turn resolution: addRow() must not fire until after placement resolves.
check('shootBubble does not push a row synchronously; resolveTurn does', (instance) => {
  const freshRows = instance.hexGrid.grid.length;
  instance.shotsFired = instance.shotsPerRow - 1; // next shot should trigger a push
  instance.activeBubble = null;
  instance.shootBubble(instance.shooter.x, instance.shooter.y - 500);
  assert.equal(instance.hexGrid.grid.length, freshRows, 'addRow must not run inside shootBubble');
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

// 7b. Ceiling snap must trigger on top-edge contact (y - r <= 0), not on
// center-at-ceiling (y <= 0) — otherwise the bubble overshoots the top by a
// full radius before snapping into row 0.
check('ceiling snap triggers on top-edge contact (y - r <= 0), not center-at-ceiling', (instance) => {
  const r = instance.hexGrid.bubbleRadius;
  // Clear the top three rows so nothing can stop the bubble except the
  // ceiling (no grid collision). Lower rows stay filled so the grid is not
  // "won" and no game-over fires.
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < instance.hexGrid.columnCount; col++) {
      delete instance.hexGrid.grid[row][col];
    }
  }
  // resolveTurn() would push a new row when shotsFired % 5 === 0; avoid that.
  instance.shotsFired = 1;

  const color = '#1982c4';
  // Start with the center one pixel below the fixed trigger (y = r + 1):
  // top edge (y - r) = 1 > 0 (not at ceiling yet), center y > 0 (old trigger
  // not reached either). Move 1 px upward this frame -> y = r, top edge = 0.
  instance.activeBubble = {
    x: instance.shooter.x,
    y: instance.hexGrid.gridTopOffset + 1,
    dirX: 0,
    dirY: -1,
    speed: 100,
    color,
    radius: r,
    powerUp: null,
  };

  instance.updateActiveBubble(10); // 10 ms @ 100 px/s = 1 px -> y = gridTopOffset (= r)

  // With the fix, y - r = 0 <= 0 -> the bubble snaps this frame.
  assert.equal(instance.activeBubble, null, 'bubble must snap when its top edge touches the ceiling');
  const placed = (instance.hexGrid.grid[0] || []).find((b) => b && b.color === color);
  assert.ok(placed, 'snapped bubble must land in row 0');
});

// 8. F5/reload must resume the same game, not start a fresh level: a second
// instance sharing the same localStorage backing store (simulating a page
// reload) should pick up where the first instance left off.
(function checkPersistenceAcrossReload() {
  const name = 'a reload (shared localStorage) restores grid/score/level instead of starting fresh';
  try {
    const store = new Map();
    const before = createGame(store);

    before.addRow(); // mutate grid away from the pristine initial layout
    before.score = 470;
    before.level = 3;
    before.shotsFired = 2;
    before.updateUI(); // this is what persists state during real play

    const gridSnapshotBefore = before.hexGrid.grid.map((row) => (row ? row.map((b) => (b ? b.color : null)) : null));

    // Simulate F5: a brand-new instance, same localStorage store.
    const after = createGame(store);

    assert.equal(after.score, 470, 'score should survive a reload');
    assert.equal(after.level, 3, 'level should survive a reload');
    assert.equal(after.shotsFired, 2, 'shotsFired should survive a reload');
    const gridSnapshotAfter = after.hexGrid.grid.map((row) => (row ? row.map((b) => (b ? b.color : null)) : null));
    // JSON comparison sidesteps a node:assert quirk where sparse arrays with
    // identical contents are reported as "not reference-equal" by deepEqual.
    assert.equal(
      JSON.stringify(gridSnapshotAfter),
      JSON.stringify(gridSnapshotBefore),
      'grid contents should survive a reload instead of regenerating a fresh level'
    );

    passed++;
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`FAIL - ${name}`);
    console.error(`  ${err.message}`);
    process.exitCode = 1;
  }
})();

// 9. A reload must not refill a spent power-up charge (this was an actual
// exploit: resetPowerUps() ran before loadState() and always granted a
// fresh charge, so refreshing the page = an infinite bomb).
(function checkPowerUpChargesSurviveReload() {
  const name = 'a reload does not refill a spent bomb charge';
  try {
    const store = new Map();
    const before = createGame(store);

    before.activateBombPowerUp(); // consumes the only charge, arms the bomb
    assert.equal(before.bombCharges, 0);
    assert.equal(before.bombArmed, true);
    before.updateUI(); // persists

    const after = createGame(store); // simulate F5
    assert.equal(after.bombCharges, 0, 'charge should stay spent across a reload');
    assert.equal(after.bombArmed, true, 'armed state should survive a reload');

    after.activateBombPowerUp(); // disarm (allowed: button stays clickable while armed)
    assert.equal(after.bombArmed, false);
    after.activateBombPowerUp(); // try to re-arm — must fail, no charges left
    assert.equal(after.bombArmed, false, 'should not be able to re-arm after a reload with 0 charges');

    passed++;
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`FAIL - ${name}`);
    console.error(`  ${err.message}`);
    process.exitCode = 1;
  }
})();

console.log(`\n${passed} check(s) passed`);
