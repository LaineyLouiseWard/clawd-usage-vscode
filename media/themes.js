// Themes from Pinch's art/Themes.kt (MIT, see LICENSE-pinch): a card colour, the scene Clawd walks
// on, the outfit he wears when the outfit is "auto", and a wallpaper pattern.
'use strict';
(function (CU) {
  const T = (id, name, bg, scene, skin, pattern = null) => ({ id, name, bg, scene, skin, pattern });
  const ALL = [
    T('classic', 'Classic (beach)', '#1A1A1E', 'beach', 'classic'),
    T('oled', 'OLED black', '#000000', 'oled', 'classic'),
    T('midnight', 'Midnight', '#0F172A', 'midnight', 'classic'),
    T('halloween', 'Halloween', '#1C1326', 'halloween', 'witch', 'halloween'),
    T('christmas', 'Christmas', '#0E1A2B', 'christmas', 'santa', 'christmas'),
    T('valentine', 'Valentine', '#24101C', 'valentine', 'bow', 'valentine'),
    T('spring', 'Spring', '#121A14', 'spring', 'flowershorts', 'spring'),
    T('summer', 'Summer', '#0B1E2B', 'summer', 'shades', 'summer'),
    T('space', 'Space', '#0E0820', 'space', 'astronaut', 'space'),
    T('ocean', 'Underwater', '#0A2236', 'ocean', 'squarepants', 'ocean'),
    T('cyberpunk', 'Cyberpunk', '#0C0B16', 'cyberpunk', 'netrunner', 'cyberpunk'),
  ];

  // Spooky in October, festive in December, and so on.
  function seasonal(d = new Date()) {
    const md = (d.getMonth() + 1) * 100 + d.getDate();
    if (md >= 1001 && md <= 1101) return 'halloween';
    if (md >= 1201 || md <= 106) return 'christmas';
    if (md >= 207 && md <= 215) return 'valentine';
    if (md >= 320 && md <= 531) return 'spring';
    if (md >= 601 && md <= 831) return 'summer';
    return 'classic';
  }

  const resolve = (choice) => ALL.find((t) => t.id === (choice === 'auto' ? seasonal() : choice)) || ALL[0];

  CU.themes = { ALL, seasonal, resolve };
})(typeof window !== 'undefined' ? (window.CU = window.CU || {}) : module.exports); // the extension reads it too
