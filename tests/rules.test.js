// node tests/rules.test.js — Whimpering Wastes draft + bracket rules (js/draft-core.js, js/bracket-core.js)
const path = require('path'), fs = require('fs'), vm = require('vm');
const root = path.join(__dirname, '..');
const ctx = { window: {}, console, Date, Math, JSON };
ctx.window = ctx; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/bracket-core.js'), 'utf8') + ';window.BracketCore=BracketCore;', ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/draft-core.js'), 'utf8'), ctx);
const D = ctx.DraftCore, B = ctx.BracketCore;
let fails = 0, n = 0;
const ok = (c, m) => { n++; if (!c) { fails++; console.log('FAIL:', m); } };
const throws = (f, m) => { try { f(); ok(false, m + ' (did not throw)'); } catch (e) { ok(true, m); } };

// ---- full draft, forced coin = A
let s = D.emptyState();
s = D.apply(s, { op: 'flip' }); s.firstTeam = 'A'; s.sequence = D.buildSequence('A');
const step = () => D.currentStep(s);
const act = (team, char) => { s = D.apply(s, { op: 'act', team, char }); };
throws(() => act('B', 'Jiyan'), 'B cannot act on A turn');
act('A', 'Jiyan'); act('B', 'Verina');
ok(step().type === 'ban' && step().team === 'A', 'step 3 is A ban');
throws(() => act('A', 'Verina'), 'A cannot ban B\'s already-picked Verina');
act('A', 'Carlotta');   // A bans Carlotta against B
ok(!D.isAvailable(s, 'Carlotta', 'B', 'pick'), 'B cannot pick Carlotta');
ok(D.isAvailable(s, 'Carlotta', 'A', 'pick'), 'A can still pick Carlotta');
ok(D.isAvailable(s, 'Carlotta', 'B', 'ban'), 'B may ban Carlotta too');
act('B', 'Jinhsi');     // B bans Jinhsi against A
throws(() => act('A', 'Jinhsi'), 'A cannot pick Jinhsi');
throws(() => act('A', 'Jiyan'), 'A cannot pick Jiyan twice');
act('A', 'Verina');     // mirror allowed
ok(true, 'mirror pick allowed');
act('B', 'Jiyan'); act('A', 'Carlotta'); act('B', 'Zani');
ok(step().stage === 2 && step().team === 'B', 'stage 2 starts with B');
['Lupa','Changli','Brant','Encore','Phoebe','Lily'].forEach((c, i) => act(i % 2 ? 'A' : 'B', c));
ok(!step(), 'draft complete after 14 steps');
throws(() => act('A', 'Yinlin'), 'no act after complete');
throws(() => D.apply(s, { op: 'flip' }), 'no flip mid-draft');
s = D.apply(s, { op: 'undo' }); ok(s.actions.length === 13, 'undo removes one');
// perma ban
let p = D.apply(D.emptyState(), { op: 'setPermaBans', list: ['Jinhsi', 'Jinhsi', 'Camellya'] });
ok(p.permaBans.length === 2, 'perma bans de-duplicated');
ok(!D.isAvailable(p, 'Jinhsi', 'A', 'ban') && !D.isAvailable(p, 'Jinhsi', 'B', 'pick'), 'perma blocks all');
// ban with uniquePicks false, opponent pick check against own pick
let q = D.emptyState(); q = D.apply(q, { op: 'flip' }); q.firstTeam = 'A'; q.sequence = D.buildSequence('A');
q = D.apply(q, { op: 'act', team: 'A', char: 'Jiyan' }); q = D.apply(q, { op: 'act', team: 'B', char: 'Lupa' });
ok(D.isAvailable(q, 'Jiyan', 'A', 'ban'), 'A may "ban" own pick Jiyan (only blocks B) — check intended');
// scores
let sc = D.apply(D.emptyState(), { op: 'setScores', A1: ' 1,200 ', A2: '300', B1: 'abc', B2: '' });
ok(sc.scores.A[0] === '1,200', 'scores trimmed');
// setTeams long name
let t = D.apply(D.emptyState(), { op: 'setTeams', A: 'x'.repeat(60), B: '' });
ok(t.teams.A.length === 40 && t.teams.B === 'Player B', 'names capped, blank B ignored');

// ---- bracket
let st = D.emptyState();
const names = Array.from({ length: 16 }, (_, i) => 'P' + (i + 1));
const ba = (op) => { st = B.apply(st, op).state; };
throws(() => ba({ op: 'setPlayers', list: names.slice(0, 15) }), 'setPlayers needs 16');
ba({ op: 'setPlayers', list: names });
throws(() => ba({ op: 'loadMatch', id: '1-0' }), 'cannot load QF before R16 decided');
ba({ op: 'loadMatch', id: '0-0' });
ok(st.teams.A === 'P1' && st.teams.B === 'P2', 'loadMatch sets names');
throws(() => ba({ op: 'confirmWinner' }), 'confirm needs scores');
st = D.apply(st, { op: 'setScores', A1: '10', A2: '10', B1: '10', B2: '10' });
throws(() => ba({ op: 'confirmWinner' }), 'tie refused');
st = D.apply(st, { op: 'setScores', A1: '10', A2: '10', B1: '10', B2: '11' });
ba({ op: 'confirmWinner' }); ok(B.winner(st.bracket, 0, 0) === 'P2', 'higher total wins');
throws(() => ba({ op: 'confirmWinner', id: '0-1' }), 'confirm other match needs loading');
ba({ op: 'setWinner', id: '0-1', w: 'A' });
ok(B.participants(st.bracket, 1, 0).join() === 'P2,P3', 'QF participants');
ba({ op: 'loadMatch', id: '1-0' });
// rename in draft renames bracket slot
st = D.apply(st, { op: 'setTeams', A: 'P2-renamed' });
ok(st.bracket.players[1] === 'P2-renamed', 'draft rename syncs bracket');
// rename in bracket syncs draft
const l2 = st.bracket.players.slice(); l2[2] = 'P3x'; ba({ op: 'setPlayers', list: l2 });
ok(st.teams.B === 'P3x', 'bracket rename syncs draft');
ba({ op: 'setWinner', id: '1-0', w: 'B' });
// changing R16 winner clears QF result & unloads current
ba({ op: 'setWinner', id: '0-0', w: 'A' });
ok(!st.bracket.results['1-0'], 'changing R16 winner clears QF result');
ok(st.bracket.current === '', 'loaded downstream match unloaded on winner change');
// clearResult on a match upstream of the loaded match
ba({ op: 'loadMatch', id: '1-0' });
ba({ op: 'clearResult', id: '0-1' });
ok(st.bracket.current === '', 'clearResult upstream of loaded match unloads it');
// empty player slots
let e = D.emptyState(); e = B.apply(e, { op: 'setPlayers', list: names.map((x, i) => i === 3 ? '' : x) }).state;
throws(() => B.apply(e, { op: 'loadMatch', id: '0-1' }), 'cannot load match with empty slot');
// duplicate names in bracket
let d = D.emptyState(); d = B.apply(d, { op: 'setPlayers', list: names.map((x, i) => i === 1 ? 'P1' : x) }).state;
d = B.apply(d, { op: 'loadMatch', id: '0-0' }).state;
ok(d.teams.A === 'P1' && d.teams.B === 'P1', 'duplicate names allowed (same name both sides) — warn?');
// reset
ba({ op: 'resetBracket' }); ok(!Object.keys(st.bracket.results).length && st.bracket.current === '', 'reset clears');
// champion path
let c = D.emptyState(); c = B.apply(c, { op: 'setPlayers', list: names }).state;
for (let r = 0; r < 4; r++) for (let i = 0; i < B.count(r); i++) c = B.apply(c, { op: 'setWinner', id: r + '-' + i, w: 'A' }).state;
ok(B.champion(c.bracket) === 'P1', 'champion');
console.log(`${n - fails}/${n} passed`);
process.exit(fails ? 1 : 0);
