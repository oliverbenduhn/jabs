// Extracts the inline <script> from index.htm and checks it parses as valid
// JavaScript, without executing it.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(__dirname, '..', 'index.htm'), 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*)<\/script>/);
if (!scriptMatch) throw new Error('Could not find inline <script> in index.htm');

new vm.Script(scriptMatch[1], { filename: 'index.htm (inline script)' });
console.log('ok - index.htm inline script has valid JavaScript syntax');
