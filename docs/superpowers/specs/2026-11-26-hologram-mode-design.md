# Hologram mode — design

## Why
The site was built for the **Whimpering Wastes** (WW) tournament. The organizer also runs a
**Hologram** tournament (Wuthering Waves Tactical Holograms) and wants it on the same site, with
the same look, chosen from a landing page. The WW tournament must keep working exactly as now.

## Goals
- `index.html` becomes a chooser: **Hologram** or **Whimpering Wastes**.
- Hologram gets its own control page and its own overlays (draft, screens, bracket), same Noir
  theme, logo and gradient background.
- Hologram match format:
  1. **Boss roll first:** 3 different bosses drawn at random from a boss pool, shown before the draft.
  2. **Coin toss** (same as WW).
  3. **Draft, one team of 3 each:** `X pick, Y pick, X ban, Y ban, X pick, Y pick, X pick, Y pick`
     (X = toss winner). Same rules as WW: a ban only blocks the opponent, you can't ban the
     opponent's existing pick, mirror picks allowed, nobody picks the same resonator twice.
  4. **Perma bans** by the system (same as WW).
  5. **Points:** per boss, the admin ticks a box for each player who earned that boss's point.
     A player's points = ticked boxes (0–3). More points wins; **Confirm winner** advances them.
     Ties → the admin picks the winner manually (existing "[Name] wins" button).
- Hologram has its **own players, bracket, match and data**, so the two tournaments never overwrite
  each other.

## Non-goals
- No changes to how WW works or looks (only: its control page moves, see below).
- No chat box / single-stage variants for the Hologram screens overlay (one team only).
- No automatic clear-time scoring; points are the admin's call.

## Anti-goals
- Breaking the live WW setup before its event (pages, OBS URLs, Apps Script, data).
- Hologram writes landing in the WW Sheet (or the other way round).

## Constraints
- Static site on GitHub Pages; live state in Google Sheets via Apps Script (JSONP reads, text/plain
  POST writes), polling every 2 s; works in OBS's embedded browser (no CSS `:has`).
- Keys (`REQUIRE_KEYS`) work the same in both modes.
- The organizer commits/pushes and deploys Apps Script themselves unless they ask otherwise.

## Approaches (picked: A)
- **A. Separate Hologram pages + separate Google Sheet / Apps Script** *(picked)* — WW untouched,
  Hologram free to differ; costs a second Sheet + deployment (made from the organizer's own Google
  account, so it doesn't depend on the helper account) and some duplicated page code.
- B. One set of pages with `?mode=hologram` and one Sheet with per-mode tabs — single codebase, but
  edits the working WW code everywhere and needs a WW Apps Script redeploy.
- C. Separate pages sharing the current Sheet/Apps Script — no second Sheet, but the live WW script
  still changes and still runs as the helper account.

## Design

### Pages / URLs
| Page | Purpose |
|---|---|
| `index.html` | **Chooser** (logo + two big cards). If opened with `admin`, `team`, `key` or `local` in the URL it forwards to `wastes.html` with the same query, so existing WW admin/captain links keep working. |
| `wastes.html` | WW control page (today's `index.html`, moved). |
| `overlay.html`, `screens.html`, `bracket.html` | WW overlays — **unchanged URLs**. |
| `hologram.html` | Hologram control page. |
| `holo-overlay.html`, `holo-screens.html`, `holo-bracket.html` | Hologram overlays (1920×1080). |

### Mode selection in code
- Each Hologram page sets `window.HW_MODE = 'hologram'` before loading `js/config.js`.
- `config.js` adds `HOLO_API_URL` (empty until the Hologram Apps Script is deployed → Hologram pages
  run in demo mode with the demo banner) and `HOLO_BOSSES` (the boss pool). When
  `HW_MODE === 'hologram'`, `API_URL` resolves to `HOLO_API_URL`.
- `backend.js`: demo-mode localStorage keys get a `hologram.` prefix in Hologram mode (separate demo data).
- Hologram pages load **`js/holo-core.js`** instead of `js/draft-core.js`. It defines the same
  global `DraftCore` API (`FORMAT, UNIQUE_PICKS, buildSequence, emptyState, currentStep, isAvailable,
  banAgainst, apply`) so the shared modules (`common.js`, `backend.js`, `bracket.js`) work unchanged.
  Differences: the 8-step FORMAT, `scores = { A: ['0','0','0'], B: ['0','0','0'] }` (one point slot
  per boss), `bosses: []` in state, and ops `setBosses` (exactly 3 distinct names, only before the
  first draft action) and `setScores` taking `A: [..3], B: [..3]` of `'0'|'1'`. `reset` clears
  points but keeps bosses; a new boss roll is allowed until the draft starts.
- Shared unchanged: `bracket-core.js` (points arrays sum via `total()`), `common.js`, theme,
  logo, backdrop, coin toss, keys, polling.

### Boss roll
- Rolled in the admin's browser (random 3 distinct from `HOLO_BOSSES`, minus nothing) and saved with
  `setBosses`; **Re-roll** and **Pick by hand** (3 dropdowns) are available until the draft starts.
- Boss pool (organizer's list, editable in `config.js` as `HOLO_BOSSES`), 8 bosses, 3 rolled at
  random (no per-region rule): Inferno Rider, Fleurdelys, The False Sovereign, Lioness of Glory,
  Lady of the Sea, Fallacy of No Return, Sigillum, Myriad Snare.

### Hologram players
- 16-slot bracket kept. 14 players today; empty slots are **WILD CARD**. A late entrant replaces a
  WILD CARD name (results follow the slot). An unfilled WILD CARD match is settled with the existing
  "[Name] wins" button (a bye).
- Starting players (`HOLO_PLAYERS` in `config.js`, used as the Hologram bracket's initial players
  in demo mode and entered once into the Hologram Sheet after it's deployed), in bracket order:
  MOCHIEL, SHAN, YOIDERA, KENL, WILD CARD, VELL, WIZZNU, RYUU ZUKI, LEONAR, WILD CARD, LESIL,
  FUKASA, ALPHA, WEZEN, PIYUTO, QING GIAO.

### Hologram control page (`hologram.html` + `js/holo-control.js`)
Copy of the WW control page adapted: resonator picker and lock bar as WW (labels "pick" without
stage); admin panel groups: **Bosses** (Roll / Re-roll / pick by hand, shows the 3 bosses),
Coin toss, Players, **Points** (grid: 3 bosses × 2 players of tick boxes, saves on tick), Break
timer, Perma bans, Draft (undo/reset), Links (Hologram overlay links + captain links), Bracket
(same bracket UI, Hologram data), preview switch (Draft / Screens / Bracket → Hologram overlays).

### Hologram overlays
- **Draft (`holo-overlay.html`):** logo row, perma-ban panel, top row as WW but each name plate
  shows 3 point boxes + points total instead of a score total; a **boss strip** (Boss 1–3, name,
  and whose point it is); then one **Team** panel per player with 3 pick slots (portrait + name).
  Same lock-in animations and coin toss.
- **Screens (`holo-screens.html`):** same two transparent windows (924×520 at x 24 / 972, y 128 —
  same OBS numbers as WW), name plates with point boxes, perma strip, and per-player panels with
  the ban chip, 3 picks and the 3 bosses with that player's ticks. Text title (like WW screens).
- **Bracket (`holo-bracket.html`):** the WW bracket page with Hologram mode (reuses `bracket.js` /
  `bracket.css`); live panel shows "Rolling bosses" before the roll, otherwise as WW; result scores
  are points.

### Hologram backend
`apps-script-hologram/Code.gs` (copy of the WW `Code.gs` with the Hologram FORMAT, 3 point slots,
`bosses` stored in Meta and the `setBosses` op) + `BracketCore.gs` (identical copy). The organizer
creates a new Google Sheet, pastes both files via Extensions → Apps Script, runs `setup`, deploys
(Execute as: Me, Anyone), and sends the URL to put in `HOLO_API_URL`. Keys are separate (that
Sheet's Meta tab).

### Testing
Node rule tests for `holo-core.js` (format order, ban rules, boss rules, points); full demo-mode
run in the browser (roll → toss → draft → points → confirm → bracket) on all Hologram pages at
1920×1080; WW pages re-checked unchanged (overlays, control page at `wastes.html`, old
`index.html?admin=…` link forwarding).

## Left to the builder
Exact pixel layout of the Hologram overlays within the existing style; copy wording; README section.
