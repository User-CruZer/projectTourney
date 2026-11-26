// node tests/mode.test.js — mode settings in js/config.js and demo storage keys in js/backend.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.log('FAIL:', m); } };

function loadConfig(mode, search) {
  const ctx = { location: { search: search || '' }, URLSearchParams };
  ctx.window = ctx;
  if (mode) ctx.HW_MODE = mode;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/config.js'), 'utf8'), ctx);
  return ctx.TOURNEY_CONFIG;
}
function loadBackend(cfg) {
  const ctx = { window: null };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'js/backend.js'), 'utf8'), ctx);
  return ctx.createBackend.storageKeys(cfg);
}

const ww = loadConfig();
ok(ww.MODE === 'wastes', 'default mode is wastes');
ok(/^https:\/\/script\.google\.com\/macros\/s\/AKfycbzyAhdNhq/.test(ww.API_URL), 'wastes uses the WW Apps Script URL');
const holo = loadConfig('hologram');
ok(holo.MODE === 'hologram', 'hologram mode');
ok(holo.API_URL === holo.HOLO_API_URL, 'hologram uses HOLO_API_URL');
ok(Array.isArray(holo.HOLO_BOSSES) && holo.HOLO_BOSSES.length === 8, '8 bosses');
ok(holo.HOLO_BOSSES.includes('The False Sovereign') && holo.HOLO_BOSSES.includes('Myriad Snare'), 'boss names');
ok(Array.isArray(holo.HOLO_PLAYERS) && holo.HOLO_PLAYERS.length === 16 && holo.HOLO_PLAYERS[0] === 'MOCHIEL' && holo.HOLO_PLAYERS[4] === 'WILD CARD', '16 players in bracket order');
ok(loadConfig(null, '?local=1').API_URL === '' && loadConfig('hologram', '?local=1').API_URL === '', 'local=1 → demo in both modes');

const kw = loadBackend(ww), kh = loadBackend(holo);
ok(kw.draft === 'projectTourney.draft' && kw.log === 'projectTourney.bracketLog', 'WW demo keys unchanged');
ok(kh.draft === 'projectTourney.hologram.draft' && kh.log === 'projectTourney.hologram.bracketLog', 'hologram demo keys separate');

ok(ww.WW_API_URL === ww.API_URL && holo.WW_API_URL === ww.API_URL, 'both modes know the WW Sheet URL (for the code prompt)');

console.log(fails ? fails + ' failed' : 'all passed');
process.exit(fails ? 1 : 0);
