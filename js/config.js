/*
 * Tournament configuration — edit this file.
 */
window.TOURNEY_CONFIG = {
  TITLE: 'HoloWastes',

  // Paste your Google Apps Script Web App URL here (ends with /exec).
  // Leave empty to run in LOCAL DEMO MODE (syncs only between tabs of one browser).
  API_URL: new URLSearchParams(location.search).get('local') === '1' ? '' :
    'https://script.google.com/macros/s/AKfycbzyAhdNhqwz0Pqp0Ra0G20Dc8zOJemlcvkid81ABQAXKr-ZkGEnE8_rC1ze8ZzFI54mOw/exec',

  // How often each viewer checks the sheet for changes (ms).
  POLL_MS: 2000,

  // Turn timer shown on screen (seconds). Display only; set 0 to hide.
  TURN_SECONDS: 0,

  ELEMENTS: {
    Spectro: '#f2d46b',
    Havoc: '#c94b93',
    Aero: '#4fd8a9',
    Electro: '#a97bff',
    Fusion: '#ff6b3d',
    Glacio: '#62b8ff',
  },

  // Character roster. Add newer resonators here as they release.
  // Optional: img: 'assets/chars/jiyan.png' to show a portrait instead of initials.
  ROSTER: [
    { name: 'Rover (Spectro)', element: 'Spectro' },
    { name: 'Verina', element: 'Spectro' },
    { name: 'Jinhsi', element: 'Spectro' },
    { name: 'Shorekeeper', element: 'Spectro' },
    { name: 'Phoebe', element: 'Spectro' },
    { name: 'Zani', element: 'Spectro' },

    { name: 'Rover (Havoc)', element: 'Havoc' },
    { name: 'Danjin', element: 'Havoc' },
    { name: 'Taoqi', element: 'Havoc' },
    { name: 'Camellya', element: 'Havoc' },
    { name: 'Roccia', element: 'Havoc' },
    { name: 'Cantarella', element: 'Havoc' },
    { name: 'Phrolova', element: 'Havoc' },

    { name: 'Rover (Aero)', element: 'Aero' },
    { name: 'Jianxin', element: 'Aero' },
    { name: 'Yangyang', element: 'Aero' },
    { name: 'Aalto', element: 'Aero' },
    { name: 'Jiyan', element: 'Aero' },
    { name: 'Ciaccona', element: 'Aero' },
    { name: 'Cartethyia', element: 'Aero' },

    { name: 'Calcharo', element: 'Electro' },
    { name: 'Yinlin', element: 'Electro' },
    { name: 'Yuanwu', element: 'Electro' },
    { name: 'Xiangli Yao', element: 'Electro' },
    { name: 'Lumi', element: 'Electro' },
    { name: 'Augusta', element: 'Electro' },

    { name: 'Chixia', element: 'Fusion' },
    { name: 'Encore', element: 'Fusion' },
    { name: 'Mortefi', element: 'Fusion' },
    { name: 'Changli', element: 'Fusion' },
    { name: 'Brant', element: 'Fusion' },
    { name: 'Lupa', element: 'Fusion' },

    { name: 'Baizhi', element: 'Glacio' },
    { name: 'Sanhua', element: 'Glacio' },
    { name: 'Lingyang', element: 'Glacio' },
    { name: 'Zhezhi', element: 'Glacio' },
    { name: 'Youhu', element: 'Glacio' },
    { name: 'Carlotta', element: 'Glacio' },
  ],
};
