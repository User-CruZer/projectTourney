/* Small helpers shared by the Hologram overlays (holo-overlay.html, holo-screens.html). */
(function (global) {
  const { esc, initials } = HW;

  /** Points of one player: number of ticked boss boxes. */
  const points = (s, t) => ((s.scores && s.scores[t]) || []).filter((v) => String(v) === '1').length;

  /**
   * Three point boxes (gold when ticked) + total, for a name plate.
   * fresh: boss indexes this player was just given a point for (they burst, the total bumps, "+1" floats up).
   */
  function pointBoxes(s, t, fresh) {
    const sc = (s.scores && s.scores[t]) || [];
    const isNew = (i) => (fresh || []).indexOf(i) >= 0;
    const gained = (fresh || []).length > 0;
    return `<div class="boxes">${[0, 1, 2].map((i) => `<i class="${String(sc[i]) === '1' ? 'on' : ''}${isNew(i) ? ' new' : ''}"></i>`).join('')}</div>` +
      `<div class="ptotal${gained ? ' bump' : ''}"><span>Points</span><b>${points(s, t)}</b></div>` +
      (gained ? `<span class="plus1">+${fresh.length}</span>` : '');
  }

  /**
   * Points given since the previous state: { A: [boss indexes], B: [...] }.
   * Empty on the first state (page load) and for points taken away.
   */
  function gainedPoints(prev, next) {
    const out = { A: [], B: [] };
    if (!prev) return out;
    ['A', 'B'].forEach((t) => [0, 1, 2].forEach((i) => {
      const was = String(((prev || {})[t] || [])[i]) === '1';
      const now = String(((next || {})[t] || [])[i]) === '1';
      if (now && !was) out[t].push(i);
    }));
    return out;
  }

  /** Portrait from img/resonator-img (see js/common.js), or coloured initials if there is none. */
  const mono = (name) => {
    const url = HW.portrait(name);
    return url ? `<img src="${esc(url)}" alt="">` : esc(initials(name));
  };

  /** Sequence indexes of a player's 3 picks (always 3 slots; -1 before the coin toss). */
  function pickSlots(s, team) {
    const out = [];
    s.sequence.forEach((x, i) => { if (x.team === team && x.type === 'pick') out.push(i); });
    while (out.length < 3) out.push(-1);
    return out;
  }

  global.HoloView = { points, pointBoxes, gainedPoints, mono, pickSlots };
})(window);
