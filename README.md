# projectTourney: HoloWastes Pick & Ban
Tournament helper for Wuthering Waves: live pick & ban systems with 16:9 stream overlays, for two tournaments.

- **`index.html`**: start page. Choose **Hologram** or **Whimpering Wastes**, then enter the organizer code (that tournament's admin key, checked against its own Sheet) or **Continue as guest** (view only). Captains use the links they were sent. Old links like `index.html?admin=…` or `?team=…&key=…` are forwarded to the Whimpering Wastes control page automatically.
- **Whimpering Wastes:** control page `wastes.html`, overlays `overlay.html`, `screens.html`, `bracket.html` (this README up to "Hologram" describes it).
- **Hologram:** control page `hologram.html`, overlays `holo-overlay.html`, `holo-screens.html`, `holo-bracket.html`, with its own Google Sheet (see [Hologram](#hologram)).
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

## Access (keys)
**Keys are on** (`REQUIRE_KEYS = true` in `apps-script/Code.gs`, live since Apps Script version 9). Changing anything needs a key; watching doesn't.

| Link | Can do |
|---|---|
| `index.html?admin=<ADMIN_KEY>` | Everything: coin toss, picks for both sides, scores, perma bans, undo/reset, bracket |
| `index.html?team=A&key=<TEAM_A_KEY>` / `?team=B&key=<TEAM_B_KEY>` | That side's bans and picks, only on their turn |
| `index.html` (no key) | View only |
| `overlay.html`, `screens.html`, `bracket.html` | Display only, no key needed (OBS / TikTok) |

How to get in:
1. Open the Google Sheet → **Meta** tab → copy the value next to `ADMIN_KEY`.
2. Open `https://<your site>/index.html?admin=<that value>` and bookmark it. The badge shows **Admin**.
3. In the admin panel's **Links** section, copy the **Captain A** / **Captain B** links (keys already filled in) and send them to the top / bottom player of the match.

Keep the admin link and the Sheet private (Sheet sharing: **Restricted**). The captain keys belong to the sides, not to people, so the same links work for every match. To stop old links working, delete `TEAM_A_KEY` / `TEAM_B_KEY` (or `ADMIN_KEY`) in **Apps Script → Project Settings → Script Properties**, run `setup` once, and copy the new values from the Meta tab.

To go back to open access for testing: set `REQUIRE_KEYS = false` and deploy a new version.

## Links

| Link | For |
|---|---|
| `overlay.html` | Draft overlay: OBS / TikTok Live Studio browser source (1920×1080) |
| `screens.html` | Gameplay overlay with two screen-share windows (see below) |
| `wastes.html?admin=<ADMIN_KEY>` | Organizer: coin toss, scores, perma bans, undo/reset; can act for either player |
| `wastes.html?team=A&key=…` / `?team=B&key=…` | Each player: ban/pick on their own turn only |

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
  These scenes also have a **chat box** between the two team panels: **X 770, Y 718, Width 380, Height 338**, with a dark gradient background. Put your chat source there, **above** the overlay in the source list. Add `&chat=0` to drop it and use the full-width team panels.
- `?guides=1`: fill the windows with striped guides while you line the captures up.
- `?bg=0`: no background (fully transparent apart from the panels).

### Bracket (`bracket.html`)
This is a 16-player single-elimination bracket (Penyisihan → Perempat Final → Semifinal → Final → Juara) that fills itself in as results are confirmed. Add it in OBS as a Browser source at 1920×1080.

The right-hand column shows where the tournament is right now:
- **Live now:** the loaded match (round and match number, both players and their totals) and what is happening in it: coin toss, who is banning or picking (with a step counter and progress bar), who leads once the scores are in, and finally "X wins · advances to …". The panel flashes briefly whenever this changes.
- **Up next:** the next matches that are ready to play.
- **Break timer:** on the control page, admin panel → **Break timer**. Click **3 / 5 / 10 min**, or type your own time (`7` = 7 minutes, `2.5`, or `4:30`) and press **Start**. An optional label (for example "Ishoma") replaces the word "Break". While it runs, the Live now panel shows a big countdown and the next match. **+1 min** extends it and **Stop** ends it. When time is up it shows "Starting soon" for one minute, then goes back to the normal panel by itself.
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

## Hologram
A second tournament with its own players, bracket, match and Google Sheet. Same look, keys, coin toss, break timer and bracket as Whimpering Wastes.

**Match format**
1. **Bosses:** on `hologram.html`, admin panel → **Bosses** → **Roll bosses**. 3 different bosses are drawn at random from `HOLO_BOSSES` in `js/config.js`. **Re-roll** (tap twice) or **Pick by hand** until the draft starts. The coin toss stays locked until the bosses are rolled. Boss pictures live in `img/boss-img/`, named after the boss (lower case, dashes for spaces: "The False Sovereign" → `the-false-sovereign.webp`); a boss with no picture shows just its name. When the bosses are rolled, the overlays and the control page roll like casino reels: they slow down, boss 1, 2 and 3 stop one after another with a bounce and a gold glow, and the last reel pulses while it is the only one left (about 5.5 seconds; timings in `bossSpinner` in `js/common.js`, look in `css/reels.css`).
2. **Coin toss**, then the draft: one team of 3 each, 1 ban each: winner picks, other picks, winner bans, other bans, then picks alternate until both have 3. Same rules as Whimpering Wastes (a ban only blocks the opponent, mirror picks allowed, perma bans block everyone).
3. **Points:** admin panel → **Points**. One tick box per boss for each player; tick who earned that boss's point (saved immediately). Both or neither may get a boss's point.
4. **Winner:** more points. **Confirm winner** in the Bracket card advances them; a tie is settled with the "[Name] wins" button.

**Players:** the bracket starts with `HOLO_PLAYERS` from `js/config.js` (in demo mode; on the live Sheet enter them once under Bracket → Players and save). **WILD CARD** marks an open slot: type a late entrant's name over it, or give the opponent a bye with "[Name] wins".

**Links**
| Link | For |
|---|---|
| `holo-overlay.html` | Draft overlay (1920×1080): logo, points, the 3 bosses, both teams |
| `holo-screens.html` | Gameplay overlay: two screen windows the same size as `screens.html` but lower (924×520 at x 24 / x 972, y 180; the 3 bosses sit under the names, coloured by who took each point) |
| `holo-bracket.html` | Bracket with live panel, up next and break timer |
| `hologram.html?admin=<ADMIN_KEY>` | Hologram organizer (its own key, from the Hologram Sheet's Meta tab) |
| `hologram.html?team=A&key=…` / `?team=B&key=…` | Hologram captain links (listed in the admin panel) |

**Setting up the Hologram Google Sheet (once, from your own Google account)**
1. Create a new Google Sheet, for example "Project Tourney Hologram".
2. **Extensions → Apps Script**. Replace the code in `Code.gs` with [`apps-script-hologram/Code.gs`](apps-script-hologram/Code.gs). Add a file **BracketCore** (**+ → Script**) and paste [`apps-script-hologram/BracketCore.gs`](apps-script-hologram/BracketCore.gs). Save.
3. Choose **`setup`** in the function list → **Run** → allow access (Advanced → Go to project → Allow).
4. **Deploy → New deployment →** gear → **Web app**. Execute as **Me**, who has access **Anyone** → **Deploy**. Copy the URL ending in `/exec`.
5. Paste it into `HOLO_API_URL` at the top of `js/config.js`, bump the `?v=` tag, and push.
6. Open `hologram.html?admin=<ADMIN_KEY from the new Sheet's Meta tab>`, enter the players under Bracket → Players, and save.

Until `HOLO_API_URL` is set, the Hologram pages run in demo mode (red banner, data only in this browser).

## Try it without Google
Add `local=1` to any URL (for example `wastes.html?admin=1&local=1` and `overlay.html?local=1`, or `hologram.html?admin=1&local=1` and `holo-overlay.html?local=1`). Hologram and Whimpering Wastes keep separate demo data. The pages then sync only between tabs of one browser.

## Google Sheets backend

1. In the Sheet: **Extensions → Apps Script**, then paste [`apps-script/Code.gs`](apps-script/Code.gs) and save.
2. Run `setup` once and authorize it. It only gets access to this one spreadsheet (`@OnlyCurrentDoc`).
3. **Deploy → New deployment → Web app**, Execute as **Me**, access **Anyone**, then put the `/exec` URL into `API_URL` in `js/config.js`.

After editing `Code.gs`, go to **Deploy → Manage deployments → Edit → Version: New version → Deploy**. The URL stays the same, but the new code can take about a minute to go live.

## Deploy to GitHub Pages
Push to GitHub, then go to **Settings → Pages → Deploy from a branch → `main` / root**.

## After changing CSS or JS files
The HTML pages load every CSS/JS file with a version tag (`?v=20261127z`) so browsers and OBS don't mix old cached files with new ones. If you change any file in `css/` or `js/`, change the tag in every `.html` page to a new value, for example `?v=20261127z`. If a page ever looks unstyled or empty, press **Ctrl+Shift+R**, or **Refresh** the source in OBS.

## Customizing
- Title, roster and elements: `js/config.js`.
- Logo: `img/logo.png` (transparent PNG) replaces the title text on the draft overlay, bracket overlay and control page (the screens overlay keeps the text title, as the logo would be too small there), set by `LOGO` in `js/config.js`. To change it, replace that file (keep the transparent background) and bump the `?v=` tag; remove the `LOGO` line to show the `TITLE` text instead.
- Portraits: put one picture per resonator in `img/resonator-img/`, named as listed in [`img/resonator-img/README.md`](img/resonator-img/README.md) (for example `rover-spectro.webp`; `.webp`, `.png` or `.jpg`). They're picked up automatically on the overlays and the control page; resonators without a picture keep their coloured initials.
- Turn timer: `TURN_SECONDS` in `js/config.js` (display only; `0` hides it).
- Look: "Noir minimal" (black and white with a gold accent, Inter font).
  - Colours: `THEME` in `js/config.js` sets the Player A, Player B, ban and champion/accent colours for every page.
  - The base colours and font are in `css/theme.css`. Each page's layout and sizes are in its own CSS file (`overlay.css`, `screens.css`, `bracket.css`, `style.css`).
