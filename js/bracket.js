(function () {
  const { cfg, esc, scoreTotal, fitText } = HW;
  const B = BracketCore;
  const backend = createBackend(cfg);
  const $ = (id) => document.getElementById(id);

  if (new URLSearchParams(location.search).get('bg') === '1') document.body.classList.add('bg');
  $('title').textContent = cfg.TITLE || 'Pick & Ban';
  document.title = 'Bracket — ' + (cfg.TITLE || 'Pick & Ban');
  HW.fitCanvas($('stage'));

  const ROUND_NAMES = cfg.ROUND_NAMES || ['Round of 16', 'Quarterfinal', 'Semifinal', 'Final', 'Champion'];

  // ----- geometry on the 1920x1080 canvas (5 columns: 16, 8, 4, 2, 1 boxes)
  const LEFT = 64, W = 280, GAP = 98, TOP = 160, H = 42, CHAMP_H = 76;
  const colX = (c) => LEFT + c * (W + GAP);
  const centers = [[]];
  for (let j = 0; j < 16; j++) centers[0].push(TOP + j * 50 + Math.floor(j / 2) * 12 + H / 2);
  for (let c = 1; c <= 4; c++) {
    centers[c] = [];
    for (let j = 0; j < centers[c - 1].length / 2; j++) centers[c].push((centers[c - 1][2 * j] + centers[c - 1][2 * j + 1]) / 2);
  }

  /** Display info for box j in column c (c = 4 is the champion). */
  function boxInfo(b, c, j) {
    if (c === 4) {
      const champ = B.champion(b);
      return { name: champ, cls: 'champ' + (champ ? ' win' : ' empty') };
    }
    const name = c === 0 ? (b.players[j] || '') : B.winner(b, c - 1, j);
    const matchId = B.mid(c, Math.floor(j / 2));
    const side = j % 2 === 0 ? 'A' : 'B';
    const res = b.results[matchId];
    let cls = name ? '' : 'empty';
    let score = '';
    if (res) {
      cls += res.w === side ? ' win' : ' lose';
      const sc = side === 'A' ? res.sa : res.sb;
      if (sc !== null && sc !== undefined && sc !== '') score = scoreTotal([sc]) || String(sc);
    } else if (b.current === matchId && name) {
      cls += ' live';
    }
    return { name, cls, score, live: !res && b.current === matchId && name && side === 'A' };
  }

  function render(state) {
    const b = state.bracket || B.emptyBracket();
    let html = ROUND_NAMES.map((n, c) => `<div class="col-head" style="left:${colX(c)}px">${esc(n)}</div>`).join('');
    let paths = '';

    for (let c = 0; c <= 4; c++) {
      centers[c].forEach((cy, j) => {
        const info = boxInfo(b, c, j);
        const h = c === 4 ? CHAMP_H : H;
        html += `<div class="box ${info.cls}" style="left:${colX(c)}px;top:${cy - h / 2}px">` +
          (c === 4 && info.name ? '<span class="trophy">🏆</span>' : '') +
          `<span class="nm">${esc(info.name || (c === 4 ? '?' : '—'))}</span>` +
          (info.score ? `<span class="sc">${esc(info.score)}</span>` : '') +
          (info.live ? '<span class="live-tag">LIVE</span>' : '') + '</div>';
      });
    }

    // connectors: each pair of boxes in column c joins into one box in column c+1
    for (let c = 0; c < 4; c++) {
      for (let m = 0; m < centers[c].length / 2; m++) {
        const x1 = colX(c) + W, xm = x1 + GAP / 2, x2 = colX(c + 1);
        const yA = centers[c][2 * m], yB = centers[c][2 * m + 1], yT = centers[c + 1][m];
        const res = b.results[B.mid(c, m)];
        const cls = (side) => (res && res.w === side ? 'won' : '') + (c === 3 ? ' final' : '');
        const pathA = `<path class="${cls('A')}" d="M${x1} ${yA} H${xm} V${yT} H${x2}"/>`;
        const pathB = `<path class="${cls('B')}" d="M${x1} ${yB} H${xm} V${yT} H${x2}"/>`;
        paths += res && res.w === 'A' ? pathB + pathA : pathA + pathB;   // winner's line drawn on top
      }
    }

    $('cols').innerHTML = html;
    $('links').innerHTML = paths;
    document.querySelectorAll('.box .nm').forEach((el) => fitText(el, el.closest('.champ') ? 40 : 26, 14));
  }

  let last = null;
  backend.subscribe((s) => { last = s; render(s); });
  if (document.fonts) {
    // Re-fit text once web fonts arrive (also later ones, e.g. the Noir theme font).
    document.fonts.ready.then(() => last && render(last));
    document.fonts.addEventListener("loadingdone", () => last && render(last));
  }
})();
