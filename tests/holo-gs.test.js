// node tests/holo-gs.test.js — Hologram Apps Script (apps-script-hologram/) matches the browser rules
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL:', m); } };
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8').replace(/\r\n/g, '\n');

const gs = read('apps-script-hologram/Code.gs');
ok(read('apps-script-hologram/BracketCore.gs') === read('js/bracket-core.js'), 'BracketCore.gs is an exact copy of js/bracket-core.js');

// FORMAT equals js/holo-core.js
const ctx = { console, URLSearchParams, location: { search: '' }, HW_MODE: 'hologram' };
ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(read('js/config.js') + read('js/holo-core.js'), ctx);
const fmt = eval(gs.match(/const FORMAT = (\[[\s\S]*?\]);/)[1]);
ok(JSON.stringify(fmt) === JSON.stringify(ctx.DraftCore.FORMAT), 'FORMAT matches js/holo-core.js');
ok(/const REQUIRE_KEYS = true;/.test(gs), 'keys on');

// isAvailable_ gives the same answers as DraftCore.isAvailable
const isAv = new Function('UNIQUE_PICKS', gs.match(/function isAvailable_\([\s\S]*?\n\}/)[0] + '; return isAvailable_;')(false);
const st = { permaBans: ['Jinhsi'], uniquePicks: false, actions: [
  { team: 'A', type: 'pick', char: 'Jiyan' }, { team: 'B', type: 'pick', char: 'Verina' }, { team: 'A', type: 'ban', char: 'Carlotta' }] };
const cases = [['Jinhsi', 'A', 'pick'], ['Verina', 'A', 'ban'], ['Jiyan', 'A', 'ban'], ['Carlotta', 'B', 'pick'], ['Carlotta', 'A', 'pick'],
  ['Carlotta', 'A', 'ban'], ['Jiyan', 'A', 'pick'], ['Jiyan', 'B', 'pick'], ['Lupa', 'B', 'ban']];
cases.forEach(([c, t, ty]) => ok(isAv(st, c, t, ty) === ctx.DraftCore.isAvailable(st, c, t, ty), `isAvailable_ ${c} ${t} ${ty}`));

// Hologram-specific server rules are present
const caseBody = (op) => (gs.match(new RegExp(String.raw`case '${op}': \{([\s\S]*?)\n {6}\}`)) || [, ''])[1];
ok(/state\.actions\.length/.test(caseBody('setBosses')) && /requireAdmin_/.test(caseBody('setBosses')), 'setBosses: admin only, refused after the draft started');
ok(/bosses/.test(caseBody('flip')), 'flip needs the bosses');
ok(/points_\(body\.A\)/.test(caseBody('setScores')) && /points_\(body\.B\)/.test(caseBody('setScores')), 'setScores takes 3 points per player');
ok(/bosses: parseJson_\(meta\.bosses, \[\]\)/.test(gs) && /mode: 'hologram'/.test(gs), 'state has bosses and mode');
ok(/state\.bosses/.test(gs.match(/state\.version = [\s\S]*?\]\)\);/)[0]), 'bosses are part of the change hash');

ok(/bosses: JSON\.stringify\(next\.bosses \|\| \[\]\)/.test(gs.match(/function persistFull_[\s\S]*?\n\}/)[0]), 'bracket changes (load match / undo) also save the bosses');

console.log(fails ? fails + ' failed' : 'all passed');
process.exit(fails ? 1 : 0);
