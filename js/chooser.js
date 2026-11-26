/* Start page (index.html): choosing a tournament asks for the organizer code, or lets you in as a guest. */
(function () {
  const cfg = window.TOURNEY_CONFIG || {};
  // Each tournament has its own Google Sheet, so its own codes.
  const API = { 'hologram.html': cfg.HOLO_API_URL, 'wastes.html': cfg.API_URL };
  const $ = (id) => document.getElementById(id);
  const gate = $('gate'), code = $('gate-code'), msg = $('gate-msg'), enter = $('gate-enter');
  let page = null;

  const say = (text) => { msg.textContent = text; };

  document.querySelectorAll('.choice').forEach((a) => a.addEventListener('click', (e) => {
    if (!gate.showModal) return;                 // very old browser: just follow the link (guest)
    e.preventDefault();
    page = a.dataset.page;
    $('gate-kicker').textContent = a.querySelector('.kicker').textContent;
    $('gate-title').textContent = a.dataset.name;
    $('gate-guest').href = page;
    code.value = ''; say(''); enter.disabled = false; enter.textContent = 'Enter';
    gate.showModal();
    code.focus();
  }));

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
    const url = API[page];
    const go = () => location.assign(page + '?admin=' + encodeURIComponent(key));
    if (!url) return go();                       // no Sheet set up yet (demo): nothing to check against
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
})();
