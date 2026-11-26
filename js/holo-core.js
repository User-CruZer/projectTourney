/*
 * Hologram draft rules used by the browser in local demo mode. Hologram pages load this file
 * INSTEAD of js/draft-core.js: it defines the same global DraftCore API, so the shared
 * modules (common.js, backend.js, bracket.js) work unchanged.
 * apps-script-hologram/Code.gs contains the same rules for the Hologram Google Sheet —
 * if you change FORMAT or the rules here, change them there too.
 *
 * A Hologram match: 3 bosses are rolled first, then a coin toss, then each player drafts ONE
 * team of 3 (1 ban each). Points: the admin ticks one box per boss for each player who earned
 * that boss's point (scores = { A: ['0'|'1' x3], B: [...] }); more points wins.
 */
(function (global) {
  // X = coin-toss winner, Y = the other player. [who, type, stage]
  // 1) first pick each, 2) 1 ban each, 3) the rest of the team alternating.
  const FORMAT = [
    ['X', 'pick', 1], ['Y', 'pick', 1],
    ['X', 'ban', 0], ['Y', 'ban', 0],
    ['X', 'pick', 1], ['Y', 'pick', 1], ['X', 'pick', 1], ['Y', 'pick', 1],
  ];
  const BOSS_COUNT = 3;

  // false = both players may pick the same resonator (mirror picks).
  const UNIQUE_PICKS = false;

  function buildSequence(first) {
    if (first !== 'A' && first !== 'B') return [];
    const other = first === 'A' ? 'B' : 'A';
    return FORMAT.map(([who, type, stage]) => ({ team: who === 'X' ? first : other, type, stage }));
  }

  const zeros = () => Array(BOSS_COUNT).fill('0');
  function emptyScores() { return { A: zeros(), B: zeros() }; }

  function emptyState() {
    const cfg = global.TOURNEY_CONFIG || {};
    const bracket = global.BracketCore ? global.BracketCore.emptyBracket() : undefined;
    if (bracket && Array.isArray(cfg.HOLO_PLAYERS) && cfg.HOLO_PLAYERS.length === bracket.players.length) {
      bracket.players = cfg.HOLO_PLAYERS.map((n) => String(n).slice(0, 40));
    }
    return {
      schema: 2,
      mode: 'hologram',
      teams: { A: 'Player A', B: 'Player B' },
      bosses: [],
      firstTeam: '',
      flipAt: 0,
      sequence: [],
      actions: [],
      permaBans: [],
      scores: emptyScores(),
      uniquePicks: UNIQUE_PICKS,
      bracket,
      bracketLog: '',
      breakUntil: 0,
      breakLabel: '',
      turnStartedAt: Date.now(),
      version: 1,
      now: Date.now(),
    };
  }

  function currentStep(state) {
    return state.sequence[state.actions.length] || null;
  }

  /** Same rules as Whimpering Wastes (see js/draft-core.js). */
  function isAvailable(state, char, team, type) {
    if (!type) { const step = currentStep(state); type = step ? step.type : 'pick'; }
    if (state.permaBans.includes(char)) return false;
    for (const a of state.actions) {
      if (a.char !== char) continue;
      if (type === 'ban') {
        if (a.type === 'ban' && a.team === team) return false;   // already banned it
        if (a.type === 'pick' && a.team !== team) return false;  // opponent already picked it
        continue;
      }
      if (a.type === 'ban' && a.team !== team) return false;     // opponent banned it against me
      if (a.type === 'pick' && (a.team === team || state.uniquePicks)) return false;
    }
    return true;
  }

  /** The ban aimed at this player (made by the opponent): { index in sequence, action or null }. */
  function banAgainst(state, team) {
    const i = state.sequence.findIndex((x) => x.type === 'ban' && x.team !== team);
    return { index: i, action: i >= 0 ? state.actions[i] || null : null };
  }

  /** Validated list of exactly 3 different boss names. Throws on anything else. */
  function cleanBosses(list) {
    const out = (Array.isArray(list) ? list : []).map((b) => String(b == null ? '' : b).trim().slice(0, 40));
    if (out.length !== BOSS_COUNT || out.some((b) => !b)) throw new Error('Pick exactly 3 bosses.');
    if (new Set(out).size !== BOSS_COUNT) throw new Error('Each boss can only be used once per match.');
    return out;
  }
  /** Points for one player: exactly 3 slots, each '1' (point) or '0'. */
  function cleanPoints(arr) {
    if (!Array.isArray(arr) || arr.length !== BOSS_COUNT) throw new Error('Points need one box per boss.');
    return arr.map((v) => (String(v) === '1' ? '1' : '0'));
  }

  /** Applies an op to a copy of state. Throws Error on an invalid op. */
  function apply(state, op) {
    const s = JSON.parse(JSON.stringify(state));
    if (!Array.isArray(s.bosses)) s.bosses = [];
    let resetsTimer = true;
    switch (op.op) {
      case 'setBosses':
        if (s.actions.length) throw new Error('The draft has started — reset the match to change the bosses.');
        s.bosses = cleanBosses(op.list);
        resetsTimer = false;
        break;
      case 'flip':
        if (s.bosses.length !== BOSS_COUNT) throw new Error('Roll the bosses first.');
        if (s.actions.length) throw new Error('Reset the draft before flipping again.');
        s.firstTeam = Math.random() < 0.5 ? 'A' : 'B';
        s.flipAt = Date.now();
        s.sequence = buildSequence(s.firstTeam);
        break;
      case 'act': {
        const step = currentStep(s);
        if (!s.firstTeam) throw new Error('Flip the coin first.');
        if (!step) throw new Error('Draft is already complete.');
        if (op.team !== step.team) throw new Error("It's not your turn.");
        if (!op.char) throw new Error('No character selected.');
        if (!isAvailable(s, op.char, op.team, step.type)) throw new Error(op.char + ' is not available.');
        s.actions.push({ team: step.team, type: step.type, char: op.char, ts: Date.now() });
        break;
      }
      case 'undo':
        if (!s.actions.length) throw new Error('Nothing to undo.');
        s.actions.pop();
        break;
      case 'reset':
        // Clears the toss, draft and points; the rolled bosses stay (re-roll is allowed again).
        s.actions = [];
        s.firstTeam = '';
        s.flipAt = 0;
        s.sequence = [];
        s.scores = emptyScores();
        break;
      case 'setTeams':
        if (op.A) s.teams.A = String(op.A).slice(0, 40);
        if (op.B) s.teams.B = String(op.B).slice(0, 40);
        if (global.BracketCore && s.bracket) global.BracketCore.syncBracketFromTeams(s);
        resetsTimer = false;
        break;
      case 'setScores':
        s.scores = { A: cleanPoints(op.A), B: cleanPoints(op.B) };
        resetsTimer = false;
        break;
      case 'setPermaBans':
        s.permaBans = [...new Set((op.list || []).map((x) => String(x).slice(0, 40)))].slice(0, 40);
        resetsTimer = false;
        break;
      case 'setBreak': {
        const secs = Math.max(0, Math.min(3 * 3600, Math.round(Number(op.seconds) || 0)));
        s.breakUntil = secs ? Date.now() + secs * 1000 : 0;
        s.breakLabel = String(op.label == null ? '' : op.label).trim().slice(0, 40);
        resetsTimer = false;
        break;
      }
      default:
        throw new Error('Unknown op: ' + op.op);
    }
    if (resetsTimer) s.turnStartedAt = Date.now();
    s.version += 1;
    s.now = Date.now();
    return s;
  }

  global.DraftCore = {
    FORMAT, BOSS_COUNT, UNIQUE_PICKS, buildSequence, emptyState, emptyScores, currentStep, isAvailable, banAgainst, apply,
  };
})(window);
