(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FilmLife = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const START_AGE = 23, EARLY_RETIREMENT_AGE = 65, RETIREMENT_AGE = 85, MAX_QUARTERS = (RETIREMENT_AGE - START_AGE) * 4;
  const CITIES = [
    { id: 'tel_aviv', title: 'תל אביב', tagline: 'הבית שבו כולם מכירים מישהו', description: 'מחירי הבסיס של המשחק, קשרים מוכרים ומבחר מאוזן של עבודות והפקות.', tier: 0, moveCost: 700, livingMultiplier: 1, workMultiplier: 1, productionMultiplier: 1 },
    { id: 'athens', title: 'אתונה', tagline: 'הפקה קטנה, אור גדול', description: 'הפקות ומחיה זולות יותר במשחק; השכר מעבודות מקומיות נמוך יותר.', tier: 2, moveCost: 900, livingMultiplier: 0.72, workMultiplier: 0.80, productionMultiplier: 0.78 },
    { id: 'berlin', title: 'ברלין', tagline: 'עוד שותף לסרט, עוד שיחה ארוכה', description: 'צילום ועריכה זולים מעט ושוק קופרודוקציות מקומי; המחיה יקרה יותר מתל אביב במשחק.', tier: 2, moveCost: 1400, livingMultiplier: 1.12, workMultiplier: 1, productionMultiplier: 0.90 },
    { id: 'london', title: 'לונדון', tagline: 'תקציב לפרסומת. חשבון על הכל.', description: 'שכר מקומי גבוה יותר והזדמנויות מסחריות, לצד עלויות מחיה והפקה גבוהות.', tier: 2, moveCost: 2200, livingMultiplier: 1.55, workMultiplier: 1.40, productionMultiplier: 1.20 },
    { id: 'los_angeles', title: 'לוס אנג׳לס', tagline: 'פיץ׳ גדול בעיר יקרה', description: 'השכר הגבוה ביותר במשחק ופגישות אולפן, עם עלויות המחיה וההפקה הגבוהות ביותר.', tier: 3, moveCost: 3500, livingMultiplier: 2, workMultiplier: 1.70, productionMultiplier: 1.45 }
  ];
  const STOCKS = [
    { id: 'takela', title: 'טייקסלה', ticker: 'TAKE', risk: 'גבוה', spread: 24, initialPrice: 120, description: 'מכוניות חשמליות ורכבי לוקיישן. החברה מבטיחה שהנהג יהיה מיותר לפני המפיק.' },
    { id: 'netpause', title: 'נטפאוז', ticker: 'PAUZ', risk: 'בינוני־גבוה', spread: 18, initialPrice: 90, description: 'סטרימינג, הפקות וביטולים. לפעמים החברה מגלה שגם צופים רוצים סוף לסיפור.' },
    { id: 'pomela', title: 'פומלה', ticker: 'PMLA', risk: 'בינוני', spread: 12, initialPrice: 150, description: 'מחשבים לעורכים ומתאמים למתאמים. ההצלחה הבאה עדיין אינה מובטחת.' }
  ];
  const PARTNERS = [
    { id: 'maya', name: 'מאיה', gender: 'אישה', profession: 'אוצרת', personality: 'סקרנית, ישירה, ותשמח לשמוע גם על דברים שאינם הסרט שלך.' },
    { id: 'idan', name: 'עידן', gender: 'גבר', profession: 'שף', personality: 'חם, מצחיק, ויודע שלפעמים צריך פשוט לאכול וללכת לישון.' },
    { id: 'noam', name: 'נועם', gender: 'א־בינארי', profession: 'אדריכלות ועיצוב', personality: 'יצירתי, עצמאי, ואוהב לטייל בלי לתכנן מראש כל פריים.' },
    { id: 'roni', name: 'רוני', gender: 'אישה', profession: 'עובדת סוציאלית', personality: 'רגישה ובעלת הומור יבש. גם מחוץ לקריירה יש על מה לדבר.' }
  ];
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const normalizeSeed = n => (n >>> 0) || 1;
  function random(market) { let x = market.rng >>> 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5; market.rng = x >>> 0; return market.rng / 4294967296; }
  function createLife(s, legacy) {
    const quarters = legacy ? Math.min(MAX_QUARTERS - 1, Math.max(0, (s.rival && s.rival.lastReportWeek) || s.week - 1)) : 0;
    const closed = ['won', 'lost'].includes(s.status);
    const chapter = s.season || 1;
    return {
      quarters, chapterProjectId: null, cityId: 'tel_aviv', retired: false, retirementSummary: '', productionLoad: 0, usedCityOffer: false, usedCityLeisure: false, eventHistory: [],
      chaptersWon: Math.max(0, chapter - 1) + (s.status === 'won' ? 1 : 0), chaptersCompleted: Math.max(0, chapter - 1) + (closed ? 1 : 0), lastRecordedChapter: closed ? chapter : chapter - 1,
      market: { rng: normalizeSeed(s.rng ^ 0x3c6ef372), quarter: quarters, prices: Object.fromEntries(STOCKS.map(stock => [stock.id, stock.initialPrice])), previousPrices: Object.fromEntries(STOCKS.map(stock => [stock.id, stock.initialPrice])), holdings: Object.fromEntries(STOCKS.map(stock => [stock.id, 0])), costBasis: Object.fromEntries(STOCKS.map(stock => [stock.id, 0])), realizedProfit: 0, trades: 0, headline: 'שלוש חברות בדיוניות. מחירים חדשים יגיעו בסבב הבא.' },
      relationship: { partnerId: null, closeness: 0, usedDate: false }
    };
  }
  function city(s) { return CITIES.find(city => city.id === s.life.cityId) || CITIES[0]; }
  function portfolioValue(life) { return STOCKS.reduce((sum, stock) => sum + life.market.prices[stock.id] * life.market.holdings[stock.id], 0); }
  function fee(gross) { return Math.max(1, Math.round(gross * 0.01)); }
  function royaltyMultiplier(film, quarters) {
    const anchor = Number.isInteger(film.releasedQuarter) ? film.releasedQuarter : Math.max(0, (film.releasedWeek || 1) - 1);
    const elapsed = Math.max(0, quarters - anchor);
    return elapsed < 8 ? 1 : elapsed < 16 ? 0.5 : elapsed < 24 ? 0.25 : 0.1;
  }
  function royalty(film, quarters) { return Math.round(film.royalty * royaltyMultiplier(film, quarters)); }
  function advance(s, quarters) {
    const life = s.life, market = life.market, oldValue = portfolioValue(life);
    const duration = Math.min(MAX_QUARTERS - life.quarters, Math.max(1, quarters || 1));
    life.quarters += duration; market.previousPrices = Object.assign({}, market.prices);
    const changes = STOCKS.map(stock => {
      const percent = (random(market) * 2 - 1) * stock.spread;
      market.prices[stock.id] = clamp(Math.round(market.prices[stock.id] * (1 + percent / 100)), 15, 5000);
      const actual = Math.round((market.prices[stock.id] / market.previousPrices[stock.id] - 1) * 1000) / 10;
      return { id: stock.id, title: stock.title, change: actual };
    });
    const largest = changes.slice().sort((a, b) => Math.abs(b.change) - Math.abs(a.change))[0];
    const news = {
      takela: ['רכב לוקיישן חדש סוף סוף הגיע ללוקיישן', 'עדכון אוטונומיה שלח את הציוד לחוף'],
      netpause: ['סדרה ישראלית מפתיעה בטופ 10', 'מבטלת סדרת דגל, והמנויים איתה'],
      pomela: ['עורכים משדרגים למחשב חדש', 'עוד חיבור נעלם. הקהל לא התחבר']
    };
    market.headline = largest.change ? largest.title + ': ' + news[largest.id][largest.change > 0 ? 0 : 1] + ' (' + (largest.change > 0 ? '+' : '') + largest.change + '% בסבב).' : 'סבב שקט במסחר. העמלות עדיין יודעות לעבוד.';
    market.quarter = life.quarters; market.trades = 0;
    const relationshipChange = life.relationship.partnerId && life.relationship.closeness > 0 && life.productionLoad > 0 ? -Math.min(2, life.relationship.closeness) : 0;
    life.relationship.closeness += relationshipChange; life.relationship.usedDate = false; life.productionLoad = 0; life.usedCityOffer = false; life.usedCityLeisure = false;
    return { quarter: life.quarters, durationQuarters: duration, headline: market.headline, changes, valueChange: portfolioValue(life) - oldValue, relationshipChange };
  }
  return { START_AGE, EARLY_RETIREMENT_AGE, RETIREMENT_AGE, MAX_QUARTERS, CITIES, STOCKS, PARTNERS, createLife, city, portfolioValue, fee, royaltyMultiplier, royalty, advance };
});
