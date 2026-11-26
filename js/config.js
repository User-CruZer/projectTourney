/*
 * Tournament configuration — edit this file.
 */
window.TOURNEY_CONFIG = {
  TITLE: 'HoloWastes',
  // Logo shown instead of the title text on every page. Remove this line to show TITLE as text.
  LOGO: 'img/logo.png',

  // Colours of the overlays and control page (hex). Leave a value out to use the default.
  THEME: {
    playerA: '#f2f2f2',   // white
    playerB: '#9fb4c9',   // steel blue
    ban: '#e5484d',       // red
    champion: '#e8c547',  // gold (also the accent colour)
  },

  // Paste your Google Apps Script Web App URL here (ends with /exec).
  // Leave empty to run in LOCAL DEMO MODE (syncs only between tabs of one browser).
  API_URL: new URLSearchParams(location.search).get('local') === '1' ? '' :
    'https://script.google.com/macros/s/AKfycbzyAhdNhqwz0Pqp0Ra0G20Dc8zOJemlcvkid81ABQAXKr-ZkGEnE8_rC1ze8ZzFI54mOw/exec',

  // Column titles on the bracket overlay (round of 16, quarterfinal, semifinal, final, champion).
  ROUND_NAMES: ['Penyisihan', 'Perempat Final', 'Semifinal', 'Final', 'Juara'],

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

  // Character roster, grouped by element (as of Version 3.8: Lily, plus Yangyang: Xuanling from Phase 2).
  // Add newer resonators at the end of their element group as they release.
  // Optional: img: 'assets/chars/jiyan.png' to show a portrait instead of initials.
  ROSTER: [
    { name: 'Rover (Spectro)', element: 'Spectro' },
    { name: 'Verina', element: 'Spectro' },
    { name: 'Jinhsi', element: 'Spectro' },
    { name: 'Shorekeeper', element: 'Spectro' },
    { name: 'Phoebe', element: 'Spectro' },
    { name: 'Zani', element: 'Spectro' },
    { name: 'Lynae', element: 'Spectro' },
    { name: 'Luuk Herssen', element: 'Spectro' },
    { name: 'Lucy', element: 'Spectro' },
    { name: 'Lily', element: 'Spectro' },

    { name: 'Rover (Havoc)', element: 'Havoc' },
    { name: 'Danjin', element: 'Havoc' },
    { name: 'Taoqi', element: 'Havoc' },
    { name: 'Camellya', element: 'Havoc' },
    { name: 'Roccia', element: 'Havoc' },
    { name: 'Cantarella', element: 'Havoc' },
    { name: 'Phrolova', element: 'Havoc' },
    { name: 'Chisa', element: 'Havoc' },
    { name: 'Yangyang: Xuanling', element: 'Havoc' },

    { name: 'Rover (Aero)', element: 'Aero' },
    { name: 'Jianxin', element: 'Aero' },
    { name: 'Yangyang', element: 'Aero' },
    { name: 'Aalto', element: 'Aero' },
    { name: 'Jiyan', element: 'Aero' },
    { name: 'Ciaccona', element: 'Aero' },
    { name: 'Cartethyia', element: 'Aero' },
    { name: 'Iuno', element: 'Aero' },
    { name: 'Qiuyuan', element: 'Aero' },
    { name: 'Sigrika', element: 'Aero' },
    { name: 'Qingxiao', element: 'Aero' },

    { name: 'Rover (Electro)', element: 'Electro' },
    { name: 'Calcharo', element: 'Electro' },
    { name: 'Yinlin', element: 'Electro' },
    { name: 'Yuanwu', element: 'Electro' },
    { name: 'Xiangli Yao', element: 'Electro' },
    { name: 'Lumi', element: 'Electro' },
    { name: 'Augusta', element: 'Electro' },
    { name: 'Buling', element: 'Electro' },
    { name: 'Rebecca', element: 'Electro' },
    { name: 'Hsin', element: 'Electro' },
    { name: 'Suoming', element: 'Electro' },

    { name: 'Chixia', element: 'Fusion' },
    { name: 'Encore', element: 'Fusion' },
    { name: 'Mortefi', element: 'Fusion' },
    { name: 'Changli', element: 'Fusion' },
    { name: 'Brant', element: 'Fusion' },
    { name: 'Lupa', element: 'Fusion' },
    { name: 'Galbrena', element: 'Fusion' },
    { name: 'Mornye', element: 'Fusion' },
    { name: 'Aemeath', element: 'Fusion' },
    { name: 'Denia', element: 'Fusion' },
    { name: 'Jingran', element: 'Fusion' },

    { name: 'Baizhi', element: 'Glacio' },
    { name: 'Sanhua', element: 'Glacio' },
    { name: 'Lingyang', element: 'Glacio' },
    { name: 'Zhezhi', element: 'Glacio' },
    { name: 'Youhu', element: 'Glacio' },
    { name: 'Carlotta', element: 'Glacio' },
    { name: 'Hiyuki', element: 'Glacio' },
    { name: 'Lucilla', element: 'Glacio' },
    { name: 'Suisui', element: 'Glacio' },
  ],
};
