// node tests/chooser.test.js — index.html chooser forwards old Whimpering Wastes links to wastes.html
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL:', m); } };

const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const m = /function hwForward\(search\) \{[\s\S]*?\n {4}\}/.exec(index);
ok(m, 'index.html defines hwForward(search)');
const hwForward = m ? new Function('URLSearchParams', m[0] + '; return hwForward;')(URLSearchParams) : () => undefined;
ok(hwForward('?admin=abc') === 'wastes.html?admin=abc', 'admin link forwards');
ok(hwForward('?team=A&key=k1') === 'wastes.html?team=A&key=k1', 'captain link forwards');
ok(hwForward('?local=1') === 'wastes.html?local=1', 'demo link forwards');
ok(hwForward('?admin=1&local=1') === 'wastes.html?admin=1&local=1', 'demo admin link forwards');
ok(hwForward('') === null && hwForward('?') === null, 'plain visit shows the chooser');
ok(index.includes('href="hologram.html"') && index.includes('href="wastes.html"'), 'two choices');

const wastes = fs.readFileSync(path.join(root, 'wastes.html'), 'utf8');
ok(wastes.includes('id="roster"') && wastes.includes('js/control.js') && wastes.includes('js/draft-core.js'), 'wastes.html is the WW control page');

// code prompt: each tournament checks the code against its own Sheet; guest opens the page with no key
const chooser = fs.readFileSync(path.join(root, 'js/chooser.js'), 'utf8');
ok(index.includes('id="gate"') && index.includes('id="gate-guest"') && index.includes('js/chooser.js'), 'index.html has the code prompt with a guest option');
ok(/'hologram\.html': cfg\.HOLO_API_URL/.test(chooser) && /'wastes\.html': cfg\.API_URL/.test(chooser), 'each tournament checks against its own server');
ok(/op: 'keys'/.test(chooser) && /\?admin=' \+ encodeURIComponent\(key\)/.test(chooser), 'a right code opens the page as organizer');
ok(/\$\('gate-guest'\)\.href = page;/.test(chooser), 'guest opens the page with no key');

console.log(fails ? fails + ' failed' : 'all passed');
process.exit(fails ? 1 : 0);
