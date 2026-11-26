// node tests/backend.test.js — the live (Google Sheets) backend never shows a pick twice
// when a read lands in the middle of a save or comes from an out-of-date cache.
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL:', m); } };

const ctx = { console, setTimeout, clearTimeout, document: { hidden: false, addEventListener() {} }, dispatchEvent() {}, CustomEvent: class {} };
ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/backend.js'), 'utf8'), ctx);

const st = (version, picks) => ({ version, actions: picks.map((c) => ({ team: 'A', type: 'pick', char: c })) });

function run(sequence) {
  const be = ctx.createBackend({ API_URL: 'https://example.invalid/exec', POLL_MS: 2000 });
  const seen = [];
  be.subscribe = be.subscribe;            // (not started: we feed reads by hand)
  be._listen((s) => seen.push(s.actions.map((a) => a.char).join(',')));
  sequence.forEach((s) => be._receive(s));
  return seen;
}

// Save #2 adds Jinhsi. Reads: old state, a read taken mid-save (same counter, new row), a stale cached copy, the saved state.
let seen = run([st('1:a', []), st('1:b', ['Jinhsi']), st('1:a', []), st('2:c', ['Jinhsi'])]);
ok(JSON.stringify(seen) === JSON.stringify(['', 'Jinhsi']), 'pick appears once, never vanishes and comes back: ' + JSON.stringify(seen));

// An older read arriving after a newer one is ignored.
seen = run([st('2:c', ['Jinhsi']), st('1:a', [])]);
ok(JSON.stringify(seen) === JSON.stringify(['Jinhsi']), 'older counter ignored: ' + JSON.stringify(seen));

// A manual edit in the Sheet (counter unchanged) still shows, once a second read agrees.
seen = run([st('3:x', ['Jinhsi']), st('3:y', ['Jinhsi', 'Verina']), st('3:y', ['Jinhsi', 'Verina'])]);
ok(JSON.stringify(seen) === JSON.stringify(['Jinhsi', 'Jinhsi,Verina']), 'manual sheet edit shows after a confirming read: ' + JSON.stringify(seen));

// A save made from this page (counter goes up) shows straight away.
seen = run([st('3:x', ['Jinhsi']), st('4:z', ['Jinhsi', 'Verina'])]);
ok(JSON.stringify(seen) === JSON.stringify(['Jinhsi', 'Jinhsi,Verina']), 'new save shows at once: ' + JSON.stringify(seen));

console.log(fails ? fails + ' failed' : 'all passed');
process.exit(fails ? 1 : 0);
