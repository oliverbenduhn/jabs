// Confirms every ES module under src/ parses as valid JavaScript by importing it.
const modules = ['../src/hexGrid.js', '../src/bubbleShooter.js'];

for (const relPath of modules) {
  const url = new URL(relPath, import.meta.url);
  await import(url);
  console.log(`ok - ${relPath} has valid JavaScript syntax and imports cleanly`);
}
