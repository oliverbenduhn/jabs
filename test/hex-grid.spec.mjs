// Direct unit tests for the pure HexGrid module — no DOM, no BubbleShooter.
// Run: node test/hex-grid.spec.mjs
import assert from 'node:assert/strict';
import { HexGrid } from '../src/hexGrid.js';

function makeFilledGrid(rows, columnCount) {
  const grid = new HexGrid(columnCount * 40 + 20);
  grid.columnCount = columnCount;
  grid.grid = [];
  grid.rowOffsets = [];
  for (let row = 0; row < rows; row++) {
    const rowArray = new Array(columnCount);
    grid.rowOffsets.push(row % 2);
    for (let col = 0; col < columnCount; col++) {
      rowArray[col] = grid.createBubble(row, col, '#ff595e');
    }
    grid.grid[row] = rowArray;
  }
  return grid;
}

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`ok - ${name}`);
  } catch (err) {
    console.error(`FAIL - ${name}`);
    console.error(`  ${err.message}`);
    process.exitCode = 1;
  }
}

check('getRowOffsetFlag alternates and fills gaps lazily', () => {
  const grid = new HexGrid(500);
  assert.equal(grid.getRowOffsetFlag(0), 0);
  assert.equal(grid.getRowOffsetFlag(3), 1);
  assert.equal(grid.getRowOffsetFlag(2), 0);
  assert.deepEqual(grid.rowOffsets, [0, 1, 0, 1]);
});

check('getNeighbors only returns occupied cells within bounds', () => {
  const grid = makeFilledGrid(3, 8);
  delete grid.grid[1][4];
  const neighbors = grid.getNeighbors(1, 5);
  assert.ok(neighbors.every(({ r, c }) => grid.grid[r] && grid.grid[r][c]));
  assert.ok(!neighbors.some(({ r, c }) => r === 1 && c === 4), 'deleted neighbor must be excluded');
});

check('removeFloatingBubbles detaches bubbles unreachable from row 0', () => {
  const grid = makeFilledGrid(3, 8);
  for (let col = 0; col < 8; col++) delete grid.grid[0][col]; // clear row 0 entirely
  const removed = grid.removeFloatingBubbles();
  assert.ok(removed > 0, 'expected the now-disconnected rows to be removed');
  assert.ok(grid.grid[1].every((cell) => cell === undefined), 'row 1 should be fully detached without row 0');
});

check('removeBombCluster removes the target and its hex neighbors only', () => {
  const grid = makeFilledGrid(3, 8);
  const before = grid.grid.flat().filter(Boolean).length;
  const removed = grid.removeBombCluster(1, 4);
  const after = grid.grid.flat().filter(Boolean).length;
  assert.equal(before - after, removed);
  assert.ok(removed >= 1 && removed <= 7);
});

check('pushRow shifts existing rows down and re-derives row 0 offset', () => {
  const grid = makeFilledGrid(2, 4);
  const previousFlag0 = grid.rowOffsets[0];
  grid.pushRow(() => '#1982c4');
  assert.equal(grid.grid.length, 3);
  assert.equal(grid.rowOffsets[0], previousFlag0 === 0 ? 1 : 0);
  assert.ok(grid.grid[0].every((b) => b.color === '#1982c4'));
});

check('checkWinCondition is true only for a fully empty grid', () => {
  const grid = makeFilledGrid(1, 2);
  assert.equal(grid.checkWinCondition(), false);
  delete grid.grid[0][0];
  delete grid.grid[0][1];
  assert.equal(grid.checkWinCondition(), true);
});

console.log(`\n${passed} check(s) passed`);
