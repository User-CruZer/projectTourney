/**
 * @OnlyCurrentDoc  Limits this script's access to the Sheet it is attached to.
 *
 * HoloWastes — Pick & Ban backend for Google Sheets.
 *
 * Setup (once):
 *  1. In the Google Sheet: Extensions → Apps Script → paste this file.
 *  2. Run the "setup" function once (authorize when asked). It creates the
 *     "Draft" and "Meta" tabs and generates the admin + captain keys
 *     (written to the "Meta" tab — keep that sheet private).
 *  3. Deploy → New deployment → Web app
 *       Execute as: Me    |    Who has access: Anyone
 *     Copy the /exec URL into js/config.js → API_URL.
 *  After editing this file: Deploy → Manage deployments → Edit → Version: New version.
 *
 * Keep FORMAT / rules in sync with js/draft-core.js.
 */

// X = coin-toss winner, Y = the other player. [who, type, stage]
// 1) first Stage 1 pick each, 2) 1 ban each, 3) rest of Stage 1, 4) Stage 2.
const FORMAT = [
  ['X', 'pick', 1], ['Y', 'pick', 1],
  ['X', 'ban', 0], ['Y', 'ban', 0],
  ['X', 'pick', 1], ['Y', 'pick', 1], ['X', 'pick', 1], ['Y', 'pick', 1],
  ['Y', 'pick', 2], ['X', 'pick', 2], ['Y', 'pick', 2], ['X', 'pick', 2], ['Y', 'pick', 2], ['X', 'pick', 2],
];

// Testing switch: false = anyone with the link can do everything (no admin/captain keys).
// Set back to true before the real tournament, then deploy a new version.
const REQUIRE_KEYS = true;

const UNIQUE_PICKS = false;  // false = both players may pick the same resonator (mirror picks)
const CACHE_KEY = 'draft-state-v2';
const CACHE_SECONDS = 3;     // short cache so manual sheet edits still show up quickly

/* ------------------------------------------------------------------ setup */

function setup() {
  const ss = SpreadsheetApp.getActive();
  const draft = ss.getSheetByName('Draft') || ss.insertSheet('Draft');
  draft.getRange(1, 1, 1, 5).setValues([['Step', 'Player', 'Action', 'Resonator', 'Time']]).setFontWeight('bold');
  draft.setFrozenRows(1);

  if (!ss.getSheetByName('Meta')) ss.insertSheet('Meta');
  const props = PropertiesService.getScriptProperties();
  const gen = () => Utilities.getUuid().replace(/-/g, '').slice(0, 10);
  ['ADMIN_KEY', 'TEAM_A_KEY', 'TEAM_B_KEY'].forEach((k) => {
    if (!props.getProperty(k)) props.setProperty(k, gen());
  });
  const m = readMeta_();
  writeMeta_({
    teamA: m.teamA || 'Player A',
    teamB: m.teamB || 'Player B',
    firstTeam: m.firstTeam || '',
    flipAt: m.flipAt || 0,
    permaBans: m.permaBans || '[]',
    scores: m.scores || JSON.stringify(emptyScores_()),
    version: Number(m.version) || 1,
    turnStartedAt: Date.now(),
    ADMIN_KEY: props.getProperty('ADMIN_KEY'),
    TEAM_A_KEY: props.getProperty('TEAM_A_KEY'),
    TEAM_B_KEY: props.getProperty('TEAM_B_KEY'),
  });
  Logger.log('Admin link suffix:  ?admin=' + props.getProperty('ADMIN_KEY'));
}

/* ------------------------------------------------------------------ http */

function doGet(e) {
  const state = getStateCached_();
  // JSONP (?callback=fn): lets embedded browsers like the OBS browser source read
  // the state without CORS, which they block for this redirecting endpoint.
  const cb = e && e.parameter && e.parameter.callback;
  if (cb && /^[A-Za-z_$][\w$]{0,63}$/.test(cb)) {
    return ContentService.createTextOutput(cb + '(' + JSON.stringify(state) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return json_(state);
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'Bad JSON' }); }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return json_({ ok: false, error: 'Server busy, try again.' });
  try {
    const state = readState_();
    const auth = authorize_(body.key);
    let resetsTimer = true;
    const meta = {};

    if (BracketCore.OPS.indexOf(body.op) >= 0 || body.op === 'undoBracket') {
      // Bracket changes: shared rules in BracketCore.gs, with an undo snapshot per change.
      requireAdmin_(auth);
      const logSheet = sheetOrCreate_('BracketLog', ['Time', 'Change', 'Snapshot before (used by Undo)']);
      let next;
      if (body.op === 'undoBracket') {
        if (logSheet.getLastRow() < 2) throw new Error('Nothing to undo.');
        const snap = JSON.parse(logSheet.getRange(logSheet.getLastRow(), 3).getValue());
        next = Object.assign({}, state, snap);
        logSheet.deleteRow(logSheet.getLastRow());
      } else {
        const res = BracketCore.apply(state, body);
        next = res.state;
        logSheet.appendRow([new Date(), safe_(res.log), JSON.stringify(BracketCore.snapshot(state))]);
      }
      persistFull_(state, next);
      writeBracketView_(next.bracket);
      resetsTimer = body.op === 'loadMatch';
    } else switch (body.op) {
      case 'flip': {
        requireAdmin_(auth);
        if (state.actions.length) throw new Error('Reset the draft before flipping again.');
        meta.firstTeam = Math.random() < 0.5 ? 'A' : 'B';
        meta.flipAt = Date.now();
        break;
      }
      case 'act': {
        const step = state.sequence[state.actions.length];
        if (!state.firstTeam) throw new Error('Flip the coin first.');
        if (!step) throw new Error('Draft is already complete.');
        if (!(auth === 'admin' || auth === step.team)) throw new Error("It's not your turn.");
        if (body.team !== step.team) throw new Error("It's not your turn.");
        const ch = String(body.char || '').trim().slice(0, 40);
        if (!ch) throw new Error('No character selected.');
        if (!isAvailable_(state, ch, step.team, step.type)) throw new Error(ch + ' is not available.');
        sheet_('Draft').appendRow([state.actions.length + 1, step.team, step.type, safe_(ch), new Date()]);
        break;
      }
      case 'undo': {
        requireAdmin_(auth);
        const sheet = sheet_('Draft');
        if (sheet.getLastRow() < 2) throw new Error('Nothing to undo.');
        sheet.deleteRow(sheet.getLastRow());
        break;
      }
      case 'reset': {
        requireAdmin_(auth);
        const sheet = sheet_('Draft');
        if (sheet.getLastRow() > 1) sheet.deleteRows(2, sheet.getLastRow() - 1);
        meta.firstTeam = '';
        meta.flipAt = 0;
        meta.scores = JSON.stringify(emptyScores_());
        break;
      }
      case 'setTeams': {
        requireAdmin_(auth);
        if (body.A) meta.teamA = safe_(String(body.A).slice(0, 40));
        if (body.B) meta.teamB = safe_(String(body.B).slice(0, 40));
        // Renaming a player of the loaded bracket match renames them in the bracket too.
        const renamed = { teams: { A: body.A || state.teams.A, B: body.B || state.teams.B }, bracket: state.bracket };
        BracketCore.syncBracketFromTeams(renamed);
        meta.bracket = JSON.stringify(renamed.bracket);
        writeBracketView_(renamed.bracket);
        resetsTimer = false;
        break;
      }
      case 'setScores': {
        requireAdmin_(auth);
        const c = (v) => String(v == null ? '' : v).trim().slice(0, 12);
        meta.scores = JSON.stringify({ A: [c(body.A1), c(body.A2)], B: [c(body.B1), c(body.B2)] });
        resetsTimer = false;
        break;
      }
      case 'setPermaBans': {
        requireAdmin_(auth);
        const list = [...new Set((body.list || []).map((x) => String(x).slice(0, 40)))].slice(0, 40);
        meta.permaBans = JSON.stringify(list);
        resetsTimer = false;
        break;
      }
      case 'keys': {
        requireAdmin_(auth);
        const p = PropertiesService.getScriptProperties();
        return json_({ ok: true, keys: { A: p.getProperty('TEAM_A_KEY'), B: p.getProperty('TEAM_B_KEY') } });
      }
      default:
        throw new Error('Unknown op.');
    }

    meta.version = (Number(readMeta_().version) || 0) + 1;
    if (resetsTimer) meta.turnStartedAt = Date.now();
    writeMeta_(meta);
    SpreadsheetApp.flush();

    const next = readState_();
    CacheService.getScriptCache().put(CACHE_KEY, JSON.stringify(next), CACHE_SECONDS);
    return json_({ ok: true, state: next });
  } catch (err) {
    return json_({ ok: false, error: err.message, state: readState_() });
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------ state */

function buildSequence_(first) {
  if (first !== 'A' && first !== 'B') return [];
  const other = first === 'A' ? 'B' : 'A';
  return FORMAT.map(([who, type, stage]) => ({ team: who === 'X' ? first : other, type: type, stage: stage }));
}

function emptyScores_() { return { A: ['', ''], B: ['', ''] }; }

function getStateCached_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get(CACHE_KEY);
  if (hit) {
    const s = JSON.parse(hit);
    s.now = Date.now();
    return s;
  }
  const s = readState_();
  cache.put(CACHE_KEY, JSON.stringify(s), CACHE_SECONDS);
  return s;
}

function readState_() {
  const sheet = sheet_('Draft');
  const rows = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues() : [];
  const actions = rows
    .filter((r) => r[3] !== '')
    .map((r) => ({
      team: String(r[1]).toUpperCase(),
      type: String(r[2]).toLowerCase(),
      char: String(r[3]),
      ts: r[4] instanceof Date ? r[4].getTime() : 0,
    }));
  const meta = readMeta_();
  const first = meta.firstTeam === 'A' || meta.firstTeam === 'B' ? meta.firstTeam : '';
  const state = {
    schema: 2,
    teams: { A: String(meta.teamA || 'Player A'), B: String(meta.teamB || 'Player B') },
    firstTeam: first,
    flipAt: Number(meta.flipAt) || 0,
    sequence: buildSequence_(first),
    actions: actions,
    permaBans: parseJson_(meta.permaBans, []),
    scores: parseJson_(meta.scores, emptyScores_()),
    uniquePicks: UNIQUE_PICKS,
    openAccess: !REQUIRE_KEYS,
    bracket: parseJson_(meta.bracket, BracketCore.emptyBracket()),
    bracketLog: lastBracketLog_(),
    turnStartedAt: Number(meta.turnStartedAt) || Date.now(),
    now: Date.now(),
  };
  // Changes whenever anything visible changes, including manual edits in the sheet.
  state.version = (Number(meta.version) || 0) + ':' + hash_(JSON.stringify([
    actions.map((a) => a.team + a.type + a.char), state.teams, first, state.flipAt,
    state.permaBans, state.scores, state.turnStartedAt, state.bracket, state.bracketLog]));
  return state;
}

/**
 * Same rules as isAvailable() in js/draft-core.js:
 * perma bans block everyone; a ban only blocks the OPPONENT of whoever banned it;
 * a player can't pick the same resonator twice; mirror picks depend on UNIQUE_PICKS.
 */
function isAvailable_(state, ch, team, type) {
  if (state.permaBans.indexOf(ch) >= 0) return false;
  return !state.actions.some((a) => {
    if (a.char !== ch) return false;
    if (type === 'ban') return a.team === team ? a.type === 'ban' : a.type === 'pick';   // own repeat ban / opponent's pick
    if (a.type === 'ban') return a.team !== team;
    return a.team === team || UNIQUE_PICKS;
  });
}

/* ------------------------------------------------------------------ bracket */

/** Writes every field a bracket change can touch (names, coin, scores, bracket, draft rows). */
function persistFull_(prev, next) {
  writeMeta_({
    teamA: safe_(next.teams.A), teamB: safe_(next.teams.B),
    firstTeam: next.firstTeam || '', flipAt: next.flipAt || 0,
    scores: JSON.stringify(next.scores), bracket: JSON.stringify(next.bracket),
  });
  const key = (acts) => JSON.stringify((acts || []).map((a) => [a.team, a.type, a.char]));
  if (key(prev.actions) !== key(next.actions)) {
    const sh = sheet_('Draft');
    if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
    if (next.actions.length) {
      sh.getRange(2, 1, next.actions.length, 5).setValues(next.actions.map((a, k) =>
        [k + 1, a.team, a.type, safe_(a.char), new Date(a.ts || Date.now())]));
    }
  }
}

/** Read-only "Bracket" tab so organizers can see the bracket in the Sheet. */
function writeBracketView_(b) {
  const ROUND_NAMES = ['Penyisihan', 'Perempat Final', 'Semifinal', 'Final'];
  const sh = sheetOrCreate_('Bracket', null);
  const rows = [['VIEW ONLY: change the bracket from the admin control page', '', '', '', '', '', ''],
    ['Round', 'Match', 'Top player', 'Top score', 'Bottom player', 'Bottom score', 'Winner']];
  for (let r = 0; r < BracketCore.ROUNDS; r++) {
    for (let i = 0; i < BracketCore.count(r); i++) {
      const p = BracketCore.participants(b, r, i);
      const res = b.results[BracketCore.mid(r, i)];
      rows.push([ROUND_NAMES[r], 'M' + (i + 1), safe_(p[0]), res && res.sa != null ? res.sa : '',
        safe_(p[1]), res && res.sb != null ? res.sb : '', res ? safe_(p[res.w === 'A' ? 0 : 1]) : '']);
    }
  }
  rows.push(['Champion', '', safe_(BracketCore.champion(b)), '', '', '', '']);
  sh.clearContents();
  sh.getRange(1, 1, rows.length, 7).setValues(rows);
  sh.getRange(2, 1, 1, 7).setFontWeight('bold');
}

function lastBracketLog_() {
  const sh = SpreadsheetApp.getActive().getSheetByName('BracketLog');
  return sh && sh.getLastRow() > 1 ? String(sh.getRange(sh.getLastRow(), 2).getValue()) : '';
}

function sheetOrCreate_(name, header) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    if (header) { sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold'); sh.setFrozenRows(1); }
  }
  return sh;
}

/* ------------------------------------------------------------------ utils */

function authorize_(key) {
  if (!REQUIRE_KEYS) return 'admin';   // open access while testing
  if (!key) return null;
  const p = PropertiesService.getScriptProperties();
  if (key === p.getProperty('ADMIN_KEY')) return 'admin';
  if (key === p.getProperty('TEAM_A_KEY')) return 'A';
  if (key === p.getProperty('TEAM_B_KEY')) return 'B';
  return null;
}

function requireAdmin_(auth) {
  if (auth !== 'admin') throw new Error('Admin only.');
}

function sheet_(name) {
  const s = SpreadsheetApp.getActive().getSheetByName(name);
  if (!s) throw new Error('Missing sheet "' + name + '". Run setup() first.');
  return s;
}

function readMeta_() {
  const s = SpreadsheetApp.getActive().getSheetByName('Meta');
  if (!s || s.getLastRow() < 1) return {};
  const out = {};
  s.getRange(1, 1, s.getLastRow(), 2).getValues().forEach((r) => { if (r[0]) out[r[0]] = r[1]; });
  return out;
}

function writeMeta_(obj) {
  const s = sheet_('Meta');
  const merged = Object.assign(readMeta_(), obj);
  const rows = Object.keys(merged).map((k) => [k, merged[k]]);
  s.clearContents();
  if (rows.length) s.getRange(1, 1, rows.length, 2).setNumberFormat('@').setValues(rows);
}

/** Stops text that starts with = + - @ being treated as a spreadsheet formula. */
function safe_(v) {
  const s = String(v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function parseJson_(v, fallback) {
  try { const x = JSON.parse(v); return x == null ? fallback : x; } catch (e) { return fallback; }
}

function hash_(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return h;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
