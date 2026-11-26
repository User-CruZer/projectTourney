/* Small helpers shared by the overlay and the control page. */
(function (global) {
  const cfg = global.TOURNEY_CONFIG;
  const byName = Object.fromEntries(cfg.ROSTER.map((c) => [c.name, c]));

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const initials = (name) => String(name).replace(/\(.*?\)/g, '').trim()
    .split(/\s+/).map((w) => w[0] || '').join('').slice(0, 2).toUpperCase();

  const element = (name) => (byName[name] || {}).element || '';
  const elColor = (name) => cfg.ELEMENTS[element(name)] || '#8a93ad';

  /** Sum of numeric stage scores, or '' if any entered score isn't a number. */
  function scoreTotal(arr) {
    const vals = (arr || []).filter((v) => String(v).trim() !== '');
    if (!vals.length) return '';
    let sum = 0;
    for (const v of vals) {
      const n = Number(String(v).replace(/[,\s]/g, ''));
      if (!isFinite(n)) return '';
      sum += n;
    }
    return sum.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }

  /** Remaining turn time as "m:ss", or '' when the timer is off / not running. */
  function timerText(state, clockOffset) {
    if (!state || !cfg.TURN_SECONDS || !state.firstTeam || !DraftCore.currentStep(state)) return { text: '', low: false };
    const elapsed = (Date.now() + clockOffset - state.turnStartedAt) / 1000;
    const left = Math.max(0, Math.ceil(cfg.TURN_SECONDS - elapsed));
    return { text: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`, low: left <= 10 };
  }

  global.HW = { cfg, byName, esc, initials, element, elColor, scoreTotal, timerText };
})(window);
