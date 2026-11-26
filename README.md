# projectTourney: HoloWastes Pick & Ban
Tournament helper for Wuthering Waves: a live pick & ban system with a 16:9 stream overlay.

- **`overlay.html`**: 1920×1080 overlay with a transparent background, for OBS or TikTok Live Studio. Display only.
- **`index.html`**: the control page, where the admin and captains run the coin toss, bans, picks and scores.
- The live state lives in a **Google Sheet**, accessed through a Google Apps Script web app. Every page polls it about every 2 seconds.

## Match format

1. **Coin toss**: the admin flips the coin and the winner bans and picks first. The overlay plays the toss animation.
2. **Bans**: 1 ban per player (winner first). A banned resonator can't be picked by anyone.
3. **Stage 1**: 3 picks each, alternating, with the toss winner picking first.
4. **Stage 2**: 3 picks each, alternating, with the other player picking first.
5. **Scores**: the admin enters each player's score per stage. The overlay shows the totals.

**Perma bans** are set by the admin. Those resonators can't be banned or picked.
To change the order, edit `FORMAT` in `js/draft-core.js` **and** in `apps-script/Code.gs`.

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
The background is transparent. Add `?bg=1` to the URL to get a solid background instead.

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
- `?bg=1`: solid background for previewing.

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
The HTML pages load every CSS/JS file with a version tag (`?v=20261126b`) so browsers and OBS don't mix old cached files with new ones. If you change any file in `css/` or `js/`, change the tag in `index.html`, `overlay.html` and `screens.html` to a new value, for example `?v=20261127a`. If a page ever looks unstyled or empty, press **Ctrl+Shift+R**, or **Refresh** the source in OBS.

## Customizing
- Title, roster, elements and portraits: `js/config.js` (add `img: 'assets/…png'` to show a portrait instead of initials).
- Turn timer: `TURN_SECONDS` in `js/config.js` (display only; `0` hides it).
