// node tests/holo-core.test.js — Hologram draft rules (js/holo-core.js) + bracket confirm with points
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = { console, URLSearchParams, location: { search: '' }, HW_MODE: 'hologram' };
ctx.window = ctx; vm.createContext(ctx);
const BC = process.env.BRACKET_CORE || path.join(root, 'js/bracket-core.js');
for (const f of ['js/config.js', 'js/bracket-core.js', 'js/holo-core.js']) {
  vm.runInContext(fs.readFileSync(f.includes('bracket-core') ? BC : path.join(root, f), 'utf8') + (f.includes('bracket-core') ? ';window.BracketCore=BracketCore;' : ''), ctx);
}
const D = ctx.DraftCore, B = ctx.BracketCore;
let fails = 0, n = 0;
const ok = (c, m) => { n++; if (!c) { fails++; console.log('FAIL:', m); } };
const throws = (f, m) => { try { f(); ok(false, m + ' (did not throw)'); } catch (e) { ok(true, m); } };
const BOSSES = ['Inferno Rider', 'Sigillum', 'Myriad Snare'];

// sequence
ok(JSON.stringify(D.buildSequence('B').map((x) => x.team + ' ' + x.type)) ===
  JSON.stringify(['B pick', 'A pick', 'B ban', 'A ban', 'B pick', 'A pick', 'B pick', 'A pick']), 'sequence for B first');
ok(D.buildSequence('A').every((x) => x.stage === 1 || x.stage === 0), 'one stage only');

// empty state
let s = D.emptyState();
ok(Array.isArray(s.bosses) && s.bosses.length === 0, 'no bosses at start');
ok(JSON.stringify(s.scores) === JSON.stringify({ A: ['0', '0', '0'], B: ['0', '0', '0'] }), '3 point slots per player');
ok(s.bracket.players[0] === 'MOCHIEL' && s.bracket.players.length === 16, 'Hologram players preloaded');

// bosses
throws(() => D.apply(s, { op: 'flip' }), 'flip before bosses refused');
throws(() => D.apply(s, { op: 'setBosses', list: ['Inferno Rider', 'Sigillum'] }), '2 bosses refused');
throws(() => D.apply(s, { op: 'setBosses', list: ['Sigillum', 'Sigillum', 'Myriad Snare'] }), 'duplicate boss refused');
throws(() => D.apply(s, { op: 'setBosses', list: ['Sigillum', ' ', 'Myriad Snare'] }), 'blank boss refused');
s = D.apply(s, { op: 'setBosses', list: BOSSES });
ok(JSON.stringify(s.bosses) === JSON.stringify(BOSSES), 'bosses saved');
s = D.apply(s, { op: 'flip' });
s.firstTeam = 'A'; s.sequence = D.buildSequence('A');

// draft + rules
const act = (team, char) => { s = D.apply(s, { op: 'act', team, char }); };
throws(() => act('B', 'Jiyan'), 'not your turn');
act('A', 'Jiyan');
throws(() => D.apply(s, { op: 'setBosses', list: ['Fleurdelys', 'Sigillum', 'Myriad Snare'] }), 're-roll after draft started refused');
act('B', 'Verina');
throws(() => act('A', 'Verina'), "can't ban opponent's existing pick");
act('A', 'Carlotta');
ok(!D.isAvailable(s, 'Carlotta', 'B', 'pick') && D.isAvailable(s, 'Carlotta', 'A', 'pick'), 'ban blocks opponent only');
act('B', 'Jinhsi');
throws(() => act('A', 'Jiyan'), 'no picking twice');
act('A', 'Verina'); // mirror
act('B', 'Jiyan'); act('A', 'Carlotta'); act('B', 'Zani');
ok(D.currentStep(s) === null && s.actions.length === 8, 'draft complete after 8 steps');
throws(() => act('A', 'Lupa'), 'no act after complete');

// points
s = D.apply(s, { op: 'setScores', A: ['1', 'x', ''], B: [1, '0', '1'] });
ok(JSON.stringify(s.scores) === JSON.stringify({ A: ['1', '0', '0'], B: ['1', '0', '1'] }), 'points coerced to 0/1');
throws(() => D.apply(s, { op: 'setScores', A: ['1'], B: ['1', '0', '1'] }), 'wrong number of points refused');

// reset keeps bosses
s = D.apply(s, { op: 'reset' });
ok(s.actions.length === 0 && !s.firstTeam && JSON.stringify(s.bosses) === JSON.stringify(BOSSES), 'reset keeps bosses');
ok(JSON.stringify(s.scores) === JSON.stringify({ A: ['0', '0', '0'], B: ['0', '0', '0'] }), 'reset zeroes points');
s = D.apply(s, { op: 'setBosses', list: ['Fleurdelys', 'Sigillum', 'Myriad Snare'] });
ok(s.bosses[0] === 'Fleurdelys', 're-roll allowed again after reset');

// bracket confirm with points
let st = D.emptyState();
st = B.apply(st, { op: 'loadMatch', id: '0-0' }).state;
ok(st.teams.A === 'MOCHIEL' && st.teams.B === 'SHAN', 'match 1 loads MOCHIEL vs SHAN');
ok(JSON.stringify(st.scores) === JSON.stringify({ A: ['0', '0', '0'], B: ['0', '0', '0'] }), 'loading a match keeps 3 zeroed point slots');
let nx = D.apply(st, { op: 'setBosses', list: BOSSES });
nx = B.apply(nx, { op: 'loadMatch', id: '0-1' }).state;
ok(Array.isArray(nx.bosses) && nx.bosses.length === 0, 'loading the next match clears the bosses (roll again per match)');
throws(() => B.apply(st, { op: 'confirmWinner' }), '0–0 is a tie, not confirmable');
st = D.apply(st, { op: 'setScores', A: ['1', '0', '1'], B: ['0', '1', '0'] });
const r = B.apply(st, { op: 'confirmWinner' }).state.bracket.results['0-0'];
ok(r.w === 'A' && r.sa === 2 && r.sb === 1, '2–1 advances the leader with points as scores');

// break timer + perma bans still work
ok(D.apply(D.emptyState(), { op: 'setBreak', seconds: 60, label: 'Break' }).breakUntil > Date.now(), 'break timer');
ok(!D.isAvailable(D.apply(D.emptyState(), { op: 'setPermaBans', list: ['Jinhsi'] }), 'Jinhsi', 'A', 'pick'), 'perma ban');

console.log(`${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
