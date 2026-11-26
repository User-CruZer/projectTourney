/*
 * Code prompt, shared by the start page (index.html) and the control pages' top switch:
 * opening a tournament asks for its organizer code, or lets you in as a guest (view only).
 *   HWGate.open('hologram.html' | 'wastes.html')
 * Each tournament has its own Google Sheet, so its own codes; a code is checked against that Sheet.
 * Needs js/config.js and css/gate.css.
 */
(function () {
  const cfg = window.TOURNEY_CONFIG || {};
  const local = new URLSearchParams(location.search).get('local') === '1';   // demo: no Sheet to check
  const API = { 'hologram.html': cfg.HOLO_API_URL, 'wastes.html': cfg.WW_API_URL };
  const INFO = {
    'hologram.html': { name: 'Hologram', kicker: 'Tactical Hologram' },
    'wastes.html': { name: 'Whimpering Wastes', kicker: 'Pick & ban' },
  };
  const $ = (id) => document.getElementById(id);

  if (!$('gate')) {
    document.body.insertAdjacentHTML('beforeend', `
  <dialog id="gate" class="gate">
    <form id="gate-form" method="dialog" autocomplete="off">
      <span class="kicker" id="gate-kicker">Tournament</span>
      <h2 id="gate-title">—</h2>
      <label for="gate-code">Organizer code</label>
      <input id="gate-code" type="password" placeholder="Enter code" spellcheck="false" autocapitalize="off" />
      <p class="gate-msg" id="gate-msg" role="alert"></p>
      <button type="submit" class="gate-enter" id="gate-enter">Enter</button>
      <div class="gate-or"><span>or</span></div>
      <a class="gate-guest" id="gate-guest" href="#">Continue as guest <small>view only</small></a>
      <button type="button" class="gate-close" id="gate-close" aria-label="Close">&times;</button>
    </form>
  </dialog>`);
  }
  const gate = $('gate'), code = $('gate-code'), msg = $('gate-msg'), enter = $('gate-enter');
  const supported = typeof gate.showModal === 'function';   // very old browsers: links just open as guest
  let page = null;
  const say = (text) => { msg.textContent = text; };
  const demo = local ? '&local=1' : '';

  /** Opens the prompt for a tournament page. Returns false if the browser can't show it (follow the link instead). */
  function open(target) {
    if (!supported || !INFO[target]) return false;
    page = target;
    $('gate-kicker').textContent = INFO[page].kicker;
    $('gate-title').textContent = INFO[page].name;
    $('gate-guest').href = page + (local ? '?local=1' : '');
    code.value = ''; say(''); enter.disabled = false; enter.textContent = 'Enter';
    gate.showModal();
    code.focus();
    return true;
  }

  $('gate-close').addEventListener('click', () => gate.close());
  gate.addEventListener('click', (e) => { if (e.target === gate) gate.close(); });   // click outside the box

  // Asks the tournament's server whether the code is the organizer (admin) code.
  // 'keys' is an admin-only request, so it answers ok only for the admin code.
  async function isAdminCode(url, key) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },   // no CORS preflight (Apps Script can't answer one)
      body: JSON.stringify({ op: 'keys', key }),
    });
    const data = await res.json();
    return !!data.ok;
  }

  $('gate-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const key = code.value.trim();
    if (!key) { say('Enter your code, or continue as a guest.'); code.focus(); return; }
    const url = local ? '' : API[page];
    const go = () => location.assign(page + '?admin=' + encodeURIComponent(key) + demo);
    if (!url) return go();                       // demo, or no Sheet set up yet: nothing to check against
    enter.disabled = true; enter.textContent = 'Checking…'; say('');
    try {
      if (await isAdminCode(url, key)) return go();
      say('Wrong code. Check it and try again.');
    } catch (err) {
      say('Could not reach the server. Check your connection and try again.');
    }
    enter.disabled = false; enter.textContent = 'Enter';
    code.select();
  });

  window.HWGate = { open };
})();
