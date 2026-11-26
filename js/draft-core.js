/*
 * Draft rules used by the browser in local demo mode.
 * apps-script/Code.gs contains the same rules for the Google Sheets backend —
 * if you change FORMAT or the rules here, change them there too.
 */
(function (global) {
  // X = coin-toss winner, Y = the other player. [who, type, stage]
  // 1 ban each, then 3 picks each per stage, alternating.
  // Stage 2 is started by the player who did NOT start stage 1.
  const FORMAT = [
    ['X', 'ban', 0], ['Y', 'ban', 0],
    ['X', 'pick', 1], ['Y', 'pick', 1], ['X', 'pick', 1], ['Y', 'pick', 1], ['X', 'pick', 1], ['Y', 'pick', 1],
    ['Y', 'pick', 2], ['X', 'pick', 2], ['Y', 'pick', 2], ['X', 'pick', 2], ['Y', 'pick', 2], ['X', 'pick', 2],
  ];

  function buildSequence(first) {
    if (first !== 'A' && first !== 'B') return [];
    const other = first === 'A' ? 'B' : 'A';
    return FORMAT.map(([who, type, stage]) => ({ team: who === 'X' ? first : other, type, stage }));
  }

  function emptyScores() { return { A: ['', ''], B: ['', ''] }; }

  function emptyState() {
    return {
      schema: 2,
      teams: { A: 'Player A', B: 'Player B' },
      firstTeam: '',
      flipAt: 0,
      sequence: [],
      actions: [],
      permaBans: [],
      scores: emptyScores(),
      uniquePicks: UNIQUE_PICKS,
      bracket: global.BracketCore ? global.BracketCore.emptyBracket() : undefined,
      bracketLog: '',
      turnStartedAt: Date.now(),
      version: 1,
      now: Date.now(),
    };
  }

  function currentStep(state) {
    return state.sequence[state.actions.length] || null;
  }

  // false = both players may pick the same resonator (mirror picks).
  const UNIQUE_PICKS = false;

  /**
   * Can this player (team) ban/pick this resonator right now? (type defaults to the current step's type)
   * - Perma bans: nobody.
   * - A ban is aimed at the OPPONENT: it stops them picking it; the banning player still can.
   * - A player can't pick the same resonator twice; mirror picks depend on uniquePicks.
   */
  function isAvailable(state, char, team, type) {
    if (!type) { const step = currentStep(state); type = step ? step.type : 'pick'; }
    if (state.permaBans.includes(char)) return false;
    for (const a of state.actions) {
      if (a.char !== char) continue;
      if (type === 'ban') {
        if (a.type === 'ban' && a.team === team) return false;   // already banned it
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

  const cleanScore = (v) => String(v == null ? '' : v).trim().slice(0, 12);

  /** Applies an op to a copy of state. Throws Error on an invalid op. */
  function apply(state, op) {
    const s = JSON.parse(JSON.stringify(state));
    let resetsTimer = true;
    switch (op.op) {
      case 'flip':
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
        s.actions = [];
        s.firstTeam = '';
        s.flipAt = 0;
        s.sequence = [];
        s.scores = emptyScores();
        break;
      case 'setTeams':
        if (op.A) s.teams.A = String(op.A).slice(0, 40);
        if (op.B) s.teams.B = String(op.B).slice(0, 40);
        // Renaming a player of the loaded bracket match renames them in the bracket too.
        if (global.BracketCore && s.bracket) global.BracketCore.syncBracketFromTeams(s);
        resetsTimer = false;
        break;
      case 'setScores':
        s.scores = { A: [cleanScore(op.A1), cleanScore(op.A2)], B: [cleanScore(op.B1), cleanScore(op.B2)] };
        resetsTimer = false;
        break;
      case 'setPermaBans':
        s.permaBans = [...new Set((op.list || []).map((x) => String(x).slice(0, 40)))].slice(0, 40);
        resetsTimer = false;
        break;
      default:
        throw new Error('Unknown op: ' + op.op);
    }
    if (resetsTimer) s.turnStartedAt = Date.now();
    s.version += 1;
    s.now = Date.now();
    return s;
  }

  global.DraftCore = { FORMAT, UNIQUE_PICKS, buildSequence, emptyState, currentStep, isAvailable, banAgainst, apply };
})(window);
