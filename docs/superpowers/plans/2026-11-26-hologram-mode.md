# Hologram Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Hologram tournament (boss roll → coin toss → 8-step draft → per-boss points) with its own control page, overlays and data, behind a chooser on `index.html`, without changing how Whimpering Wastes (WW) works.

**Architecture:** Hologram pages set `window.HW_MODE = 'hologram'` before `js/config.js`, load `js/holo-core.js` (same global `DraftCore` API as `js/draft-core.js`, Hologram rules) and reuse the shared modules (`common.js`, `backend.js`, `bracket-core.js`, `bracket.js`, theme). Hologram data lives in a separate Google Sheet / Apps Script (`apps-script-hologram/`); until its URL is set the Hologram pages run in demo mode.

**Tech Stack:** Static HTML/CSS/vanilla JS (GitHub Pages), Google Apps Script + Sheets, Node (no deps) for rule tests.

**Spec:** `docs/superpowers/specs/2026-11-26-hologram-mode-design.md`

## Global Constraints
- WW overlay URLs (`overlay.html`, `screens.html`, `bracket.html`) and their behaviour must not change.
- Hologram FORMAT (X = toss winner): `X pick, Y pick, X ban, Y ban, X pick, Y pick, X pick, Y pick` (all picks stage 1).
- Ban/pick rules identical to WW `isAvailable` (ban only blocks opponent; can't ban opponent's existing pick; mirrors allowed; no picking twice; perma bans block all).
- Points: `scores = { A: ['0','0','0'], B: ['0','0','0'] }`, each slot `'0'|'1'`, one slot per boss.
- Bosses: exactly 3 distinct names; settable only while `actions.length === 0`.
- `HOLO_BOSSES` = Inferno Rider, Fleurdelys, The False Sovereign, Lioness of Glory, Lady of the Sea, Fallacy of No Return, Sigillum, Myriad Snare.
- `HOLO_PLAYERS` (bracket order) = MOCHIEL, SHAN, YOIDERA, KENL, WILD CARD, VELL, WIZZNU, RYUU ZUKI, LEONAR, WILD CARD, LESIL, FUKASA, ALPHA, WEZEN, PIYUTO, QING GIAO.
- Same Noir theme, logo (`img/logo.png` via `HW.brand`) on control/draft/bracket; screens keeps the text title.
- No CSS `:has()` (older OBS); bump the `?v=` tag on every page when CSS/JS changes.
- Do not commit or push (the organizer commits); do not deploy Apps Script unless asked.

## Review Focus
- Old WW links `index.html?admin=KEY` / `?team=A&key=…` / `?local=1` must land on the WW control page with the same query (forwarding) — tested in Task 3.
- Hologram demo data must not overwrite WW demo data in the same browser (separate localStorage keys) — tested in Task 1.
- Boss roll/hand-pick after the draft started must be refused (server and demo) — tested in Task 2 and Task 8.
- Points total with all boxes unticked (0–0) must not be confirmable (tie) and a 2–1 must advance the leader — tested in Task 2 (BracketCore with holo scores).
- Long player names (e.g. RYUU ZUKI, QING GIAO, WILD CARD) and long boss names (Fallacy of No Return) must fit plates/cards — checked in Tasks 5–6 with an overflow scan.

---

### Task 1: Mode plumbing (config + backend)

**Files:**
- Modify: `js/config.js`, `js/backend.js`
- Test: `tests/mode.test.js`

**Interfaces:**
- Produces: `TOURNEY_CONFIG.MODE` (`'wastes'|'hologram'`), `TOURNEY_CONFIG.HOLO_API_URL` (string, `''` for now), `TOURNEY_CONFIG.HOLO_BOSSES` (string[8]), `TOURNEY_CONFIG.HOLO_PLAYERS` (string[16]); in hologram mode `API_URL` = `HOLO_API_URL` (still `''` with `?local=1`). `backend.js` local keys: `projectTourney.draft` / `projectTourney.bracketLog` in WW, `projectTourney.hologram.draft` / `projectTourney.hologram.bracketLog` in hologram.

- [ ] **Step 1: Write `tests/mode.test.js`** (Node `vm`, fake `window`/`location`): loads `js/config.js` with `window.HW_MODE` unset → `MODE === 'wastes'`, `API_URL` is the WW URL; with `HW_MODE = 'hologram'` → `MODE === 'hologram'`, `API_URL === HOLO_API_URL`, `HOLO_BOSSES.length === 8`, `HOLO_PLAYERS.length === 16`; with `?local=1` both modes give `API_URL === ''`. Also asserts `backend.js` source contains a mode-dependent key (exported `createBackend.storageKeys(cfg)` returns the four names above).
- [ ] **Step 2: Run** `node tests/mode.test.js` → FAIL (MODE undefined).
- [ ] **Step 3: Implement** in `config.js` (read `window.HW_MODE`; keep WW URL; add the three settings) and `backend.js` (`storageKeys(cfg)` used by `localBackend`, attached as `createBackend.storageKeys`).
- [ ] **Step 4: Run** `node tests/mode.test.js` → `all passed`; reload `overlay.html?local=1` → WW demo data still shows (unchanged keys).
- [ ] **Step 5:** Leave uncommitted.

### Task 2: Hologram rules (`js/holo-core.js`)

**Files:**
- Create: `js/holo-core.js`
- Test: `tests/holo-core.test.js`

**Interfaces:**
- Consumes: `window.BracketCore` (for `emptyBracket`), `TOURNEY_CONFIG.HOLO_PLAYERS`.
- Produces: global `DraftCore = { FORMAT, UNIQUE_PICKS:false, buildSequence(first), emptyState(), currentStep(s), isAvailable(s,char,team,type?), banAgainst(s,team), apply(s,op) }`. State adds `bosses: string[]` (`[]` until rolled), `breakUntil`, `breakLabel`; `emptyState().bracket.players = HOLO_PLAYERS`. Ops: `flip` (refused if `bosses.length !== 3`: "Roll the bosses first."), `act`, `undo`, `reset` (clears actions/toss/points, keeps bosses), `setTeams`, `setScores {A:[3], B:[3]}` (each coerced to `'1'` if truthy-'1' else `'0'`), `setBosses {list}` (3 distinct non-empty trimmed ≤40 chars; refused when `actions.length > 0`), `setPermaBans`, `setBreak` (as WW).

- [ ] **Step 1: Write `tests/holo-core.test.js`** covering: sequence for first `'B'` equals `B pick,A pick,B ban,A ban,B pick,A pick,B pick,A pick`; `flip` before bosses throws; `setBosses` with 2 names / duplicate throws; full 8-step draft completes and 9th act throws; ban rules (opponent-pick ban refused, banned char blocked for opponent only, mirror allowed, own repeat refused); `setBosses` after first act throws; `reset` keeps bosses and zeroes points; `setScores` `{A:['1','x',''],B:[1,'0','1']}` → `A:['1','0','0'], B:['1','0','1']`; with `BracketCore` loaded: load match 0-0, points 0–0 → `confirmWinner` throws tie; A 2–1 → winner side `'A'`, result `sa:2, sb:1`.
- [ ] **Step 2: Run** `node tests/holo-core.test.js` → FAIL (file missing).
- [ ] **Step 3: Implement `js/holo-core.js`** mirroring `draft-core.js` structure with the Hologram FORMAT and ops above.
- [ ] **Step 4: Run** `node tests/holo-core.test.js` → all pass; also `node tests/rules.test.js` style WW checks still pass (copy the session's WW rule test into `tests/rules.test.js` and run it).
- [ ] **Step 5:** Leave uncommitted.

### Task 3: Chooser + WW control moves to `wastes.html`

**Files:**
- Create: `wastes.html` (today's `index.html` content), `css/chooser.css`
- Modify: `index.html` (becomes chooser), `js/control.js:300-303` (base path: strip any trailing `*.html`, not only `index.html`)
- Test: `tests/chooser.test.js`

**Interfaces:**
- Produces: `index.html` forwards to `wastes.html` + original query when the query has any of `admin`, `team`, `key`, `local` (via `location.replace`); otherwise shows logo + two cards linking `hologram.html` and `wastes.html`.

- [ ] **Step 1: Write `tests/chooser.test.js`**: reads `index.html`, extracts the inline forwarding function `hwForward(search)` and asserts `?admin=abc` → `'wastes.html?admin=abc'`, `?team=A&key=k` → `'wastes.html?team=A&key=k'`, `?local=1` → `'wastes.html?local=1'`, `''` → `null`; asserts `wastes.html` contains `id="roster"` and `js/control.js`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** chooser page (Noir cards, logo via `HW.brand`, one line per mode: "Hologram — 3 bosses, 1 team" / "Whimpering Wastes — 2 stages") and the move.
- [ ] **Step 4: Run** the test → pass; browser: `index.html?admin=1&local=1` lands on `wastes.html?admin=1&local=1` with the WW admin panel; admin "Links" still list `overlay.html` etc. with the right base path.
- [ ] **Step 5:** Leave uncommitted.

### Task 4: Hologram control page

**Files:**
- Create: `hologram.html`, `js/holo-control.js`
- Modify: `css/style.css` (boss + points styles)

**Interfaces:**
- Consumes: `DraftCore` from Task 2 (ops `setBosses`, `setScores`), `TOURNEY_CONFIG.HOLO_BOSSES`, shared `HW`, `BracketCore`, `createBackend`.
- Produces: admin groups **Bosses** (Roll/Re-roll button → random 3 distinct from `HOLO_BOSSES`; three `<select>`s + Save for hand-pick; all disabled once the draft started), **Coin toss** (disabled with hint "Roll the bosses first" until 3 bosses), **Points** (3 bosses × 2 players checkbox grid; each change sends `setScores` with all six values; shows totals), plus Players, Break timer, Perma bans, Draft, Links (holo overlays + captain links), Bracket — same behaviour as WW. Preview switch targets `holo-overlay.html`, `holo-screens.html`, `holo-bracket.html`.

- [ ] **Step 1:** Build `hologram.html` from `wastes.html` (sets `window.HW_MODE='hologram'`, loads `holo-core.js` instead of `draft-core.js`, `holo-control.js` instead of `control.js`); remove the WW stage-score grid; add the Bosses and Points groups.
- [ ] **Step 2:** Build `js/holo-control.js` from `js/control.js` with: turn label "picks"/"bans" (no stage), bosses + points handlers, boss-dependent flip guard, Hologram links.
- [ ] **Step 3: Verify in browser** (`hologram.html?admin=1&local=1`): roll → 3 distinct bosses; hand-pick duplicate refused with toast; flip disabled before roll; 8-step draft with lock bar; re-roll disabled after first pick; tick points → totals update and persist on reload; Confirm winner shows the leader at 2–1 and refuses 1–1; bracket shows `HOLO_PLAYERS`; WW demo data unchanged in `wastes.html?admin=1&local=1`.
- [ ] **Step 4:** Leave uncommitted.

### Task 5: Hologram draft overlay

**Files:**
- Create: `holo-overlay.html`, `js/holo-overlay.js`, `css/holo.css`

**Interfaces:**
- Consumes: state from Task 2 (`bosses`, `scores` as points, `sequence`, `actions`), `HW.coinToss`, `HW.brand`, `HW.backdrop`, `HW.portrait`.
- Produces: 1920×1080 layout — rows `150px 88px 116px 150px 1fr` (logo, perma, top row with name plates showing 3 point boxes + total, bans, status; boss strip with Boss 1–3 cards showing name and a gold check under the player who has that point; team row with one 3-slot panel per player). Lock-in animation + coin toss as WW. `?bg=0` transparent.

- [ ] **Step 1:** Implement page + script + CSS (reuse `overlay.css` classes where identical).
- [ ] **Step 2: Verify at 1920×1080** in demo with a full draft of long names and bosses incl. "Fallacy of No Return": overflow scan (`scrollWidth/scrollHeight` vs client) returns `[]`; no element bottom > 1080; points boxes fill when ticked from `hologram.html` in another tab within 1 s.
- [ ] **Step 3:** Leave uncommitted.

### Task 6: Hologram screens overlay

**Files:**
- Create: `holo-screens.html`, `js/holo-screens.js`; Modify: `css/holo.css`

**Interfaces:**
- Consumes: same as Task 5.
- Produces: same windows as WW (924×520 at x 24 / 972, y 128, see-through holes via `HW.backdrop`), text title + "VS", name plates with point boxes, perma strip (y 666), per-player panel (y 718, h 338): ban chip, 3 picks (portrait 108), and a row of the 3 bosses with that player's ticks. `?guides=1`, `?bg=0` as WW.

- [ ] **Step 1:** Implement.
- [ ] **Step 2: Verify at 1920×1080**: red page behind shows exactly through the two windows; overflow scan `[]` with long names; panels end ≤ 1056.
- [ ] **Step 3:** Leave uncommitted.

### Task 7: Hologram bracket overlay

**Files:**
- Create: `holo-bracket.html`
- Modify: `js/bracket.js` (live panel phase: when `Array.isArray(s.bosses) && s.bosses.length < 3` and no toss yet → `{ key:'bosses', text:'Rolling bosses', sub:'Getting ready', progress:0 }`)

**Interfaces:**
- Consumes: `bracket.js`/`bracket.css` unchanged otherwise; Task 2 `DraftCore`.

- [ ] **Step 1:** Create page (HW_MODE hologram, loads `holo-core.js`, `bracket.js`), add the phase line.
- [ ] **Step 2: Verify:** `holo-bracket.html?local=1` shows the 16 Hologram players, live panel follows the Hologram match (Rolling bosses → Coin toss → picking → "X wins · advances"); break timer shows; `bracket.html?local=1` (WW) unchanged.
- [ ] **Step 3:** Leave uncommitted.

### Task 8: Hologram Apps Script

**Files:**
- Create: `apps-script-hologram/Code.gs` (from `apps-script/Code.gs`), `apps-script-hologram/BracketCore.gs` (copy of `js/bracket-core.js`)
- Test: `tests/holo-gs.test.js`

**Interfaces:**
- Produces: same HTTP contract as WW; Meta field `bosses` (JSON array); ops `setBosses` (admin, 3 distinct, refused after first draft row), `setScores {A:[3],B:[3]}`, `flip` refused without 3 bosses; `reset` keeps bosses; `readState_` returns `bosses` and 3-slot `scores` (default `'0'`), included in the version hash; FORMAT = Hologram FORMAT; `REQUIRE_KEYS = true`.

- [ ] **Step 1: Write `tests/holo-gs.test.js`**: extracts `FORMAT` from `apps-script-hologram/Code.gs` and asserts equality with `holo-core.js` `FORMAT`; asserts `BracketCore.gs` equals `js/bracket-core.js` (CRLF-insensitive); runs the extracted `isAvailable_` against the same ban cases as Task 2; checks the `setBosses` case contains the `actions.length` guard.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → pass; `node --check` on both files (copied to `.js`).
- [ ] **Step 5:** Leave uncommitted.

### Task 9: Docs + full regression

**Files:**
- Modify: `README.md` (chooser, Hologram section: format, points, bosses/players config, WILD CARD/bye, setting up the Hologram Sheet step by step, new URLs), version tag on all pages.

- [ ] **Step 1:** Write README sections; bump `?v=` on all 9 HTML pages.
- [ ] **Step 2: Run** all tests: `node tests/mode.test.js && node tests/holo-core.test.js && node tests/rules.test.js && node tests/chooser.test.js && node tests/holo-gs.test.js` → all pass.
- [ ] **Step 3: Browser regression:** WW `overlay.html`, `screens.html?stage=1`, `bracket.html`, `wastes.html?admin=…` against the live Sheet (read-only) unchanged; Hologram full demo run on all four Hologram pages.
- [ ] **Step 4:** Leave uncommitted; report the Hologram Sheet setup steps to the organizer.
