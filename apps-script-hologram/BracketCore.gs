/*
 * 16-player single-elimination bracket rules.
 *
 * Shared by the browser (local demo mode) AND the Google Apps Script backend:
 * this exact file is pasted into the Apps Script project as "BracketCore.gs".
 * Keep it plain JavaScript with no browser APIs. After editing, paste it into
 * Apps Script again and deploy a new version.
 *
 * Bracket data: { players: [16 names], results: { "r-i": { w: "A"|"B", sa, sb } }, current: "r-i" }
 *   r = round (0 = round of 16, 1 = quarterfinal, 2 = semifinal, 3 = final), i = match index.
 *   w is the winning SIDE (A = top, B = bottom), not a name, so fixing a name
 *   updates every later round automatically.
 */
var BracketCore = (function () {
  var SIZE = 16;
  var ROUNDS = 4;
  var OPS = ['setPlayers', 'loadMatch', 'confirmWinner', 'setWinner', 'clearResult', 'resetBracket'];

  function emptyBracket() {
    var players = [];
    for (var k = 0; k < SIZE; k++) players.push('');
    return { players: players, results: {}, current: '' };
  }

  function mid(r, i) { return r + '-' + i; }
  function count(r) { return SIZE >> (r + 1); }            // matches in round r: 8, 4, 2, 1

  function parse(id) {
    var m = /^(\d)-(\d+)$/.exec(String(id || ''));
    if (!m) return null;
    var r = +m[1], i = +m[2];
    return r < ROUNDS && i < count(r) ? { r: r, i: i } : null;
  }

  /** [top, bottom] names for a match ('' when not decided yet). */
  function participants(b, r, i) {
    if (r === 0) return [b.players[2 * i] || '', b.players[2 * i + 1] || ''];
    return [winner(b, r - 1, 2 * i), winner(b, r - 1, 2 * i + 1)];
  }

  function winner(b, r, i) {
    var res = b.results[mid(r, i)];
    if (!res) return '';
    var p = participants(b, r, i);
    return res.w === 'A' ? p[0] : p[1];
  }

  function champion(b) { return winner(b, ROUNDS - 1, 0); }

  /** Later matches that depend on the winner of match (r, i). */
  function downstream(r, i) {
    var out = [];
    while (r < ROUNDS - 1) { r++; i = Math.floor(i / 2); out.push(mid(r, i)); }
    return out;
  }

  /** Sum of stage scores, or null if any is missing / not a number. */
  function total(arr) {
    var t = 0;
    for (var k = 0; k < arr.length; k++) {
      var v = String(arr[k] == null ? '' : arr[k]).replace(/[,\s]/g, '');
      if (v === '' || !isFinite(Number(v))) return null;
      t += Number(v);
    }
    return t;
  }

  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  /** Cleared scores with the same number of slots (2 stages in Whimpering Wastes, 3 boss points in Hologram). */
  function emptyScoresLike(s) {
    var blank = s.mode === 'hologram' ? '0' : '';
    var len = function (t) { return s.scores && s.scores[t] && s.scores[t].length ? s.scores[t].length : 2; };
    var fill = function (t) { var a = []; for (var k = 0; k < len(t); k++) a.push(blank); return a; };
    return { A: fill('A'), B: fill('B') };
  }

  /** Index in players[] of whoever is on `side` ('A' top / 'B' bottom) of match (r, i), or -1 if undecided. */
  function playerSlot(b, r, i, side) {
    var k = 2 * i + (side === 'A' ? 0 : 1);
    if (r === 0) return k;
    var res = b.results[mid(r - 1, k)];
    return res ? playerSlot(b, r - 1, k, res.w) : -1;
  }

  /** Loaded match's names → draft names (after a player is renamed in the bracket). */
  function syncTeamsFromBracket(s) {
    var b = s.bracket, p = b && parse(b.current);
    if (!p) return;
    var pp = participants(b, p.r, p.i);
    if (pp[0] && pp[1]) s.teams = { A: pp[0], B: pp[1] };
  }

  /** Draft names → bracket players (after a player is renamed in the draft). */
  function syncBracketFromTeams(s) {
    var b = s.bracket, p = b && parse(b.current);
    if (!p) return;
    ['A', 'B'].forEach(function (side) {
      var k = playerSlot(b, p.r, p.i, side);
      var name = s.teams && String(s.teams[side] || '').trim();
      if (k >= 0 && name) b.players[k] = name.slice(0, 40);
    });
  }

  /**
   * Applies a bracket op to a FULL state (draft fields + state.bracket).
   * Returns { state: newState, log: 'what happened' }. Throws Error on invalid ops.
   */
  function apply(state, op) {
    var s = clone(state);
    var b = s.bracket || emptyBracket();
    s.bracket = b;
    var p, id, pp, log;

    switch (op.op) {
      case 'setPlayers': {
        if (!op.list || op.list.length !== SIZE) throw new Error('Need exactly 16 player slots.');
        b.players = op.list.map(function (n) { return String(n == null ? '' : n).trim().slice(0, 40); });
        syncTeamsFromBracket(s);   // keep the loaded match's draft names in step
        log = 'Players updated';
        break;
      }
      case 'loadMatch': {
        p = parse(op.id);
        if (!p) throw new Error('Unknown match.');
        pp = participants(b, p.r, p.i);
        if (!pp[0] || !pp[1]) throw new Error('Both players of this match are not decided yet.');
        b.current = mid(p.r, p.i);
        // Fresh draft for this match: names in, everything else cleared.
        s.teams = { A: pp[0], B: pp[1] };
        s.actions = [];
        s.firstTeam = '';
        s.flipAt = 0;
        s.sequence = [];
        s.scores = emptyScoresLike(s);
        if (Array.isArray(s.bosses)) s.bosses = [];   // Hologram: each match rolls its own bosses
        s.turnStartedAt = Date.now();
        log = 'Loaded match: ' + pp[0] + ' vs ' + pp[1];
        break;
      }
      case 'confirmWinner':
      case 'setWinner': {
        p = parse(op.id || b.current);
        if (!p) throw new Error('No match selected.');
        id = mid(p.r, p.i);
        pp = participants(b, p.r, p.i);
        if (!pp[0] || !pp[1]) throw new Error('Both players of this match are not decided yet.');
        var w, sa = null, sb = null;
        if (op.op === 'confirmWinner') {
          if (id !== b.current) throw new Error('Load this match first.');
          sa = total(s.scores.A);
          sb = total(s.scores.B);
          if (sa === null || sb === null) throw new Error('Enter both stage scores for both players first.');
          if (sa === sb) throw new Error('Scores are tied — pick the winner manually.');
          w = sa > sb ? 'A' : 'B';
        } else {
          if (op.w !== 'A' && op.w !== 'B') throw new Error('Pick the top or bottom player.');
          w = op.w;
          if (id === b.current) { sa = total(s.scores.A); sb = total(s.scores.B); }
          else if (b.results[id]) { sa = b.results[id].sa; sb = b.results[id].sb; }
        }
        var prev = b.results[id];
        if (prev && prev.w !== w) {
          // The old winner had advanced — their later results no longer make sense.
          downstream(p.r, p.i).forEach(function (d) { delete b.results[d]; if (b.current === d) b.current = ''; });
        }
        b.results[id] = { w: w, sa: sa, sb: sb };
        log = (op.op === 'setWinner' ? 'Winner set manually: ' : 'Winner confirmed: ') +
          pp[w === 'A' ? 0 : 1] + ' (' + pp[0] + ' vs ' + pp[1] + ')';
        break;
      }
      case 'clearResult': {
        p = parse(op.id);
        if (!p) throw new Error('Unknown match.');
        id = mid(p.r, p.i);
        if (!b.results[id]) throw new Error('This match has no result yet.');
        pp = participants(b, p.r, p.i);
        delete b.results[id];
        downstream(p.r, p.i).forEach(function (d) { delete b.results[d]; if (b.current === d) b.current = ''; });
        log = 'Cleared result: ' + pp[0] + ' vs ' + pp[1];
        break;
      }
      case 'resetBracket': {
        b.results = {};
        b.current = '';
        log = 'Bracket reset (players kept)';
        break;
      }
      default:
        throw new Error('Unknown bracket op.');
    }
    return { state: s, log: log };
  }

  /** The parts of a state that a bracket change can touch (used for undo snapshots). */
  function snapshot(state) {
    return clone({
      bracket: state.bracket || emptyBracket(), teams: state.teams, firstTeam: state.firstTeam,
      flipAt: state.flipAt, scores: state.scores, actions: state.actions, bosses: state.bosses,
    });
  }

  return {
    SIZE: SIZE, ROUNDS: ROUNDS, OPS: OPS, emptyBracket: emptyBracket, mid: mid, count: count, parse: parse,
    participants: participants, winner: winner, champion: champion, downstream: downstream,
    total: total, apply: apply, snapshot: snapshot,
    playerSlot: playerSlot, syncTeamsFromBracket: syncTeamsFromBracket, syncBracketFromTeams: syncBracketFromTeams,
  };
})();
