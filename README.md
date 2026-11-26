# projectTourney: HoloWastes Pick & Ban
Tournament helper for Wuthering Waves: a live pick & ban system with a 16:9 stream overlay.

- **`overlay.html`**: 1920×1080 overlay for OBS or TikTok Live Studio. Display only.
- **`index.html`**: the control page, where the admin and captains run the coin toss, bans, picks and scores.
- The live state lives in a **Google Sheet**, accessed through a Google Apps Script web app. Every page polls it about every 2 seconds.

## Match format

1. **Coin toss**: the admin flips the coin. The winner goes first in each phase below, and the overlay plays the toss animation.
2. **First picks**: each player picks their first Stage 1 resonator, the toss winner first.
3. **Bans**: 1 ban each, the toss winner first.
   - A ban only blocks the **opponent**; the player who banned it can still pick it.
   - You can't ban a resonator your opponent has already picked.
4. **Rest of Stage 1**: 2 more picks each, alternating, the toss winner first (3 Stage 1 picks each in total).
5. **Stage 2**: 3 picks each, alternating, with the other player picking first.
6. **Scores**: the admin enters each player's score per stage. The overlay shows the totals.

Both players may pick the same resonator (mirror picks), but nobody can pick the same one twice.
**Perma bans** are set by the admin. Those resonators can't be banned or picked by anyone.
To change the order, edit `FORMAT` in `js/draft-core.js` **and** in `apps-script/Code.gs`.

## Access (testing vs tournament)
Right now **open access is on** (`REQUIRE_KEYS = false` in `apps-script/Code.gs`). Anyone with the control page link can do everything (draft, scores, bracket) without a key, and the badge shows "Admin · open access".

**Before the real tournament**, set `REQUIRE_KEYS = true` in the Apps Script and deploy a new version. The keys below are then required again. This matters because the Apps Script URL is visible in `js/config.js`, so anyone could otherwise change your data.

## Links

| Link | For |
|---|---|
| `overlay.html` | Draft overlay: OBS / TikTok Live Studio browser source (1920×1080) |
| `screens.html` | Gameplay overlay with two screen-share windows (see below) |
| `index.html?admin=<ADMIN_KEY>` | Organizer: coin toss, scores, perma bans, undo/reset; can act for either player |
| `index.html?team=A&key=…` / `?team=B&key=…` | Each player: ban/pick on their own turn only |

The admin panel lists the overlay and captain links, each with a copy button. `ADMIN_KEY` is in the Sheet's `Meta` tab.

### Adding the overlay to OBS
Sources → **+** → **Browser** → URL = your `…/overlay.html`, Width **1920**, Height **1080**.
Every overlay has a dark background: grey in the middle fading to black at the edges (on the screens overlay the two screen-share windows stay see-through). Add `?bg=0` to the URL for a fully transparent overlay instead, for example to put it over your own background image in OBS.

### Screen-share overlay (`screens.html`)
This overlay is for the gameplay part, with both players' shared screens side by side. It has two transparent 16:9 windows, with name plates and total scores above them and each player's ban, picks and stage scores below.

In OBS, add the browser source **above** the two screen captures and set its **Width 1920 and Height 1080** in Properties. OBS defaults new Browser sources to 800×600, which leaves empty bars around the overlay. Then size and position each capture to fill its window:

| Window | X | Y | Width | Height |
|---|---|---|---|---|
| Player A (left) | 24 | 128 | 924 | 520 |
| Player B (right) | 972 | 128 | 924 | 520 |

Tip: in OBS, open a capture's **Edit Transform** (Ctrl+E) and type the numbers in. URL options:
- `?stage=1` / `?stage=2`: show only that stage's team, larger. Handy as one OBS scene per stage.
- `?guides=1`: fill the windows with striped guides while you line the captures up.
- `?bg=0`: no background (fully transparent apart from the panels).

### Bracket (`bracket.html`)
This is a 16-player single-elimination bracket (Penyisihan → Perempat Final → Semifinal → Final → Juara) that fills itself in as results are confirmed. Add it in OBS as a Browser source at 1920×1080.

The right-hand column shows where the tournament is right now:
- **Live now:** the loaded match (round and match number, both players and their totals) and what is happening in it: coin toss, who is banning or picking (with a step counter and progress bar), who leads once the scores are in, and finally "X wins · advances to …". The panel flashes briefly whenever this changes.
- **Up next:** the next matches that are ready to play.
- Add `?live=0` to the URL to hide both.

On the admin control page, under **Bracket**:
1. **Players (16):** enter the names in bracket order (1 vs 2, 3 vs 4, …). You can fix them at any time; results follow the slot, so a typo fix updates every round.
2. **Load into draft:** pick a match and load it. The two names go into the draft and the coin toss, picks and scores reset.
3. Play the match and save both stage scores.
4. **Confirm winner:** the higher total advances. The button names the winner, and you tap it twice to confirm.

Fixing mistakes:
- **"[Name] wins":** set any match's winner manually, for ties or corrections. If this changes a winner, later results that depended on it are cleared.
- **Clear result:** remove a match's result, along with any later results that depended on it.
- **Undo last bracket change:** step back through bracket changes. Every change is saved as a snapshot in the Sheet's **BracketLog** tab.
- **Reset bracket:** clear all results and keep the players.
- The Sheet's **Bracket** tab always shows the current bracket in plain rows (view only).

`apps-script/BracketCore.gs` is a copy of `js/bracket-core.js`. Both the website and the Apps Script use it, so if you edit one, paste it into the Apps Script `BracketCore.gs` file as well and deploy a new version.

### TikTok Live Studio
Add a **Link** (web) source with the overlay URL and size it to fill the 16:9 canvas.

## Try it without Google
Add `local=1` to any URL (for example `index.html?admin=1&local=1` and `overlay.html?local=1`). The pages then sync only between tabs of one browser.

## Google Sheets backend

1. In the Sheet: **Extensions → Apps Script**, then paste [`apps-script/Code.gs`](apps-script/Code.gs) and save.
2. Run `setup` once and authorize it. It only gets access to this one spreadsheet (`@OnlyCurrentDoc`).
3. **Deploy → New deployment → Web app**, Execute as **Me**, access **Anyone**, then put the `/exec` URL into `API_URL` in `js/config.js`.

After editing `Code.gs`, go to **Deploy → Manage deployments → Edit → Version: New version → Deploy**. The URL stays the same, but the new code can take about a minute to go live.

## Deploy to GitHub Pages
Push to GitHub, then go to **Settings → Pages → Deploy from a branch → `main` / root**.

## After changing CSS or JS files
The HTML pages load every CSS/JS file with a version tag (`?v=20261127k`) so browsers and OBS don't mix old cached files with new ones. If you change any file in `css/` or `js/`, change the tag in `index.html`, `overlay.html` and `screens.html` to a new value, for example `?v=20261127k`. If a page ever looks unstyled or empty, press **Ctrl+Shift+R**, or **Refresh** the source in OBS.

## Customizing
- Title, roster and elements: `js/config.js`.
- Portraits: put one picture per resonator in `img/resonator-img/`, named as listed in [`img/resonator-img/README.md`](img/resonator-img/README.md) (for example `rover-spectro.webp`; `.webp`, `.png` or `.jpg`). They're picked up automatically on the overlays and the control page; resonators without a picture keep their coloured initials.
- Turn timer: `TURN_SECONDS` in `js/config.js` (display only; `0` hides it).
- Look: "Noir minimal" (black and white with a gold accent, Inter font).
  - Colours: `THEME` in `js/config.js` sets the Player A, Player B, ban and champion/accent colours for every page.
  - The base colours and font are in `css/theme.css`. Each page's layout and sizes are in its own CSS file (`overlay.css`, `screens.css`, `bracket.css`, `style.css`).
