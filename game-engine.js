(function (root, factory) {
  'use strict';
  var industry = typeof module === 'object' && module.exports ? require('./film-industry.js') : root.FilmIndustry;
  var life = typeof module === 'object' && module.exports ? require('./film-life.js') : root.FilmLife;
  var stories = typeof module === 'object' && module.exports ? require('./film-stories.js') : root.FilmStories;
  var crowd = typeof module === 'object' && module.exports ? require('./film-crowdfunding.js') : root.FilmCrowdfunding;
  var local = typeof module === 'object' && module.exports ? require('./film-local.js') : root.FilmLocal;
  var events = typeof module === 'object' && module.exports ? require('./film-events.js') : root.FilmEvents;
  var network = typeof module === 'object' && module.exports ? require('./film-network.js') : root.FilmNetwork;
  var workload = typeof module === 'object' && module.exports ? require('./film-workload.js') : root.FilmWorkload;
  var api = factory(industry, life, stories, crowd, local, events, network, workload);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FilmGame = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Industry, Life, Stories, Crowd, Local, Events, Network, Workload) {
  'use strict';
  if (!Industry) throw new Error('film-industry.js must load before game-engine.js');

  if (!Life) throw new Error('film-life.js must load before game-engine.js');
  const VERSION = 5;
  const BASE_HOURS = 50;
  const CHARACTERS = [
    { id: 'kobi', name: 'קובי', subtitle: 'מלך האלתורים', quote: 'תקציב אין. חבר עם תרמוס יש.', advantage: 'צילום עם חברים זול ב־15%.', drawback: 'בצילום עם חברים: איכות משתנה ב־3− עד 3+.', portraitIndex: 0 },
    { id: 'noa', name: 'נועה', subtitle: 'הפרפקציוניסטית', quote: 'זה סופי. רק נשנה את הסוף.', advantage: 'עוד 8 איכות לאורך עריכת הסרט.', drawback: 'כל יום עריכה דורש שעה נוספת.', portraitIndex: 1 },
    { id: 'amir', name: 'אמיר', subtitle: 'מכיר מישהו', quote: 'אני מכיר את מי שמכיר את הלקטור.', advantage: 'קפה עם מפיקה מעניק עוד 3 קשרים.', drawback: 'מתחיל עם 8 מיומנות במקום 12.', portraitIndex: 2 },
    { id: 'tamar', name: 'תמר', subtitle: 'הפרילנסרית המפוכחת', quote: 'קודם מקדמה. אחר כך חזון.', advantage: 'שכר המשמרות גבוה ב־15%.', drawback: 'כל משמרת מורידה 2 אושר.', portraitIndex: 3 }
  ];
  // Fictional funds and compressed game cycles, not real-world eligibility rules.
  const FUND_TRACKS = [
    { id: 'development', fundName: 'קרן ״עוד טיוטה״', title: 'מענק פיתוח', description: 'תסריט שעוד אפשר להציל לפני שמזמינים ציוד.', amount: 400, waitWeeks: 1, cycle: 4, offset: 0, openWeeks: 2, stages: ['script'], craft: 0, quality: 0, requirements: ['סרט בשלב התסריט', 'הכסף מיועד להוצאות הסרט בלבד'] },
    { id: 'production', fundName: 'קרן ״אור ראשון״', title: 'מענק הפקה', description: 'לתסריט גמור שצריך להפוך ליום צילום אמיתי.', amount: 900, waitWeeks: 2, cycle: 4, offset: 1, openWeeks: 2, stages: ['shoot'], craft: 18, quality: 0, requirements: ['תסריט גמור, לפני הצילום', '18 מיומנות לפחות', 'הכסף מיועד להוצאות הסרט בלבד'] },
    { id: 'completion', fundName: 'קרן ״קאט אחרון״', title: 'מענק השלמה', description: 'כדי שהסרט ייצא מהכונן לפני שהכונן ייצא מאחריות.', amount: 500, waitWeeks: 1, cycle: 3, offset: 0, openWeeks: 2, stages: ['edit', 'release'], craft: 0, quality: 35, requirements: ['סרט מצולם, לפני הבכורה', '35 איכות לפחות', 'הכסף מיועד להוצאות הסרט בלבד'] }
  ];
  const LOCATIONS = [
    { id: 'home', name: 'הדירה בפלורנטין', subtitle: 'לכתוב. לנוח. להתעלם מהכביסה.', character: 'קובי, במחשבה לעצמו', quote: 'הדירה קטנה, אבל לפחות הלוקיישן בחינם.' },
    { id: 'set', name: 'סט הצילומים', subtitle: 'הפסקת צהריים בשעה 17:40', character: 'מיכל, מנהלת ההפקה', quote: 'זה יום קצר. שתים־עשרה שעות גג.' },
    { id: 'school', name: 'בית הספר לקולנוע', subtitle: 'לומדים מסגור. מקבלים חשבונית.', character: 'נירה, המרצה', quote: 'השוט יפה. מה הוא אומר על אבא שלך?' },
    { id: 'cafe', name: 'קפה ״יש תקציב״', subtitle: 'כולם בפיתוח. אף אחד לא משלם.', character: 'סמי, בעל הקפה', quote: 'הפיץ׳ על חשבון הבית. ההפוך לא.' },
    { id: 'studio', name: 'חדר העריכה', subtitle: 'final_final_באמת_סופי_7', character: 'דנה, העורכת', quote: 'ננסה עוד גרסה. רק כדי לחזור לקודמת.' },
    { id: 'festival', name: 'הסינמטק', subtitle: 'הקהל קטן. הוויכוח ענק.', character: 'אריק, המפיק', quote: 'אני מחפש קול חדש. עם קהל קיים, עדיף.' },
    { id: 'gear', name: '״פיקסלים״ ציוד', subtitle: 'כי הסיפור צריך גם סוללה', character: 'רפי, איש הציוד', quote: 'המצלמה הזו רואה בחושך. החשבון פחות.' },
    { id: 'bank', name: 'בית הקרנות והבנק', subtitle: 'בקשות, תשובות, ואותיות קטנות', character: 'לימור, הבנקאית', quote: '״חשיפה״ לא מתקבלת כאן כבטוחה.' }
  ];
  const DIFFICULTIES = {
    calm: { label: 'חביב הקהל', description: 'יותר אוויר, פחות שכר דירה.', maxWeeks: 20, living: 330, interest: 0.025, startingCash: 2200, goals: { wealth: 6500, craft: 60, reputation: 55, happiness: 68 } },
    normal: { label: 'המציאות הישראלית', description: 'צריך גם כישרון וגם לשלם שכירות.', maxWeeks: 14, living: 410, interest: 0.04, startingCash: 1800, goals: { wealth: 12000, craft: 80, reputation: 78, happiness: 76 } },
    hard: { label: 'הפקה על הקצה', description: 'תקציב קטן. ציפיות גדולות.', maxWeeks: 12, living: 480, interest: 0.055, startingCash: 1500, goals: { wealth: 18000, craft: 90, reputation: 92, happiness: 82 } }
  };
  const JOBS = [
    { id: 0, title: 'רץ/ת הפקה', wage: 460, hours: 10, energy: 16, craft: 0, contacts: 0, reputation: 0, description: 'להביא קפה, כבל, ואת השחקן שאבד בחניון.' },
    { id: 1, title: 'עוזר/ת במאי', wage: 800, hours: 10, energy: 19, craft: 24, contacts: 16, reputation: 12, description: 'לגרום ל־23 אנשים להעמיד פנים שהם בזמן.' },
    { id: 2, title: 'עורך/ת מבוקש/ת', wage: 1220, hours: 9, energy: 18, craft: 45, contacts: 28, reputation: 30, description: 'להוציא סיפור מ־4 טרה של ״עוד אחד לביטחון״.' },
    { id: 3, title: 'במאי/ת עם שם', wage: 1760, hours: 10, energy: 20, craft: 68, contacts: 40, reputation: 55, film: true, description: 'עכשיו אומרים שהכאוס על הסט הוא החזון שלך.' }
  ];
  const ASSETS = {
    bike: { title: 'אופניים מתקפלים', price: 700, description: 'נסיעות בין המקומות לא עולות זמן.', benefit: 'נסיעות בחינם בזמן' },
    desk: { title: 'פינת עבודה נורמלית', price: 600, description: 'תרגול מעניק עוד 2 מיומנות; עוד 2 אושר בכל שבוע.', benefit: '+2 מיומנות בתרגול, +2 אושר בסבב' },
    laptop: { title: 'מחשב שלא מתחמם ב־HD', price: 1500, description: 'עריכת הסרט זולה ב־150 ₪ וקצרה בשעה; תוספת 8 לאיכות.', benefit: 'עריכה מהירה וזולה יותר, +8 איכות' },
    camera: { title: 'מצלמה שהיא שלך', price: 2000, description: 'צילום סרט זול ב־35%; תוספת 8 לאיכות.', benefit: '35% הנחה בצילום, +8 איכות' }
  };
  ASSETS.apartment = { title: 'לקנות דירה להשכרה', price: 9500, propertyValue: 9500, rent: 180, careerTier: 2, description: 'במשק המשחק המקוצר: נכס אחד, הכנסה נטו קבועה וללא התייקרות או מכירה.', benefit: '+180 ₪ נטו בכל סוף שבוע' };
  ASSETS.studio_property = { title: 'לקנות סטודיו', price: 14500, propertyValue: 14500, rent: 140, careerTier: 3, description: 'בית קבוע להפקות שלך: הכנסה מהשכרה, ו־15% הנחה נוספת על צילום ועריכה.', benefit: '+140 ₪ בסבב, צילום ועריכה זולים ב־15%' };
  const FILM_TYPES = {
    short: { label: 'דרמה קצרה', genre: 'דרמה קצרה', initialCost: 90, shootCost: 650, quality: 12, reputation: 1.1, revenue: 0.9, titles: ['אבא מחפש חניה', 'שקט, השכנה ישנה', 'המרפסת של מחר', 'כביסה לבנה ביפו'] },
    doc: { label: 'דוקו שכונתי', genre: 'דוקו', initialCost: 50, shootCost: 430, quality: 10, reputation: 1.2, revenue: 0.78, titles: ['ועד הבית: הסיפור האמיתי', 'הפלאפל האחרון', 'האיש שתפס את האוטובוס', 'קומה שלישית בלי מעלית'] },
    comedy: { label: 'קומדיית אינדי', genre: 'קומדיה', initialCost: 160, shootCost: 980, quality: 14, reputation: 0.9, revenue: 1.4, titles: ['חתונה, אזעקה ומזגן', 'סבבה, נסתדר בעריכה', 'קאט! זה השכן', 'מי לקח את הקבלה?'] }
  };
  FILM_TYPES.feature = { label: 'פיצ׳ר ישראלי', genre: 'פיצ׳ר', initialCost: 600, shootCost: 4200, quality: 18, reputation: 1.5, revenue: 3.8, careerTier: 2, description: 'סרט ארוך, צוות גדול וסיכון מסחרי. מחיר הבכורה: 600 ₪. תחזית והסתברות לנפילה יוצגו לפני ההפצה.', titles: ['הדירה האחרונה בתל אביב', 'ארבעה אחים ושולחן', 'אין קליטה בעמק'] };
  FILM_TYPES.blockbuster = { label: 'סרט לקהל גדול', genre: 'שובר קופות', initialCost: 1800, shootCost: 11000, quality: 20, reputation: 1.7, revenue: 8, careerTier: 3, description: 'השקעה גדולה בתקווה לשובר קופות. מחיר הבכורה: 1,400 ₪. קהל גדול אינו מובטח; כישלון יכול להחזיר רק חלק מהתקציב.', titles: ['מבצע: לא לצאת פראייר', 'חתונה בקנה מידה ארצי', 'הקיץ שבו כולם באו'] };
  const RIVAL_QUOTES = {
    set: ['״אני פה רק להגיד שלום לבמאי. ולבדוק אם חסר עוזר.״', '״היום אני על הסט. הם עוד לא יודעים באיזה תפקיד.״'],
    school: ['״לקחתי כיתת אמן. כבר יש לי דעה נחרצת על אור טבעי.״', '״המרצה אמרה שיש לי קול. אני עובד על מה להגיד איתו.״'],
    cafe: ['״אני בפגישה עם מפיק. טוב, הוא הזמין קפה לידי.״', '״הפיץ׳ שלי קצר. המצגת רק ארבעים שקופיות.״'],
    studio: ['״עוד גרסה אחת והסרט נעול. בערך מאז יום שלישי.״', '״העורך אומר שחסר סיפור. אמרתי לו שיעשה קסם.״'],
    festival: ['״אני בסינמטק. התג כבר עושה חצי מהנטוורקינג.״', '״נבחרתי לפסטיבל. יש דמי הרשמה, אבל נבחרתי.״'],
    gear: ['״העדשה הזאת תיתן לסרט שלי עומק. בעיקר בחוב.״', '״אני רק משווה מחירים. רפי כבר הדפיס חשבונית.״']
  };
  const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
  const money = n => Math.round(n).toLocaleString('he-IL') + ' ₪';
  const owns = (s, key) => s.assets.includes(key);
  function seedNumber(seed) {
    if (typeof seed === 'number' && Number.isFinite(seed)) return (seed >>> 0) || 1;
    let n = 2166136261;
    for (const c of String(seed == null ? Date.now() : seed)) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
    return (n >>> 0) || 1;
  }
  function random(s) {
    let x = s.rng >>> 0;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    s.rng = x >>> 0;
    return s.rng / 4294967296;
  }
  function netWorth(s) { return Math.round(s.cash - s.debt + (s.life ? Life.portfolioValue(s.life) : 0) + s.assets.reduce((sum, id) => sum + (ASSETS[id].propertyValue || 0), 0)); }
  function seasonTargets(s) {
    const base = DIFFICULTIES[s.difficulty].goals, step = (s.season || 1) - 1;
    return { wealth: Math.round(base.wealth * (1 + step * 1.2)), craft: Math.min(98, base.craft + step * 8), reputation: Math.min(98, base.reputation + step * 8), happiness: Math.min(94, base.happiness + step * 4) };
  }
  function seasonFilmGoal(s, films) {
    const recent = films.slice(films === s.films ? (s.seasonFilmBase || 0) : (s.rival && s.rival.seasonFilmBase || 0));
    if (films === s.films && s.life && s.life.chapterProjectId) return { label: 'להוציא את הסרט שכבר התחלת', met: recent.some(f => f.id === s.life.chapterProjectId) };
    return s.season > 3 ? { label: 'להוציא סרט חדש בפרק הזה', met: recent.length > 0 } : s.season >= 3 ? { label: 'להוציא סרט לקהל גדול בפרק הזה', met: recent.some(f => f.type === 'blockbuster') } : s.season === 2 ? { label: 'להוציא פיצ׳ר ראשון בפרק הזה', met: recent.some(f => ['feature', 'blockbuster'].includes(f.type)) } : { label: 'לפחות סרט אחד שיצא לאור', met: films.length > 0 };
  }
  function getCareerPath(s) {
    const f = s.films, high = f.some(film => film.quality >= 65), featureHit = f.some(film => film.type === 'feature' && film.route === 'commercial' && film.quality >= 72 && film.revenue + (film.productionIncome || 0) >= film.budget);
    const req = (label, met) => ({ label, met });
    const rows = [
      { id: 'crew', title: 'בתחילת הדרך', description: 'חתונות, משמרות וסרטים קטנים. הקרדיט עוד מתחת ל״תודות״.', requirements: [], unlocks: ['צילום חתונות', 'סרטים קצרים ודוקו'] },
      { id: 'indie', title: 'יוצר/ת עצמאי/ת', description: 'יש סרט שאפשר לשלוח, ויש מי שמתחיל להחזיר טלפון.', requirements: [req('סרט שיצא באיכות 50 לפחות', f.some(film => film.quality >= 50)), req('35 מיומנות', s.craft >= 35), req('25 מוניטין', s.reputation >= 25)], unlocks: ['פרסומות', 'הרצאה על הסרט שלך'] },
      { id: 'feature', title: 'במאי/ת פיצ׳רים', description: 'מהסרט הקטן שלך להפקה שכבר צריכה גיליון תקציב משלה.', requirements: [req('שני סרטים שיצאו לאור', f.length >= 2), req('סרט אחד באיכות 65 לפחות, בכל מסלול', high), req('60 מיומנות', s.craft >= 60), req('50 מוניטין', s.reputation >= 50), req('32 קשרים', s.contacts >= 32)], unlocks: ['פיצ׳ר ישראלי', 'כיתת אמן בתשלום', 'דירה להשכרה'] },
      { id: 'blockbuster', title: 'שם שמוכר כרטיסים', description: 'פיצ׳ר רווחי פותח דלתות. ומגדיל מאוד את גודל הנפילה.', requirements: [req('פיצ׳ר מסחרי באיכות 72 שהחזיר את תקציבו', featureHit), req('75 מיומנות', s.craft >= 75), req('75 מוניטין', s.reputation >= 75), req('50 קשרים', s.contacts >= 50)], unlocks: ['שובר קופות', 'סטודיו בבעלותך'] },
      { id: 'international', title: 'שם בינלאומי', description: 'עכשיו מזמינים אותך לשפוט סרטים של אנשים אחרים.', requirements: [req('ארבעה סרטים שיצאו לאור', f.length >= 4), req('פיצ׳ר או סרט גדול שהוקרן בסינמטק, באיכות 85', f.some(film => ['feature', 'blockbuster'].includes(film.type) && film.route === 'festival' && film.quality >= 85)), req('90 מיומנות', s.craft >= 90), req('90 מוניטין', s.reputation >= 90), req('65 קשרים', s.contacts >= 65)], unlocks: ['חבר/ת חבר שופטים בפסטיבל עולמי'] }
    ];
    // Each title represents all earlier milestones too, never a shortcut around a film achievement.
    let previous = true;
    return rows.map((row, tier) => { const reached = previous && row.requirements.every(r => r.met); previous = reached; return Object.assign(row, { tier, reached }); });
  }
  function getCareer(s) {
    const path = getCareerPath(s), current = [...path].reverse().find(row => row.reached) || path[0], next = path[current.tier + 1];
    return { tier: current.tier, id: current.id, title: current.title, description: current.description, nextTitle: next ? next.title : 'כל דלתות התעשייה פתוחות', requirements: next ? next.requirements : [], achievements: path.filter(row => row.reached && row.tier).map(row => row.title), unlocks: path.filter(row => row.reached).flatMap(row => row.unlocks), seasonGoal: seasonFilmGoal(s, s.films) };
  }
  function careerGate(s, tier) {
    if (getCareer(s).tier >= tier) return '';
    const path = getCareerPath(s), target = path[tier], missing = path.find(row => !row.reached && row.tier <= tier);
    return 'נפתח במעמד ״' + target.title + '״. ' + (missing ? missing.requirements.filter(r => !r.met).map(r => r.label).join(' · ') : '');
  }
  function nextPeriodQuarters(s) { return Math.min(Life.MAX_QUARTERS - s.life.quarters, [1, 2, 3, 4, 4][getCareer(s).tier]); }
  function retirementRounds(s) { const duration = nextPeriodQuarters(s); return duration ? Math.ceil((Life.MAX_QUARTERS - s.life.quarters) / duration) : 0; }
  function chapterContinueReason(s) {
    if (!s || !s.life) return 'אין קריירה פתוחה.';
    if (s.life.retired || s.life.quarters >= Life.MAX_QUARTERS) return 'הקריירה הסתיימה בפרישה.';
    if (s.debt > 6500) return 'פשיטת רגל מסיימת את הקריירה. אי אפשר לפתוח פרק עם החוב הזה.';
    if (!['won', 'lost'].includes(s.status)) return 'אפשר להמשיך לפרק הבא לאחר סיום הפרק הנוכחי.';
    return '';
  }
  function recordChapter(s) {
    if (['won', 'lost'].includes(s.status) && s.life.lastRecordedChapter < s.season) {
      s.life.chaptersCompleted += 1;
      if (s.status === 'won') s.life.chaptersWon += 1;
      s.life.lastRecordedChapter = s.season;
    }
  }
  function continueCareer(s) {
    const reason = chapterContinueReason(s);
    if (reason) return { ok: false, message: reason };
    recordChapter(s);
    const wasLost = s.status === 'lost';
    // Only the old final-round settlement leaves the calendar on the completed round.
    // Advancing that label must not advance age/market or grant a second date.
    if (s.rival.lastReportWeek === s.week) {
      s.week += 1; s.maxHours = BASE_HOURS; s.hours = s.maxHours; s.location = 'home'; s.used = freshUsage(); s.weeklyTotals = { income: 0, expenses: 0 };
      resolveFunding(s); resolveCrowdfunding(s); resolveFestivalCircuit(s);
    }
    s.life.chapterProjectId = wasLost && s.project ? s.project.id : null;
    s.season += 1; s.seasonStartedWeek = s.week; s.seasonFilmBase = s.films.length; s.rival.seasonFilmBase = s.rival.films.length;
    s.maxWeeks += DIFFICULTIES[s.difficulty].maxWeeks; s.status = 'playing'; s.ending = '';
    // Burnout still costs the previous chapter, but a break is not permanent exile.
    if (wasLost) s.crisisWeeks = 0;
    refreshLocationBoards(s); refreshRivalPlan(s, true); s.rival.progress = raceScore(s, s.rival); s.rival.weekStartGap = raceScore(s, s) - s.rival.progress;
    const message = 'פרק ' + s.season + ': ' + seasonFilmGoal(s, s.films).label + '. נוספו ' + DIFFICULTIES[s.difficulty].maxWeeks + ' סבבים; הכסף, הסרטים והשעות שנותרו נשמרו.';
    note(s, message); return { ok: true, message };
  }
  function retireCareer(s, mandatory) {
    if (!s || !s.life || s.life.retired) return { ok: false, message: 'הקריירה כבר הסתיימה.' };
    const age = Life.START_AGE + s.life.quarters / 4;
    if (!mandatory && (age < Life.EARLY_RETIREMENT_AGE || s.debt > 6500 || s.project || s.event || s.productionAlert || s.festivalCircuit.pending.length)) return { ok: false, message: 'אפשר לפרוש מגיל 65, בין סרטים ולאחר תשובות הפסטיבלים וסגירת האירועים הפתוחים.' };
    if (mandatory) { closeRetirementSubmissions(s); checkVictory(s); }
    recordChapter(s);
    s.life.retired = true; s.status = 'retired';
    Crowd.close(s.project,s.week); Network.close(s.project,s.week);
    withdrawApplication(s, 'הקריירה הסתיימה בפרישה; הבקשה נסגרה ללא תשלום.');
    const awards = s.films.reduce((sum, film) => sum + film.awards.length, 0);
    s.life.retirementSummary = 'בגיל ' + age + ' הקרדיטים עולים: ' + s.films.length + ' סרטים, ' + awards + ' פרסים, ' + s.life.chaptersWon + ' פרקים מנצחים ושווי נטו של ' + money(netWorth(s)) + '.' + (s.project ? ' הסרט האחרון נשאר בתהליך, כחלק מהסיפור שלך.' : '') + ' כל הסרטים וההישגים נשמרים ביומן.';
    s.ending = s.life.retirementSummary; note(s, s.ending); return { ok: true, message: s.ending };
  }
  function workPay(s, base, characterBonus) { return Math.round(base * Life.city(s).workMultiplier * (characterBonus && s.characterId === 'tamar' ? 1.15 : 1)); }
  function cityMoveReason(s, destination) {
    return s.life.cityId === destination.id ? 'כבר גרים בעיר הזו.' : s.project ? 'מעבר עיר אפשרי בין סרטים, אחרי הפצת הסרט הפעיל.' : careerGate(s, destination.tier);
  }
  function addLocalActions(s, location, add) {
    const cityId=s.life.cityId,p=s.project;
    if(cityId==='tel_aviv')return;
    if(location==='home'){
      for(const outing of Local.outings(cityId,s.week)){
        const labels={craft:'מיומנות',energy:'אנרגיה',happiness:'אושר'};
        add('outing_'+outing.id,outing.title,outing.description,outing.cost,Object.entries(outing.stats).map(([k,v])=>'+'+v+' '+labels[k]).concat(['בילוי עירוני אחד בכל תקופה']),st=>{
          addStats(st,outing.stats);st.life.usedCityLeisure=true;
        },{localLeisure:true,noCommute:true,tag:outing.tag,reason:s.life.usedCityLeisure?'כבר יצאת לבילוי העירוני בתקופה הזו. שתי הצעות חדשות יופיעו בתקופה הבאה.':''});
      }
      if(p&&p.stage==='edit'&&(!p.crew?.some(c=>c.role==='editor')||p.crew.some(c=>c.role==='editor'&&(c.homeCity||'tel_aviv')!==cityId))){
        const editor=p.crew?.find(c=>c.role==='editor');
        add('remote_review','צפייה משותפת בזום עם העורך/ת בארץ',editor?'פותחים גרסת צפייה עם '+(editor.displayTitle||editor.title).split(' — ')[0]+'. מישהו שוכח לבטל מיוט, אבל סוף סוף מבינים איפה הסצנה נתקעת.':'העורך או העורכת ששכרת לסרט יכולים להצטרף מהארץ לצפייה ולתת הערות.',{time:2,money:60,energy:3},['+4 איכות, עד 100','פעם אחת לסרט · ללא זמן נסיעה'],st=>{st.project.quality=Math.min(100,st.project.quality+4);st.project.budget+=60;st.project.remoteReviewUsed=true;},
          {noCommute:true,filmExpense:true,tag:'הסרט שלך',reason:!editor?'צריך לשכור עורך/ת לסרט בחדר העריכה.':p.remoteReviewUsed?'כבר התקיימה צפיית הזום של הסרט הזה.':p.quality>=100?'הסרט כבר באיכות 100. אין צורך בצפייה נוספת.':''});
      }
    }
    if(location==='bank')add('local_partner','לצרף שותף הפקה מקומי','פגישה, תרגום תיק וחלוקת אחריות. כך אפשר לגשת למסלולי ההפקה וההשלמה של '+Life.city(s).title+'.',{time:3,money:180,energy:4},['פותח מסלולי תמיכה מקומיים לסרט הזה','+4 קשרים · אישור הקרן אינו מובטח'],st=>{st.project.localPartner=cityId;st.project.budget+=180;addStats(st,{contacts:4});},
      {filmExpense:true,tag:'קרנות',reason:!p?'צריך סרט פעיל לפני שמצרפים שותף.':p.localPartner===cityId?'כבר יש לסרט שותף מקומי.':s.contacts<24?'נדרשים 24 קשרים כדי למצוא שותף מקומי.':''});
  }
  function addLifeActions(s, location, add) {
    const life = s.life, market = life.market, relation = life.relationship;
    const opts = category => ({ lifeOffer: true, lifeCategory: category, tag: category === 'market' ? 'מניות' : category === 'city' ? 'עיר' : 'חיים' });
    if (location === 'bank') {
      for (const city of Life.CITIES) add('city_' + city.id, 'לעבור ל' + city.title, city.description,
        { time: 4, money: city.moveCost }, ['מחיה ×' + city.livingMultiplier, 'שכר מקומי ×' + city.workMultiplier, 'צילום ועריכה ×' + city.productionMultiplier, '−5 קשרים מקומיים; הסרטים והנכסים נשמרים'], st => {
          st.life.cityId = city.id; addStats(st, { contacts: -5 });
        }, Object.assign(opts('city'), { noCommute: true, careerTier: city.tier, reason: cityMoveReason(s, city) }));
      for (const stock of Life.STOCKS) {
        const id = stock.id, price = market.prices[id], quantity = 5, gross = quantity * price, fee = Life.fee(gross), total = gross + fee, proceeds = gross - fee;
        const basis = market.holdings[id] ? market.holdings[id] === quantity ? market.costBasis[id] : Math.round(market.costBasis[id] * quantity / market.holdings[id]) : 0;
        const realizedProfit = proceeds - basis, profitPercent = basis ? Math.round(realizedProfit / basis * 1000) / 10 : 0;
        const common = Object.assign(opts('market'), { careerTier: 1, reason: market.trades >= 2 ? 'שתי העסקאות לסבב נוצלו. המכסה מתחדשת בסבב הבא.' : '' });
        add('stockbuy_' + id, 'לקנות 5 מניות ' + stock.title, stock.description + ' סיכון: ' + stock.risk + '.', { time: 1, money: total },
          ['5 × ' + money(price), 'עמלה: ' + money(fee), 'חיוב כולל: ' + money(total), 'השווי יכול גם לרדת; כסף אישי בלבד'], st => {
            st.life.market.holdings[id] += quantity; st.life.market.costBasis[id] += total; st.life.market.trades += 1;
            // Buying shares exchanges cash for an asset; only the commission is an expense.
            st.weeklyTotals.expenses -= gross;
          }, Object.assign({}, common, { trade: { side: 'buy', quantity, price, fee, total, proceeds: 0 } }));
        add('stocksell_' + id, 'למכור 5 מניות ' + stock.title, 'מימוש חלק מההחזקה במחיר הנוכחי, לאחר עמלה.', { time: 1 },
          ['5 × ' + money(price), 'עמלה: ' + money(fee), 'תקבול נטו: ' + money(proceeds), 'רווח מימוש: ' + money(realizedProfit) + ' (' + profitPercent + '%)'], st => {
            st.cash += proceeds; st.weeklyTotals.expenses += fee;
            st.life.market.holdings[id] -= quantity; st.life.market.costBasis[id] -= basis; st.life.market.realizedProfit += realizedProfit; st.life.market.trades += 1;
          }, Object.assign({}, common, { reason: common.reason || (market.holdings[id] < quantity ? 'צריך להחזיק לפחות 5 מניות של החברה.' : ''), trade: { side: 'sell', quantity, price, fee, total: 0, proceeds, costBasis: basis, realizedProfit, profitPercent } }));
      }
    }
    if (location === 'cafe') {
      for (const partner of Life.PARTNERS) add('partner_' + partner.id, 'להכיר את ' + partner.name, partner.profession + ' · ' + partner.personality,
        { time: 3, money: 80 }, ['מתחילים זוגיות מבחירה', 'קרבה ראשונית: 45', '+4 אושר', 'כל הדמויות זמינות לכל דמות שחקן'], st => {
          st.life.relationship.partnerId = partner.id; st.life.relationship.closeness = 45; st.life.relationship.usedDate = true; addStats(st, { happiness: 4 });
        }, Object.assign(opts('relationship'), { careerTier: 1, reason: relation.partnerId ? 'יש כבר זוגיות. אפשר לבחור להיפרד בבית לפני התחלה חדשה.' : relation.usedDate ? 'כבר הקדשת את זמן ההיכרות והזוגיות של הסבב הזה.' : '' }));
    }
    if (location === 'home') {
      add('date', 'ערב ביתי ביחד', 'ארוחה, שיחה, והטלפון של ההפקה נשאר בחדר השני.', { time: 3, money: 50 }, ['+8 אושר', '+6 אנרגיה', '+10 קרבה, עד 100', 'פעם אחת בסבב'], st => {
        st.life.relationship.closeness = Math.min(100, st.life.relationship.closeness + 10); st.life.relationship.usedDate = true; addStats(st, { happiness: 8, energy: 6 });
      }, Object.assign(opts('relationship'), { reason: !relation.partnerId ? 'ערב זוגי זמין כשיש זוגיות; רווקות היא בחירה תקפה.' : relation.usedDate ? 'כבר הקדשת ערב לזוגיות בסבב הזה.' : '' }));
      add('breakup', 'להיפרד בהסכמה', 'שיחה ישירה ומכבדת. אפשר להמשיך את הקריירה גם לבד.', { time: 1 }, ['הזוגיות מסתיימת; אין קנס אושר על רווקות'], st => {
        st.life.relationship.partnerId = null; st.life.relationship.closeness = 0;
      }, Object.assign(opts('relationship'), { reason: !relation.partnerId ? 'אין זוגיות לסיים.' : '' }));
      const age = Life.START_AGE + life.quarters / 4;
      add('retire', 'לסיים קריירה ולעלות לקרדיטים', 'פרישה מרצון אפשרית מגיל 65. בגיל 85 הקריירה מסתיימת.', {}, ['הסרטים, הפרסים וסיכום הקריירה נשמרים', 'לא יהיו פעולות נוספות בקריירה הזו'], st => retireCareer(st, false),
        Object.assign(opts('retirement'), { noCommute: true, allowEnded: true, reason: life.retired ? 'כבר פרשת.' : s.debt > 6500 ? 'הקריירה הסתיימה בפשיטת רגל.' : age < Life.EARLY_RETIREMENT_AGE ? 'אפשר לפרוש מרצון מגיל 65.' : s.project ? 'מסיימים את הסרט הפעיל לפני פרישה מרצון.' : s.festivalCircuit.pending.length ? 'מחכים לתשובות הפסטיבלים לפני פרישה מרצון.' : '' }));
    }
    const local = {
      athens: { location: 'set', title: 'שירות הפקה לצוות מקומי', description: 'הצוות הגיע לצלם בשכונה. מישהו צריך לדעת איזה שער באמת פתוח.', time: 7, energy: 18, basePay: 1400, stats: { craft: 2, contacts: 3, happiness: -3 } },
      berlin: { location: 'cafe', title: 'פגישה בשוק קופרודוקציות', description: 'עוד שותף פוטנציאלי לסרט. מסכמים כוונות, בלי הבטחה למענק.', time: 4, energy: 6, money: 180, stats: { contacts: 9, reputation: 5 } },
      london: { location: 'set', title: 'צילום פרסומת מקומית', description: 'תקציב גבוה ושש גרסאות לאותו חיוך. כל ההערות דחופות.', time: 9, energy: 24, basePay: 1800, stats: { contacts: 2, reputation: 2, happiness: -8 } },
      los_angeles: { location: 'cafe', title: 'פיץ׳ באולפן', description: 'עשרים דקות על הספה הנכונה. מבטיחים לשמור על קשר, והפעם יש שם מלא.', time: 4, energy: 8, money: 350, stats: { contacts: 8, reputation: 7 } }
    }[life.cityId];
    if (local && local.location === location) {
      const changes = Object.assign({}, local.stats); if (local.basePay) changes.cash = workPay(s, local.basePay, true);
      if (local.basePay && s.characterId === 'tamar') changes.happiness -= 2;
      const labels = { cash: '₪', contacts: 'קשרים', reputation: 'מוניטין', craft: 'מיומנות', happiness: 'אושר' };
      const effects = Object.entries(changes).map(([key, value]) => (value > 0 ? '+' : '') + value + ' ' + labels[key]); effects.push('הזדמנות מקומית אחת בכל סבב');
      add('city_' + life.cityId, local.title, local.description, { time: local.time, energy: local.energy, money: local.money || 0 }, effects, st => {
        addStats(st, changes); st.life.usedCityOffer = true;
      }, Object.assign(opts('city'), { cityOffer: true, reason: life.usedCityOffer ? 'כבר נוצלה הזדמנות מקומית בסבב הזה.' : '' }));
    }
  }
  function getLifeActions(s, location) { return getActions(s, location).filter(action => action.lifeOffer); }
  function getLife(s) {
    if (!s || !s.life) return null;
    const life = s.life, market = life.market, reason = careerGate(s, 1), all = ['bank', 'home', 'cafe'].flatMap(location => getLifeActions(s, location));
    const find = id => all.find(action => action.id === id), value = Life.portfolioValue(life), invested = Object.values(market.costBasis).reduce((sum, amount) => sum + amount, 0);
    const royalties = s.films.map(film => ({ filmId: film.id, title: film.title, amount: Life.royalty(film, life.quarters), multiplier: Life.royaltyMultiplier(film, life.quarters) }));
    const age = Life.START_AGE + life.quarters / 4;
    return {
      age, nextPeriodQuarters: nextPeriodQuarters(s), nextPeriodMonths: nextPeriodQuarters(s) * 3, quarter: life.quarters % 4 + 1, quartersElapsed: life.quarters, retirementAge: Life.RETIREMENT_AGE, retirementAvailable: age >= Life.EARLY_RETIREMENT_AGE && !life.retired, retired: life.retired, retirementSummary: life.retirementSummary,
      timeDescription: 'בסבב הבא יעברו ' + (nextPeriodQuarters(s) * 3) + ' חודשים של הפקה, בהתאם למעמד שלך. הבחירות הן שבוע מפתח בן 50 שעות בתוך התקופה; יתר הזמן הוא שגרה מאוזנת, בלי חיובי מחיה ושכר אוטומטיים נוספים.',
      currentRoyalties: royalties.reduce((sum, film) => sum + film.amount, 0), royalties,
      chapter: { number: s.season, canContinue: !chapterContinueReason(s), reason: chapterContinueReason(s), wins: life.chaptersWon, completed: life.chaptersCompleted },
      city: Object.assign({}, Life.city(s)),
      cities: Life.CITIES.map(city => { const a = find('bank.city_' + city.id); return Object.assign({}, city, { unlocked: !careerGate(s, city.tier), reason: a.reason, disabled: a.disabled, actionId: a.id }); }),
      market: { unlocked: !reason, reason, value, invested, profit: value - invested + market.realizedProfit, unrealizedProfit: value - invested, realizedProfit: market.realizedProfit, headline: market.headline, tradesLeft: Math.max(0, 2 - market.trades),
        stocks: Life.STOCKS.map(stock => { const id = stock.id, stockValue = market.prices[id] * market.holdings[id], basis = market.costBasis[id]; return Object.assign({}, stock, { price: market.prices[id], change: Math.round((market.prices[id] / market.previousPrices[id] - 1) * 1000) / 10, shares: market.holdings[id], costBasis: basis, profit: stockValue - basis, profitPercent: basis ? Math.round((stockValue - basis) / basis * 1000) / 10 : 0, buyActionId: 'bank.stockbuy_' + id, sellActionId: 'bank.stocksell_' + id }); }) },
      relationship: { partner: Life.PARTNERS.find(partner => partner.id === life.relationship.partnerId) || null, closeness: life.relationship.closeness, status: !life.relationship.partnerId ? 'רווקות מבחירה, בלי קנס או חובה' : life.relationship.closeness >= 65 ? 'קרובים, גם כשיש הפקה' : life.relationship.closeness >= 30 ? 'בונים חיים לצד הסרטים' : 'קצת רחוקים; ערב ביחד יכול לעזור',
        dateActionId: 'home.date', breakupActionId: 'home.breakup', options: Life.PARTNERS.map(partner => { const a = find('cafe.partner_' + partner.id); return Object.assign({}, partner, { actionId: a.id, disabled: a.disabled, reason: a.reason }); }) }
    };
  }
  function validLife(s) {
    const life = s.life, object = v => v && typeof v === 'object' && !Array.isArray(v), integer = (v, low, high) => Number.isInteger(v) && v >= low && v <= high;
    if (!object(life) || !integer(life.quarters, 0, Life.MAX_QUARTERS) || !Life.CITIES.some(city => city.id === life.cityId) || typeof life.retired !== 'boolean' || typeof life.retirementSummary !== 'string' || life.retirementSummary.length > 2000 || typeof life.usedCityOffer !== 'boolean' || !integer(life.productionLoad, 0, 100) || !integer(life.chaptersWon, 0, 1000) || !integer(life.chaptersCompleted, life.chaptersWon, 1000) || !integer(life.lastRecordedChapter, 0, 1000) || life.chaptersCompleted !== life.lastRecordedChapter || life.lastRecordedChapter > (s.season || 1) || life.retired && life.lastRecordedChapter < (s.season || 1) - 1 || life.lastRecordedChapter !== (['won', 'lost'].includes(s.status) ? s.season || 1 : life.retired ? life.lastRecordedChapter : (s.season || 1) - 1)) return false;
    if(life.eventHistory!==undefined&&(!Array.isArray(life.eventHistory)||life.eventHistory.length>7||new Set(life.eventHistory).size!==life.eventHistory.length||life.eventHistory.some(id=>!Object.keys(Events.BY_CITY).some(city=>eventPool(city).some(e=>e.id===id)))))return false;
    if (life.usedCityLeisure !== undefined && typeof life.usedCityLeisure !== 'boolean') return false;
    if ((s.status === 'retired') !== life.retired || life.retired && life.quarters < (Life.EARLY_RETIREMENT_AGE - Life.START_AGE) * 4 || !life.retired && life.quarters === Life.MAX_QUARTERS || life.retired && !life.retirementSummary) return false;
    if (life.chapterProjectId !== null && (!integer(life.chapterProjectId, 1, 1001) || ![...(s.films || []), ...(s.project ? [s.project] : [])].some(p => p.id === life.chapterProjectId))) return false;
    const market = life.market, relation = life.relationship;
    if (!object(market) || !integer(market.rng, 1, 4294967295) || market.quarter !== life.quarters || !integer(market.trades, 0, 2) || !integer(market.realizedProfit, -100000000, 100000000) || typeof market.headline !== 'string' || market.headline.length > 1000 || !object(relation) || !(relation.partnerId === null || Life.PARTNERS.some(p => p.id === relation.partnerId)) || !integer(relation.closeness, 0, 100) || relation.partnerId === null && relation.closeness !== 0 || typeof relation.usedDate !== 'boolean') return false;
    for (const key of ['prices', 'previousPrices', 'holdings', 'costBasis']) if (!object(market[key]) || Object.keys(market[key]).length !== Life.STOCKS.length) return false;
    for (const stock of Life.STOCKS) {
      const id = stock.id;
      if (!integer(market.prices[id], 15, 5000) || !integer(market.previousPrices[id], 15, 5000) || !integer(market.holdings[id], 0, Life.MAX_QUARTERS * 10 + 10) || market.holdings[id] % 5 || !integer(market.costBasis[id], 0, 100000000) || market.holdings[id] === 0 && market.costBasis[id] !== 0 || market.holdings[id] > 0 && market.costBasis[id] < market.holdings[id]) return false;
    }
    const projects = [...(s.films || []), ...(s.project ? [s.project] : []), ...((s.rival && s.rival.films) || [])];
    return projects.every(p => (p.createdQuarter === undefined || integer(p.createdQuarter, 0, life.quarters)) && (p.releasedQuarter === undefined || integer(p.releasedQuarter, p.createdQuarter || 0, life.quarters)));
  }
  const RIVAL_ACTIONS = {
    work: { label: 'משמרת צילום בתשלום', location: 'set' },
    learn: { label: 'סדנת בימוי ותרגול', location: 'school' },
    network: { label: 'פגישה עם מפיקה', location: 'cafe' },
    develop: { label: 'סגירת תסריט חדש', location: 'cafe' },
    shoot: { label: 'יום צילום לסרט', location: 'set' },
    release: { label: 'עריכה ובכורה לסרט', location: 'festival' },
    rest: { label: 'ערב עם חברים מחוץ לתעשייה', location: 'cafe' }
  };
  function rivalInitial(s, seed) {
    return { name: 'איתי', rng: seedNumber(seed), progress: 0, quote: '', location: 'set', cash: DIFFICULTIES[s.difficulty].startingCash, debt: 800, craft: 12, reputation: 8, contacts: 8, happiness: 62, films: [], project: null, history: [], weekStartGap: 0, seasonFilmBase: 0, initializedWeek: s.week, lastReportWeek: s.week - 1, nextPlan: '', dueWeek: s.week + 1, plan: null };
  }
  function raceScore(s, who) {
    const t = seasonTargets(s), wealth = who === s ? netWorth(s) : who.cash - who.debt;
    const components = [clamp(wealth / t.wealth, 0, 1), clamp(who.craft / t.craft, 0, 1), clamp(who.reputation / t.reputation, 0, 1), clamp(who.happiness / t.happiness, 0, 1), seasonFilmGoal(s, who.films).met ? 1 : 0];
    return Math.min(components.every(value => value >= 1) ? 100 : 99, Math.round(components.reduce((sum, value) => sum + value, 0) * 20));
  }
  function rivalFinished(s) {
    const r = s.rival, targets = seasonTargets(s);
    return r.cash - r.debt >= targets.wealth && r.craft >= targets.craft && r.reputation >= targets.reputation && r.happiness >= targets.happiness && seasonFilmGoal(s, r.films).met;
  }
  function getRivalComparison(s) {
    const snapshot = who => ({ name: who.name, score: raceScore(s, who), wealth: who === s ? netWorth(s) : who.cash - who.debt, craft: who.craft, reputation: who.reputation, happiness: who.happiness, films: who.films.length });
    const player = snapshot(s), rival = snapshot(s.rival), gap = player.score - rival.score;
    return { player, rival, gap, gapChange: gap - s.rival.weekStartGap, leader: gap === 0 ? 'tie' : gap > 0 ? 'player' : 'rival', description: 'ניקוד משותף: ארבעת יעדי הפרק והסרט הנדרש, כל יעד שווה 20 נקודות.' };
  }
  function refreshRivalPlan(s, force) {
    const r = s.rival;
    if (r.plan && r.plan.week === s.week && !force) return;
    const filmStep = !r.project ? 'develop' : r.project.stage === 'shoot' ? 'shoot' : 'release';
    const targets = seasonTargets(s);
    const support = r.happiness < targets.happiness ? 'rest' : r.craft < targets.craft ? 'learn' : 'network';
    const third = (s.week + r.films.length) % 3 === 0 ? support : filmStep;
    const ids = ['work', third];
    if (random(r) < 0.72) ids.push(third === support ? filmStep : support);
    const goal = third === 'develop' ? 'להתחיל סרט חדש' : third === 'shoot' ? 'לסיים את הצילומים' : third === 'release' ? 'להוציא סרט לבכורה' : third === 'rest' ? 'להתאושש לפני ההפקה הבאה' : 'לחזק את הקריירה לקראת הסרט הבא';
    r.plan = { week: s.week, goal, actions: ids.map(id => ({ id, label: RIVAL_ACTIONS[id].label })) };
    r.nextPlan = goal + ': ' + ids.map(id => RIVAL_ACTIONS[id].label).join(' + '); r.dueWeek = s.week + 1;
    r.location = RIVAL_ACTIONS[third].location;
    r.quote = '״בסבב הזה: ' + goal + '. הפעם זה ביומן, לא רק בסטורי.״';
  }
  function runRivalWeek(s) {
    const r = s.rival;
    if (r.lastReportWeek >= s.week) return null;
    const before = { cash: r.cash, wealth: r.cash - r.debt, craft: r.craft, reputation: r.reputation, contacts: r.contacts, happiness: r.happiness, films: r.films.length };
    const scoreBefore = raceScore(s, r), gapBefore = r.weekStartGap;
    let income = 0, expenses = 0;
    const spend = n => { r.cash -= n; expenses += n; }, earn = n => { r.cash += n; income += n; };
    const actions = [];
    for (const planned of r.plan.actions) {
      const start = { cash: r.cash, craft: r.craft, reputation: r.reputation, contacts: r.contacts };
      let text = '', id = planned.id;
      if (id === 'work') {
        const wage = r.craft >= 55 && r.reputation >= 25 ? 1380 : r.craft >= 25 ? 850 : 560;
        const setback = random(r) < 0.16, paid = setback ? Math.round(wage * 0.55) : wage;
        earn(paid); r.craft += 2; r.contacts += 1; r.happiness -= 2;
        text = setback ? 'לקוח קיצץ את יום הצילום; איתי הכניס רק ' + money(paid) + '.' : 'איתי צילם ' + (wage >= 1380 ? 'פרסומת' : 'משמרת') + ' והכניס ' + money(paid) + '.';
      } else if (id === 'learn' && r.cash >= 90) { spend(90); r.craft += 7; r.reputation += 1; text = 'סדנה ב־90 ₪ נתנה לאיתי 7 מיומנות, ורעיון חדש לסצנת הפתיחה.'; }
      else if (id === 'network' && r.cash >= 80) { spend(80); r.contacts += 6; r.reputation += 5; text = 'איתי נפגש עם מפיקה: 80 ₪, עוד 6 קשרים ו־5 מוניטין.'; }
      else if (id === 'develop' && !r.project && r.cash >= 80) {
        spend(80); const type = s.season >= 3 && r.films.some(f => f.type === 'feature') ? 'blockbuster' : s.season >= 2 && r.films.length >= 2 ? 'feature' : 'short';
        const story=Stories.choose(type,null,r.films.map(f=>f.title),random(r));
        r.project = { ...story, type, stage: 'shoot', quality: clamp(20 + Math.round(r.craft * 0.35), 0, 100), budget: 80 };
        r.craft += 3; text = 'איתי סגר תסריט ל״' + r.project.title + '״ ב־80 ₪. הצילומים הם היעד הבא.';
      } else if (id === 'shoot' && r.project && r.project.stage === 'shoot') {
        const price = r.project.type === 'blockbuster' ? 6500 : r.project.type === 'feature' ? 2800 : 430;
        if (r.cash >= price) { spend(price); r.project.budget += price; r.project.stage = 'release'; r.project.quality = clamp(r.project.quality + 23 + Math.floor(random(r) * 11), 0, 100); r.craft += 4; text = 'איתי צילם את ״' + r.project.title + '״ בעלות ' + money(price) + '. האיכות כרגע ' + r.project.quality + '.'; }
        else { r.happiness -= 3; text = 'הצילום נדחה: צריך ' + money(price) + ', ולאיתי יש ' + money(r.cash) + '. הוא נשאר עם התסריט ומחפש עבודה.'; }
      } else if (id === 'release' && r.project && r.project.stage === 'release' && r.cash >= 220) {
        spend(220); const p = r.project, quality = clamp(p.quality + 12, 0, 100), flop = random(r) < 0.2;
        const revenue = Math.round((350 + quality * 16) * (p.type === 'blockbuster' ? 5 : p.type === 'feature' ? 2.8 : 1) * (flop ? 0.38 : 1));
        earn(revenue); const rep = flop ? 5 : Math.round(8 + quality * 0.12); r.reputation += rep; r.happiness += flop ? -5 : 8;
        r.films.push({ title: p.title, type: p.type, quality, route: 'commercial', budget: p.budget + 220, revenue, royalty: Math.round(18 + quality * 0.25), releasedWeek: s.week, releasedQuarter: s.life.quarters }); r.project = null;
        text = '״' + p.title + '״ יצא: ' + quality + ' איכות, ' + money(revenue) + ' הכנסות ו־' + rep + ' מוניטין.' + (flop ? ' הקהל היה קטן מהתחזית.' : ' הבכורה הצליחה.');
      } else if (id === 'rest') { r.happiness += 14; text = 'איתי יצא לערב עם חברים. בלי עבודה ועם עוד 14 אושר.'; }
      else { r.happiness += 3; text = 'התוכנית לא הסתדרה בתקציב. איתי לקח הפסקה, בלי הכנסה או הוצאה.'; }
      for (const stat of ['craft', 'reputation', 'contacts', 'happiness']) r[stat] = clamp(r[stat], 0, 100);
      actions.push({ id, label: planned.label, text, cashDelta: r.cash - start.cash, craftDelta: r.craft - start.craft, reputationDelta: r.reputation - start.reputation, contactsDelta: r.contacts - start.contacts });
    }
    const royalties = r.films.reduce((sum, f) => sum + Life.royalty(f, s.life.quarters), 0); earn(royalties);
    spend(DIFFICULTIES[s.difficulty].living); const interest = Math.ceil(r.debt * DIFFICULTIES[s.difficulty].interest); r.debt += interest; expenses += interest;
    if (r.cash < 0) { r.debt -= r.cash; r.cash = 0; }
    const reserve = DIFFICULTIES[s.difficulty].living * 2 + (r.project ? r.project.stage === 'release' ? 220 : r.project.type === 'blockbuster' ? 6500 : r.project.type === 'feature' ? 2800 : 430 : 430);
    const debtRepaid = Math.min(r.debt, Math.max(0, r.cash - reserve));
    r.cash -= debtRepaid; r.debt -= debtRepaid;
    r.happiness = clamp(r.happiness - 3, 0, 100); r.lastReportWeek = s.week; r.progress = raceScore(s, r);
    const report = { week: s.week, royalties, debtRepaid, financeText: debtRepaid ? 'איתי החזיר ' + money(debtRepaid) + ' מקרן החוב. זהו החזר הלוואה, לא הוצאה נוספת.' : '', goal: r.plan.goal, actions, delta: { income, expenses, cash: r.cash - before.cash, wealth: r.cash - r.debt - before.wealth, reputation: r.reputation - before.reputation, craft: r.craft - before.craft, contacts: r.contacts - before.contacts, happiness: r.happiness - before.happiness, films: r.films.length - before.films }, scoreBefore, scoreAfter: r.progress, gapBefore, gapAfter: raceScore(s, s) - r.progress, gapChange: raceScore(s, s) - r.progress - gapBefore, nextPlan: '', dueWeek: s.week + 2 };
    const nextState = Object.assign({}, s, { week: s.week + 1 }); refreshRivalPlan(nextState, true); report.nextPlan = r.nextPlan;
    r.history.push(report); r.weekStartGap = report.gapAfter; return report;
  }
  function note(s, text) {
    s.log.unshift({ week: s.week, text });
    s.log = s.log.slice(0, 50);
  }
  function freshUsage() { return { overtime: 0, work: 0, course: 0, practice: 0, network: 0, mingle: 0, family: 0, fun: 0, meal: 0, borrow: 0, pitch: 0, wedding: 0, ad: 0, lecture: 0, teach_masterclass: 0, jury: 0 }; }
  function createGame(options) {
    options = options || {};
    const difficulty = Object.prototype.hasOwnProperty.call(DIFFICULTIES, options.difficulty) ? options.difficulty : 'normal';
    const config = DIFFICULTIES[difficulty];
    const character = CHARACTERS.find(c => c.id === options.characterId) || CHARACTERS[0];
    const s = {
      version: VERSION, characterId: character.id, name: String(options.name || character.name).trim().slice(0, 30) || character.name, difficulty,
      season: 1, seasonStartedWeek: 1, seasonFilmBase: 0, week: 1, maxWeeks: config.maxWeeks, hours: BASE_HOURS, maxHours: BASE_HOURS, cash: config.startingCash, debt: 800,
      energy: 85, happiness: 62, craft: character.id === 'amir' ? 8 : 12, reputation: 8, contacts: 8, job: 0, location: 'home',
      films: [], project: null, nextProjectId: 1, funding: { application: null, history: [] }, assets: [], event: null, productionAlert: null, log: [], rival: { name: 'איתי', progress: 0, quote: '', location: null },
      status: 'playing', ending: '', weeklySummary: null, rng: seedNumber(options.seed),
      used: freshUsage(), weeklyTotals: { income: 0, expenses: 0 }, crisisWeeks: 0
    };
    s.life = Life.createLife(s);
    s.rival = rivalInitial(s, seedNumber(options.seed) ^ 0x9e3779b9); refreshRivalPlan(s, true); s.rival.progress = raceScore(s, s.rival); s.rival.weekStartGap = raceScore(s, s) - s.rival.progress; refreshLocationBoards(s); s.festivalCircuit = initialFestivalCircuit(s);
    note(s, 'ברוכים הבאים לתעשייה. יש לך 50 שעות בסבב מפתח בתוך כל רבעון. יתר התקופה היא שגרה מאוזנת, בלי 13 חיובים אוטומטיים. מתחילים בגיל 23, עם חלום וחוב קטן.');
    return s;
  }
  function goals(s) {
    const targets = seasonTargets(s);
    return [
      { id: 'wealth', label: 'יציבות כלכלית', value: netWorth(s), target: targets.wealth },
      { id: 'craft', label: 'מיומנות', value: s.craft, target: targets.craft },
      { id: 'reputation', label: 'מוניטין', value: s.reputation, target: targets.reputation },
      { id: 'happiness', label: 'אושר', value: s.happiness, target: targets.happiness }
    ].map(g => Object.assign(g, { percent: clamp(Math.round(g.value / g.target * 100), 0, 100), complete: g.value >= g.target }));
  }
  function getJobTitle(s) { return JOBS[typeof s === 'number' ? s : s.job].title; }
  function addStats(s, changes) {
    for (const key of ['energy', 'happiness', 'craft', 'reputation', 'contacts']) {
      if (changes[key]) s[key] = clamp(s[key] + changes[key], 0, 100);
    }
    if (changes.cash) {
      s.cash += changes.cash;
      if (changes.cash > 0) s.weeklyTotals.income += changes.cash;
      else s.weeklyTotals.expenses -= changes.cash;
    }
  }
  function checkVictory(s) {
    if (s.status === 'playing' && s.debt <= 6500 && !s.event && !s.productionAlert && seasonFilmGoal(s, s.films).met && goals(s).every(g => g.complete)) {
      s.status = 'won'; recordChapter(s);
      withdrawApplication(s, 'הפרק הסתיימה בניצחון; הבקשה נסגרה ללא תשלום.');
      s.ending = s.name + ', הצלחת לבנות קריירה, להוציא סרט, להישאר עם כסף ואפילו ליהנות. איתי שואל אם יש לך תפקיד קטן בשבילו.';
      s.event = null;
      note(s, 'קאט. יש לנו ניצחון! הקרדיט שלך סוף סוף גדול מספיק בשביל שאמא תמצא אותו.');
    }
  }
  function startProject(st,key,storyGenre) {
    const type=FILM_TYPES[key];
          const story = Stories.choose(key, storyGenre, [...st.films, ...st.rival.films, ...(st.rival.project?[st.rival.project]:[])].map(f=>f.title), random(st));
          const { title } = story;
          st.project = { workload: Workload.create(), id: st.nextProjectId++, grantBudget: 0, grantAwarded: 0, grantExpired: 0, dossier: 0, twist: null, setbacks: [], breakthroughs: [], productionIncome: 0, crew: [], dilemmaEligible: true, title, storyGenre: story.storyGenre, pitch: story.pitch, type: key, genre: type.genre, stage: 'script', quality: type.quality + Math.floor(st.craft * 0.2), budget: type.initialCost, startedWeek: st.week, createdQuarter: st.life.quarters };
          addStats(st, { craft: 2 });
    return st.project;
  }
  function filmFunding(p,amount){const grantUsed=Math.min(amount,p.grantBudget||0),crowdUsed=Math.min(amount-grantUsed,p.crowdfunding?.balance||0),contractUsed=Math.min(amount-grantUsed-crowdUsed,p.contract?.balance||0);return {grantUsed,crowdUsed,contractUsed,total:grantUsed+crowdUsed+contractUsed};}
  function spendFilmFunding(p,amount){const f=filmFunding(p,amount);p.grantBudget-=f.grantUsed;if(f.crowdUsed){p.crowdfunding.balance-=f.crowdUsed;p.crowdfunding.spent+=f.crowdUsed;}if(f.contractUsed){p.contract.balance-=f.contractUsed;p.contract.spent+=f.contractUsed;}return f;}
  function payDirector(s,p,milestone){const c=p.contract;if(!c||c.status!=='active'||c[milestone+'PaidWeek']!==null)return;if(milestone==='release'&&(s.week>c.dueWeek||p.quality<c.qualityTarget))return;const fee=c.directorFee/2,commission=Math.round(fee*c.agentRate/100);c[milestone+'PaidWeek']=s.week;c.feePaid+=fee;c.feeCommission+=commission;p.budget+=fee;addStats(s,{cash:fee});if(commission)addStats(s,{cash:-commission});note(s,'שכר בימוי: '+money(fee-commission)+' נטו'+(commission?' לאחר '+money(commission)+' לסוכנת':'')+'.');}
  function getCrowdfunding(s){
    const p=s.project;if(!p)return null;const q=Crowd.quote(p.type),c=p.crowdfunding;
    const hypothetical=c||Crowd.launch(p,s,0);
    const reason=c?'כבר נפתח קמפיין לסרט הזה.':(!['script','shoot'].includes(p.stage)||p.workload?.shootDone>0)?'קמפיין נפתח לפני הצילום, בשלב התסריט או ההכנות לסט.':s.week+2>s.maxWeeks?'אין שתי תקופות לפני סוף הפרק.':retirementRounds(s)<2?'אין שתי תקופות לפני הפרישה.':'';
    return {...q,campaign:c||null,chance:hypothetical.chance,reason,dueWeek:c?.dueWeek||s.week+2,launchActionId:'bank.crowd_launch',promoteActionId:'bank.crowd_promote'};
  }
  function addCrowdfunding(s,add){
    const p=s.project,offer=getCrowdfunding(s);if(!p)return;
    add('crowd_launch','קמפיין מימון המונים','סרטון פנייה, עמוד קמפיין וקהל ראשון. הכל או כלום: הכסף ייכנס רק אם הגיוס יצליח.',{time:3,money:offer.launchCost,energy:5},['יעד: '+money(offer.target),'נטו לסרט בהצלחה: '+money(offer.net),'תוצאה בעוד שתי תקופות',offer.chance+'% סיכוי'],st=>{st.project.crowdfunding=Crowd.launch(st.project,st,random({rng:seedNumber('crowd:'+st.rng+':'+st.project.id)})*100);st.project.budget+=offer.launchCost;},{reason:offer.reason,tag:'מימון המונים'});
    const c=p.crowdfunding;
    if(c?.status==='pending')add('crowd_promote','להרים טלפון לקהל שלך','עדכון קמפיין, שיחה לחברים והבטחה בלי סצנה עם מסוק. אפשר פעם אחת לכל סרט.',{time:2,money:30,energy:4},['תוספת עד 12 נקודות לסיכוי הגיוס'],st=>{Crowd.promote(st.project.crowdfunding);st.project.budget+=30;},{reason:c.promoted?'כבר קידמת את הקמפיין הזה.':c.chance>=85?'הקמפיין כבר בסיכוי המרבי.':'',tag:'מימון המונים'});
  }
  function resolveCrowdfunding(s){
    const c=Crowd.settle(s.project,s.week);if(!c)return;
    const message=c.status==='funded'?'הקמפיין של ״'+s.project.title+'״ הגיע ליעד! אחרי עמלות ותשורות נוספו '+money(c.awarded)+' לתקציב הסרט.':'הקמפיין של ״'+s.project.title+'״ לא הגיע ליעד. התומכים לא חויבו; אפשר להמשיך בהפקה ובקרנות.';
    if(s.weeklySummary)s.weeklySummary.crowdfundingResult={status:c.status,title:s.project.title,text:message,awarded:c.awarded};
    note(s,message);
  }
  function action(s, location, id, title, description, baseCost, effects, apply, options) {
    options = options || {};
    const commute = !options.noCommute && s.location !== location && !owns(s, 'bike') ? 1 : 0;
    const funding = options.filmExpense && s.project ? filmFunding(s.project,baseCost.money||0) : {grantUsed:0,crowdUsed:0,contractUsed:0,total:0}, fundingUsed=funding.grantUsed, crowdUsed=funding.crowdUsed, contractUsed=funding.contractUsed;
    const cost = { time: (baseCost.time || 0) + commute, money: (baseCost.money || 0) - fundingUsed - crowdUsed - contractUsed, energy: baseCost.energy || 0 };
    if (fundingUsed) effects = effects.concat(['מתקציב הקרן: ' + money(fundingUsed)]);
    if (contractUsed) effects = effects.concat(['מתקציב השותף: ' + money(contractUsed)]);
    if (crowdUsed) effects = effects.concat(['ממימון המונים: ' + money(crowdUsed)]);
    let reason = '';
    if (s.status !== 'playing' && !(options.allowEnded && ['won', 'lost'].includes(s.status))) reason = 'המשחק הסתיים. מתחילים סיפור חדש?';
    else if (s.productionAlert) reason = 'קודם מאשרים את העדכון החדש מההפקה.';
    else if (s.event) reason = 'קודם בוחרים מה לעשות באירוע הפתוח.';
    else if (options.careerTier && getCareer(s).tier < options.careerTier) reason = careerGate(s, options.careerTier);
    else if (options.reason) reason = options.reason;
    else if (options.limit && s.used[options.limit[0]] >= options.limit[1]) reason = 'כבר עשית את זה מספיק בסבב הזה. בסבב הבא נפתח מחדש.';
    else if (s.hours < cost.time) reason = 'צריך ' + cost.time + ' שעות פנויות' + (commute ? ' כולל נסיעה.' : '.');
    else if (s.cash < cost.money) reason = 'חסרים ' + money(cost.money - s.cash) + ' במזומן.';
    else if (s.energy < cost.energy) reason = 'צריך לפחות ' + cost.energy + ' אנרגיה. כדאי לנוח או לאכול.';
    title=Local.localCopy(title,s.life.cityId);description=Local.localCopy(description,s.life.cityId);reason=Local.localCopy(reason,s.life.cityId);
    return { id: location + '.' + id, title, description, cost, fundingUsed, crowdUsed, contractUsed, networkKind: options.networkKind || null, personId: options.personId || null, contractOffer: options.contractOffer || null, workDays: options.workDays || 0, workProgress: options.workProgress || null, careerTier: options.careerTier || 0, careerLocked: Boolean(options.careerTier && getCareer(s).tier < options.careerTier), forecast: options.forecast || null, lifeOffer: Boolean(options.lifeOffer), lifeCategory: options.lifeCategory || '', cityOffer: Boolean(options.cityOffer), trade: options.trade || null, weeklyOffer: Boolean(options.weeklyOffer), offerEndsWeek: options.offerEndsWeek || null, offerUsed: Boolean(options.offerUsed), crewOffer: Boolean(options.crewOffer), crewRole: options.crewRole || '', fitLabel: options.fitLabel || '', qualityBonus: options.qualityBonus || 0, festivalSubmission: Boolean(options.festivalSubmission), festivalId: options.festivalId || '', filmId: options.filmId || null, effects, disabled: Boolean(reason), reason, tag: options.tag || '', commute, _location: location, _apply: apply, _usage: options.limit ? options.limit[0] : null };
  }
  function actionsFor(s, location, storyGenre) {
    const list = [];
    const add = (id, title, description, cost, effects, apply, opts) => list.push(action(s, location, id, title, description, cost, effects, apply, opts));
    const p = s.project;
    if (location === 'bank') addCrowdfunding(s,add);
    if (location === 'home') {
      add('overtime',s.used.overtime?'עוד ערב אחד. באמת אחרון.':'לפתוח עוד 5 שעות ביומן','דוחים זמן אישי כדי להספיק עוד. ההארכה השנייה מעייפת יותר; אין תוספת כסף אוטומטית.',{energy:s.used.overtime?16:8},['+5 שעות זמינות',s.used.overtime?'−6 אושר':'−3 אושר'],st=>{st.hours+=5;st.maxHours+=5;addStats(st,{happiness:st.used.overtime===2?-6:-3});},{noCommute:true,limit:['overtime',2],reason:s.hours>10?'אפשר להאריך את השבוע כשנותרו עד 10 שעות ביומן.':'',tag:'זמן אישי'});
      add('rest', 'שנ״צ בלי רגשות אשמה', 'הטלפון על שקט. למנהל ההפקה זה יעבור.', { time: 6 }, ['+28 אנרגיה', '+4 אושר'], st => addStats(st, { energy: 28, happiness: 4 }), { tag: 'התאוששות' });
      add('family', 'ארוחה עם אנשים מחוץ לתעשייה', 'אף אחד לא שואל באיזו מצלמה צילמת. מרענן.', { time: 4 }, ['+14 אושר', '+10 אנרגיה'], st => addStats(st, { happiness: 14, energy: 10 }), { limit: ['family', 1], tag: 'חיים' });
      for (const key of Object.keys(FILM_TYPES)) {
        const type = FILM_TYPES[key];
        add('start_' + key, 'לפתח ' + type.label, type.description || (key === 'doc' ? 'סיפור קרוב לבית: צילום זול ומוניטין טוב בפסטיבלים.' : key === 'comedy' ? 'צילומים יקרים יותר, אבל קהל משלם אוהב לצחוק.' : 'מחווה אינטימית לאנשים שבאמת צריכים טיפול.'), { time: 6, money: type.initialCost, energy: 6 }, ['מתחילים תסריט',Workload.DAYS[key].shoot+' ימי צילום · '+Workload.DAYS[key].edit+' ימי עריכה', 'צילום בסיסי: ' + money(type.shootCost), '+2 מיומנות'], st => {
          startProject(st,key,storyGenre);
        }, { reason: p ? 'יש כבר סרט בתהליך. קודם מוציאים אותו לעולם.' : '', tag: 'סרט חדש', careerTier: type.careerTier || 0 });
      }
      add('write', 'לסיים תסריט', 'מוחקים את החלום, את הקריינות ואת הסצנה עם המסוק.', { time: 6, energy: 8 }, ['התסריט מוכן לצילום', '+12 איכות', '+4 מיומנות'], st => { st.project.stage = 'shoot'; st.project.quality = clamp(st.project.quality + 12, 0, 100); addStats(st, { craft: 4 }); }, { reason: !p || p.stage !== 'script' ? 'צריך להתחיל סרט בשלב התסריט.' : '', tag: 'הסרט שלך' });
    }
    if (location === 'set') {
      const job = JOBS[s.job];
      const wage = workPay(s, job.wage, true);
      add('work', 'משמרת: ' + job.title, job.description, { time: job.hours, energy: job.energy }, ['+' + money(wage), '+1 מיומנות', '+1 קשרים'].concat(s.characterId === 'tamar' ? ['−2 אושר'] : []), st => addStats(st, { cash: wage, craft: 1, contacts: 1, happiness: st.characterId === 'tamar' ? -2 : 0 }), { limit: ['work', 3], tag: 'פרנסה' });
      const next = JOBS[s.job + 1];
      const missing = next ? [s.craft < next.craft ? next.craft + ' מיומנות' : '', s.contacts < next.contacts ? next.contacts + ' קשרים' : '', s.reputation < next.reputation ? next.reputation + ' מוניטין' : '', next.film && !s.films.length ? 'סרט שיצא לאור' : ''].filter(Boolean) : [];
      add('promote', next ? 'להתקדם: ' + next.title : 'כבר בראש הקרדיטים', next ? 'לא מספיק ״אני מכיר מישהו״. צריך גם להראות מה עשית.' : 'ההצלחה הבאה תלויה בסרט שלך.', { time: 3, energy: 4 }, next ? ['שכר משמרת: ' + money(workPay(s, next.wage, true)), '+5 אושר'] : [], st => { st.job += 1; addStats(st, { happiness: 5 }); }, { reason: !next ? 'הגעת לתפקיד הבכיר ביותר.' : missing.length ? 'נדרשים: ' + missing.join(', ') + '.' : '', tag: 'קידום' });
      const type = p ? FILM_TYPES[p.type] : FILM_TYPES.short;
      for (const full of [false, true]) {
        const w=Workload.view(p)||{shoot:1,shootDone:0,legacy:true},mode=full?'full':'lean';
        const count=1,improvised=!full&&s.characterId==='kobi',foreign=p?.contract?.kind==='copro';
        const city=foreign?Life.CITIES.find(c=>c.id===p.contract.productionCity):Life.city(s);
        const totalPrice=Math.round((type.shootCost+(full?450:0))*(owns(s,'camera')?.65:1)*(improvised?.85:1)*(owns(s,'studio_property')?.85:1)*city.productionMultiplier)+(foreign?200:0);
        const price=Workload.slice(totalPrice,w.shootDone,count,w.shoot),quality=Workload.slice((full?25:13)+(owns(s,'camera')?8:0)+Math.floor((w.shootCraft??s.craft)*.12),w.shootDone,count,w.shoot),craft=Workload.slice(5,w.shootDone,count,w.shoot);
        const done=w.shootDone+count>=w.shoot;
        const title=(w.legacy?'צילום הסרט':'יום צילום')+(full?' עם צוות מסודר':' עם חברים');
        add('shoot_'+mode,title,(foreign?'הצילומים ב'+city.title+' עם השותפה; החזרה הביתה כלולה בתוכנית. ':'')+(full?'סאונד, תאורה וצוות בתשלום.':'תרמוס, תכנון והרבה אלתורים.'),{time:(w.legacy?(full?14:12)+(type.careerTier?type.careerTier*2:0):10*count)+(foreign&&w.shootDone===0?3:0),money:price,energy:w.legacy?(full?19:23)+(type.careerTier?6:0):(full?12:15)*count},[...(done?['הצילום יושלם; עוברים לעריכה']:[]), '+'+quality+' איכות'+(done&&improvised?' עם שינוי אקראי של 3− עד 3+':''), '+'+craft+' מיומנות'],st=>{
          if(st.project.workload){st.project.workload.shootCraft??=st.craft;st.project.workload.shootDone+=count;st.project.workload.shootMode=mode;}
          const variance=done&&improvised?Math.floor(random(st)*7)-3:0;
          st.project.quality=clamp(st.project.quality+quality+variance,0,100);st.project.budget+=price;addStats(st,{craft});
          if(done){st.project.stage='edit';st.project.shootStyle=mode;if(improvised)note(st,'האלתור של קובי: '+(variance>=0?'+':'')+variance+' איכות בצילום.');if(st.project.dilemmaEligible&&!st.project.twist)st.event=makeProductionEvent(st,full);}
        },{reason:!p||p.stage!=='shoot'?'צריך תסריט גמור שמחכה לצילום.':w.shootMode&&w.shootMode!==mode?'ממשיכים עם מסגרת הצוות שנבחרה ביום הראשון.':'',tag:'הסרט שלך',filmExpense:true,workDays:count,workProgress:p&&{phase:'shoot',done:w.shootDone,total:w.shoot,mode}});
      }
    }
    if (location === 'school') {
      add('course', 'סדנת בימוי מעשית', 'חצי יום על מבט אחד. הפעם דווקא לומדים משהו.', { time: 6, money: 220, energy: 8 }, ['+9 מיומנות', '+2 קשרים'], st => addStats(st, { craft: 9, contacts: 2 }), { limit: ['course', 1], tag: 'לימודים' });
      add('masterclass', 'כיתת אמן: לספר סיפור', 'מותר להשתמש בפאוזה. לא בכל המשפטים.', { time: 5, money: 420, energy: 9 }, ['+12 מיומנות', '+3 מוניטין'], st => addStats(st, { craft: 12, reputation: 3 }), { limit: ['course', 1], reason: s.craft < 40 ? 'צריך 40 מיומנות כדי להפיק מזה משהו.' : '', tag: 'מתקדמים' });
    }
    if (location === 'cafe') {
      add('network', 'קפה עם מפיקה', '״נדבר אחרי החגים״ נחשב כאן לקשר מקצועי.', { time: 4, money: 100, energy: 5 }, ['+' + (s.characterId === 'amir' ? 11 : 8) + ' קשרים', '+3 מוניטין', '+3 אושר'], st => addStats(st, { contacts: st.characterId === 'amir' ? 11 : 8, reputation: 3, happiness: 3 }), { limit: ['network', 1], tag: 'קשרים' });
      add('meal', 'לאכול משהו שאינו קפה', 'פיתה, סלט, וחזרה של צבע לפנים.', { time: 2, money: 60 }, ['+24 אנרגיה', '+3 אושר'], st => addStats(st, { energy: 24, happiness: 3 }), { limit: ['meal', 2], tag: 'התאוששות' });
      add('fun', 'ערב בלי לדבר על פרויקטים', 'נשברת אחרי עשרים דקות. עדיין נחשב.', { time: 4, money: 120 }, ['+17 אושר', '+8 אנרגיה'], st => addStats(st, { happiness: 17, energy: 8 }), { limit: ['fun', 1], tag: 'חיים' });
      add('pitch', 'פיץ׳ למפיקים', 'תשעים שניות להסביר למה הציבור צריך עוד סרט על משפחה.', { time: 4, energy: 9 }, ['+7 מוניטין', '+3 קשרים'], st => addStats(st, { reputation: 7, contacts: 3 }), { limit: ['pitch', 1], reason: !s.films.length ? 'צריך לפחות סרט אחד שיצא לאור.' : s.contacts < 25 ? 'צריך 25 קשרים כדי לקבל מקום בפגישה.' : '', tag: 'תעשייה' });
    }
    if (location === 'studio') {
      const gain = owns(s, 'desk') ? 6 : 4;
      add('practice', 'לערוך סצנת אימון', 'שני אנשים, מטבח אחד, ותשע דרכים לסבך את זה.', { time: 4, money: 40, energy: 6 }, ['+' + gain + ' מיומנות'], st => addStats(st, { craft: gain }), { limit: ['practice', 1], tag: 'תרגול' });
      for (const polish of [false, true]) {
        const w=Workload.view(p)||{edit:1,editDone:0,legacy:true},mode=polish?'polish':'basic';
        const count=1,projectTier=p?FILM_TYPES[p.type].careerTier||0:0;
        const totalPrice=Math.round(((polish?480:250)+projectTier*350-(owns(s,'laptop')?150:0))*(owns(s,'studio_property')?.85:1)*Life.city(s).productionMultiplier);
        const price=Workload.slice(totalPrice,w.editDone,count,w.edit),quality=Workload.slice((polish?24:13)+(owns(s,'laptop')?8:0)+Math.floor((w.editCraft??s.craft)*.1)+(s.characterId==='noa'?8:0),w.editDone,count,w.edit),craft=Workload.slice(5,w.editDone,count,w.edit),done=w.editDone+count>=w.edit;
        add(polish?'edit_polish':'edit',(w.legacy?'לנעול עריכה':'יום עריכה')+(polish?' עם צבע וסאונד':''),done?'מבט אחרון על הקצב, המיקס והקרדיטים.':'עובדים על עוד חלק בסרט. התיקייה ״כמעט סופי״ עוד איתנו.',{time:(w.legacy?(polish?12:9)+projectTier:(polish?9:8)*count)-(owns(s,'laptop')?count:0)+(s.characterId==='noa'?count:0),money:price,energy:w.legacy?(polish?15:11):(polish?10:8)*count},[...(done?['העריכה תושלם; מוכן להפצה']:[]),'+'+quality+' איכות','+'+craft+' מיומנות'],st=>{if(st.project.workload){st.project.workload.editCraft??=st.craft;st.project.workload.editDone+=count;st.project.workload.editMode=mode;}if(done)st.project.stage='release';st.project.quality=clamp(st.project.quality+quality,0,100);st.project.budget+=price;addStats(st,{craft});},{reason:!p||p.stage!=='edit'?'צריך חומר מצולם שמחכה לעריכה.':w.editMode&&w.editMode!==mode?'ממשיכים במסלול העריכה שכבר התחיל.':'',tag:'הסרט שלך',filmExpense:true,workDays:count,workProgress:p&&{phase:'edit',done:w.editDone,total:w.edit,mode}});
      }
      addRelease(s, add, false);
    }
    if (location === 'festival') {
      add('mingle', 'הקרנה ושיחת מסדרון', 'מחיאות כפיים, שאלת קהל שהופכת להרצאה, ושני מספרי טלפון.', { time: 3, money: 90, energy: 4 }, ['+5 מוניטין', '+4 קשרים', '+4 אושר'], st => addStats(st, { reputation: 5, contacts: 4, happiness: 4 }), { limit: ['mingle', 1], tag: 'תעשייה' });
      addRelease(s, add, true);
    }
    if (location === 'gear') {
      for (const key of Object.keys(ASSETS).filter(key => !ASSETS[key].propertyValue)) {
        const item = ASSETS[key];
        add('buy_' + key, item.title, item.description, { time: 2, money: item.price }, [item.benefit], st => { st.assets.push(key); }, { reason: owns(s, key) ? 'כבר שלך. רפי ניסה למכור שוב, אבל שמת לב.' : '', tag: 'השקעה קבועה' });
      }
    }
    addCrewActions(s, location, add);
    if (location === 'festival') addFestivalActions(s, add);
    addLocationOffers(s, location, add);
    addCareerActions(s, location, add);
    addLifeActions(s, location, add);
    addLocalActions(s, location, add);
    addNetworkActions(s, location, add);
    if (location === 'bank') {
      addFundingActions(s, add);
      const config = DIFFICULTIES[s.difficulty];
      add('borrow', 'הלוואת גישור: 700 ₪', 'ריבית לסבב ' + (config.interest * 100).toFixed(1).replace('.0', '') + '%. כסף שנכנס עם תאריך תפוגה.', { time: 2 }, ['+700 ₪ במזומן', '+700 ₪ חוב'], st => { st.cash += 700; st.debt += 700; }, { limit: ['borrow', 1], reason: s.debt + 700 > 4000 ? 'הבנק עוצר הלוואות מעל חוב של 4,000 ₪.' : '', tag: 'הלוואה' });
      const partial = Math.min(500, s.debt);
      add('repay', 'להחזיר ' + money(partial) + ' מהחוב', 'לא זוהר. מאוד מספק.', { time: 1, money: partial }, ['−' + money(partial) + ' חוב'], st => { st.debt -= partial; st.weeklyTotals.expenses -= partial; }, { reason: s.debt <= 0 ? 'אין חוב. לימור לא מאמינה שזה קורה.' : '', tag: 'כסף' });
      add('repay_all', 'לסגור את החוב', 'הדרך היחידה לגרום לבנק להפסיק להתקשר.', { time: 1, money: s.debt }, ['−' + money(s.debt) + ' חוב'], st => { st.weeklyTotals.expenses -= st.debt; st.debt = 0; }, { reason: s.debt <= 0 ? 'אין חוב. אפשר לנשום.' : '', tag: 'כסף' });
    }
    return list;
  }
  function addNetworkActions(s,location,add){
    const n=Network.state(s),tier=getCareer(s).tier,p=s.project;
    const opts=(kind,person,extra={})=>({networkKind:kind,personId:person?.id||null,tag:'מפגש בתעשייה',...extra});
    const cooldown=n.lastContractWeek&&s.week<n.lastContractWeek+6?'נותנים לחוזה הקודם להתקדם. הצעה חדשה מתקופה '+(n.lastContractWeek+6)+'.':'';
    if(location==='cafe'){
      for(const person of Network.visitors(s)){
        const c=n.contacts[person.id];
        if(!c||c.meetings<2)add('network_meet_'+person.id,c?'פגישת המשך עם '+person.name:'להכיר את '+person.name,c?'כבר זוכרים את הסרט שלך. הפעם השיחה מגיעה גם לעבודה.':'״שלח לי משהו״. הפעם גם מחליפים טלפון אמיתי.',{time:3,money:70,energy:4},['+5 קשרים',c?'פותחים שיחה על שיתוף פעולה':'היכרות ראשונה; אפשר להיפגש שוב בעוד שתי תקופות'],st=>{Network.meet(st,person.id);addStats(st,{contacts:5});},opts('meet',person,{reason:c&&s.week<c.lastWeek+2?'פגישת המשך מתקופה '+(c.lastWeek+2)+'.':''}));
        else if(person.role==='agent'&&!n.agent)add('network_sign_'+person.id,'ייצוג עם '+person.name,'ללא דמי הצטרפות. 10% רק מעבודות שהסוכנת מביאה ומשכר בימוי בחוזים שנחתמים בזמן הייצוג. אפשר להיפרד בקפה.',{time:2,energy:2},['הצעות עבודה דרך הסוכנת','אין עמלה על עבודות רגילות, קרנות, פרסים או תמלוגים'],st=>{Network.ensure(st).agent={personId:person.id,signedWeek:st.week};},opts('agent',person,{careerTier:1}));
        else if(person.role!=='agent'){
          const o=Network.offer(s,person,tier),producer=o.kind==='producer';
          const reason=cooldown||(producer?(p?'קודם משלימים את הסרט שבתהליך.':''):!p?'קופרודוקציה מתחילה מסרט שלך בתסריט או בהכנות לצילום.':p.contract?'כבר יש שותף מממן לסרט הזה.':!['script','shoot'].includes(p.stage)||p.workload?.shootDone?'השותפות נחתמת לפני יום הצילום הראשון.':'');
          add('network_contract_'+person.id,producer?'הצעת סרט מ'+person.name:'קופרודוקציה עם '+person.name,producer?'מימון ושכר בימוי, תמורת בכורה מסחרית וחלק מההכנסות. נשאר מקום לקול שלך.':'הסיפור שלך, שותפה נוספת וצילומים בחו״ל. הבית נשאר בעיר הנוכחית.',{time:4,energy:5},[money(o.awarded)+' להוצאות הסרט בלבד',money(o.directorFee)+' שכר בימוי בשתי פעימות',o.share+'% מהכנסות הבכורה לשותף'],st=>{const film=producer?startProject(st,o.type,'comedy'):st.project;film.contract=Network.contract(st,film,o,producer?FILM_TYPES[o.type].initialCost:0);Network.ensure(st).lastContractWeek=st.week;},opts('contract',person,{careerTier:producer?1:2,reason,contractOffer:o}));
        }
      }
      if(n.agent){const person=Network.person(n.agent.personId),gross=workPay(s,900+Math.max(0,tier-1)*400,false),fee=Math.round(gross*.1);
        add('network_gig','עבודה מ'+person.name,'בימוי סרטון תדמית ללקוח ששינה בריף רק פעמיים. הסוכנת כבר סגרה מחיר.',{time:8,energy:18},['+'+money(gross-fee)+' נטו','שכר '+money(gross)+' פחות '+money(fee)+' עמלה','+2 מוניטין'],st=>{addStats(st,{cash:gross,reputation:2});addStats(st,{cash:-fee});Network.ensure(st).gigLastWeek=st.week;},opts('gig',person,{reason:n.gigLastWeek&&s.week<n.gigLastWeek+3?'הסוכנת מחפשת את העבודה הבאה. הצעה מתקופה '+(n.gigLastWeek+3)+'.':''}));
        add('network_end_agent','לסיים את הייצוג','בלי קנס יציאה. העמלה בחוזי הסרטים שכבר נחתמו נשארת כפי שסוכם.',{time:1},['מפסיקים לקבל עבודות דרך הסוכנת'],st=>{Network.ensure(st).agent=null;},opts('agent_end',person));
      }
    }
    if(location==='festival'){
      const entry=[...s.festivalCircuit.history].reverse().find(e=>['selected','award'].includes(e.outcome)&&!n.festivalMeetings.includes(e.id)&&s.week<=e.resolvedWeek+6);
      if(entry){const person=Network.person('copro_'+s.life.cityId);add('network_festival_'+entry.id,'שיחה אחרי ההקרנה עם '+person.name,'היא ראתה את ״'+entry.filmTitle+'״ ב'+entry.festivalTitle+'. הפעם לא צריך להסביר מה עשית.',{time:3,money:90,energy:4},['+6 קשרים','היכרות עם מפיקה בינלאומית; ההמשך בקפה'],st=>{Network.ensure(st).festivalMeetings.push(entry.id);Network.meet(st,person.id);addStats(st,{contacts:6});},opts('festival',person));}
    }
    if(location==='bank'&&s.week%4===0&&n.bankLastWeek!==s.week){
      const rate=DIFFICULTIES[s.difficulty].interest,extra=Math.ceil((s.debt+1400)*rate)-Math.ceil(s.debt*rate),name=Local.npcName(s.life.cityId,'bank')||'הבנקאית';
      add('network_loan',name+' על הקו: ״כסף שיזיז את הסרט״','״חבל לעכב יצירה בגלל תזרים״. הלוואה של 1,400 ₪, פחות 70 ₪ עמלת פתיחה. הריבית מתווספת לחוב בכל תקופה עד להחזר.',{time:2},['1,330 ₪ נכנסים לעו״ש','1,400 ₪ נוספים לחוב',Math.round(rate*1000)/10+'% ריבית לתקופה','תוספת ריבית קרובה: '+money(extra)],st=>{st.cash+=1330;st.debt+=1400;st.weeklyTotals.expenses+=70;Network.ensure(st).bankLastWeek=st.week;},opts('loan',null,{limit:['borrow',1],reason:s.debt+1400>5000?'ההצעה אינה זמינה כשסך החוב יעבור 5,000 ₪.':''}));
    }
  }
  const LOCATION_OFFERS = {
    cafe: [
      { id: 'table_read', title: 'הקראה סביב השולחן', description: 'שלושה חברים קוראים את התסריט בקול. פתאום שומעים מה לא עובד.', cost: { time: 3, money: 90, energy: 4 }, stats: { craft: 2 }, quality: 6, stages: ['script', 'shoot'], filmExpense: true },
      { id: 'editor_coffee', title: 'העורכת התפנתה לקפה', description: 'הפגישה הבאה שלה בוטלה. חצי שעה של עצות שלא תמצא במדריך.', cost: { time: 3, money: 70, energy: 3 }, stats: { contacts: 5, craft: 2 } },
      { id: 'producer_cancelled', title: 'המפיקה נשארה בלי פגישה', description: 'יש לה זמן לשמוע רעיון. רק בלי להתחיל ב״זה כמו נטפליקס, אבל״.', cost: { time: 4, energy: 5 }, stats: { contacts: 7, reputation: 2 }, tier: 1 },
      { id: 'alumni_table', title: 'שולחן בוגרי המחזור', description: 'כולם נראים עסוקים. לפחות ארבעה מהם עדיין זוכרים אותך.', cost: { time: 3, money: 60, energy: 2 }, stats: { contacts: 4, happiness: 5 } },
      { id: 'open_mic', title: 'ערב פיצ׳ים פתוח', description: 'שלוש דקות על במה קטנה. המצגת שלך כבר ארוכה מהסרט.', cost: { time: 3, money: 40, energy: 6 }, stats: { reputation: 5, contacts: 2 } },
      { id: 'last_minute_clip', title: 'קליפ קטן למחר בבוקר', description: 'הלהקה בשולחן ליד צריכה קליפ קצר. הפעם יש גם תקציב.', cost: { time: 5, energy: 12 }, stats: { cash: 520, happiness: -3 } },
      { id: 'rough_cut', title: 'צפייה בגרסה עם עיניים חדשות', description: 'מקרינים קטע מהמחשב ומבקשים ביקורת. לא כולם אומרים ״מהמם״.', cost: { time: 4, money: 110, energy: 5 }, stats: { contacts: 2 }, quality: 8, stages: ['edit', 'release'], filmExpense: true },
      { id: 'old_client', title: 'לקוח ישן צריך גרסה קצרה', description: '״רק להוציא מהחומרים שיש כבר״. הפעם זה באמת מהחומרים שיש כבר.', cost: { time: 3, energy: 6 }, stats: { cash: 400, contacts: 2 } },
      { id: 'roof_escape', title: 'השולחן שעל הגג', description: 'שקיעה, לימונדה, ואיסור זמני על המילה ״פרויקט״.', cost: { time: 3, money: 50 }, stats: { happiness: 11, energy: 8 } },
      { id: 'festival_guest', title: 'אורחת מפסטיבל התיישבה לידך', description: 'אפשר לדבר על הסרטים שלה. לא חייבים להתחיל בשלך.', cost: { time: 3, money: 120, energy: 5 }, stats: { reputation: 7, contacts: 4 }, tier: 2 },
      { id: 'talk_followup', title: 'שיחת המשך בתשלום', description: 'מישהו מההרצאה רוצה ייעוץ קצר על הסרט שלו. הוא גם קרא את המחיר.', cost: { time: 2, energy: 4 }, stats: { cash: 350, craft: 2 }, tier: 1 },
      { id: 'film_quiz', title: 'חידון קולנוע בזוגות', description: 'את השאלה על ברגמן ידעת. את הפרס חלקת עם מישהי שמכירה מפיקים.', cost: { time: 3, money: 80, energy: 4 }, stats: { reputation: 4, happiness: 6 } }
    ],
    gear: [
      { id: 'bike_bargain', title: 'זוג מתקפל מתצוגה', description: 'האופניים נשארו מהפקה קודמת. רפי בדק: מתקפלים, וגם נפתחים.', cost: { time: 2 }, asset: 'bike', discount: 0.25 },
      { id: 'desk_bargain', title: 'פינת עבודה מתערוכה', description: 'שריטה קלה בצד, מקום נורמלי לעבוד באמצע.', cost: { time: 2 }, asset: 'desk', discount: 0.25 },
      { id: 'laptop_bargain', title: 'מחשב מתצוגה עם אחריות', description: 'עברו עליו הרבה מצגות. לפחות אף אחד לא ניסה לערוך עליו סרט חתונה.', cost: { time: 2 }, asset: 'laptop', discount: 0.20 },
      { id: 'camera_bargain', title: 'מצלמה מהשכרה במחיר חבר', description: 'התריס עבד, המחיר ירד. אותה תועלת כמו מצלמה חדשה במשחק.', cost: { time: 2 }, asset: 'camera', discount: 0.25 },
      { id: 'sound_workshop', title: 'בוקר בדיקות מיקרופונים', description: 'לומדים לשמוע מזגן לפני שכל הדיאלוג כבר צולם איתו.', cost: { time: 3, money: 100, energy: 4 }, stats: { craft: 6 } },
      { id: 'light_demo', title: 'רפי מדגים תאורה קטנה', description: 'שני פנסים וקרטון לבן. פתאום זה נראה יקר יותר מהקבלה.', cost: { time: 3, money: 60, energy: 4 }, stats: { craft: 4, happiness: 3 } },
      { id: 'gear_shift', title: 'משמרת בדיקת ציוד', description: 'החזרות מסוף בסבב הזה מחכות למישהו שיודע מה חסר בערכה.', cost: { time: 4, energy: 10 }, stats: { cash: 440, craft: 2 } },
      { id: 'crew_cleanup', title: 'צוותי ההפקה מחזירים ציוד', description: 'עוזרים לסדר ומכירים את מי שבאמת יודע איפה הכבלים.', cost: { time: 3, energy: 5 }, stats: { happiness: 6, contacts: 4 } },
      { id: 'last_battery', title: 'ערכת גיבוי לצילום הנוסף', description: 'עוד סוללה וכרטיס תקין נותנים לך לצלם את ההשלמה שוויתרת עליה.', cost: { time: 2, money: 65, energy: 3 }, stats: {}, quality: 5, stages: ['shoot', 'edit'], filmExpense: true },
      { id: 'color_slot', title: 'התפנה חדר צבע לשעה', description: 'מישהו ביטל. מתקנים את הסצנה שבה כל בני המשפחה נראים ירוקים.', cost: { time: 3, money: 130, energy: 5 }, stats: {}, quality: 7, stages: ['edit', 'release'], filmExpense: true },
      { id: 'manufacturer_demo', title: 'הדגמה סגורה של היצרן', description: 'נוגעים בציוד יקר ופוגשים אנשים שמותר להם לגעת בו כל יום.', cost: { time: 3, energy: 5 }, stats: { craft: 5, reputation: 3, contacts: 3 }, tier: 2 },
      { id: 'sponsor_demo', title: 'סרטון הדגמה לחנות', description: 'רפי רוצה שיסבירו את העדשה במילים שאינן ״בוקה חלומי״.', cost: { time: 4, energy: 8 }, stats: { cash: 700, reputation: 3, happiness: -3 }, tier: 3 }
    ]
  };
  function refreshLocationBoards(s) {
    if (!s.locationBoards) s.locationBoards = { week: 0, rng: seedNumber(s.rng ^ 0x6a09e667), cafe: { offerIds: [], usedIds: [] }, gear: { offerIds: [], usedIds: [] } };
    const boards = s.locationBoards;
    if (boards.week === s.week) return;
    const tier = getCareer(s).tier;
    for (const location of ['cafe', 'gear']) {
      const previous = boards[location].offerIds;
      const pool = LOCATION_OFFERS[location].filter(offer => (offer.tier || 0) <= tier && (!offer.asset || !owns(s, offer.asset)) && (!offer.stages || s.project));
      const shuffled = pool.slice();
      for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(random(boards) * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
      const chosen = [];
      for (const offer of shuffled) {
        if (chosen.length === 3) break;
        if (offer.stages && chosen.some(item => item.stages)) continue;
        chosen.push(offer);
      }
      if (previous.length && chosen.every(offer => previous.includes(offer.id))) {
        const fresh = shuffled.find(offer => !previous.includes(offer.id));
        if (fresh) { const projectIndex = chosen.findIndex(offer => offer.stages); chosen[fresh.stages && projectIndex >= 0 ? projectIndex : chosen.length - 1] = fresh; }
      }
      boards[location] = { offerIds: chosen.map(offer => offer.id), usedIds: [] };
    }
    boards.week = s.week;
  }
  function getLocationBoard(s, location) {
    if (!s || !s.locationBoards || !['cafe', 'gear'].includes(location)) return null;
    const board = s.locationBoards[location];
    return { title: location === 'cafe' ? 'בסבב הזה על הלוח בקפה' : 'בסבב הזה אצל '+(Local.npcName(s.life.cityId,'gear')||'רפי'), week: s.locationBoards.week, remaining: Math.max(0, 2 - board.usedIds.length), limit: 2, offerEndsWeek: s.locationBoards.week, description: 'שלוש הזדמנויות מתחלפות; אפשר לבחור עד שתיים במקום הזה בכל שבוע. חוזרים בסבב הבא ללוח חדש.' };
  }
  function addLocationOffers(s, location, add) {
    if (!s.locationBoards || !['cafe', 'gear'].includes(location)) return;
    const board = s.locationBoards[location];
    for (const id of board.offerIds) {
      const offer = LOCATION_OFFERS[location].find(item => item.id === id), asset = offer.asset ? ASSETS[offer.asset] : null;
      const cost = Object.assign({}, offer.cost, asset ? { money: Math.round(asset.price * (1 - offer.discount)) } : {});
      const stats = Object.assign({}, offer.stats || {}); if (stats.cash) stats.cash = workPay(s, stats.cash, false);
      const effects = Object.entries(stats).map(([key, value]) => key === 'cash' ? '+' + money(value) : (value > 0 ? '+' : '') + value + ' ' + ({ craft: 'מיומנות', reputation: 'מוניטין', contacts: 'קשרים', happiness: 'אושר', energy: 'אנרגיה' })[key]);
      if (offer.quality) effects.push('+' + offer.quality + ' איכות לסרט');
      if (asset) effects.push(asset.benefit, Math.round(offer.discount * 100) + '% פחות מהמחיר הרגיל (' + money(asset.price) + ')');
      const used = board.usedIds.includes(id);
      const reason = used ? 'כבר בחרת בהזדמנות הזו בסבב הזה.' : board.usedIds.length >= 2 ? 'שתי ההזדמנויות במקום הזה כבר נוצלו. הלוח מתחלף בסבב הבא.' : asset && owns(s, offer.asset) ? 'הציוד הזה כבר שלך. אי אפשר לקנות עותק נוסף.' : offer.stages && (!s.project || !offer.stages.includes(s.project.stage)) ? 'ההזדמנות דורשת סרט בשלב ' + offer.stages.map(stage => ({ script: 'התסריט', shoot: 'לפני הצילום', edit: 'העריכה', release: 'לפני הבכורה' })[stage]).join(' או ') + '.' : '';
      add('offer_' + id, offer.title, offer.description, cost, effects, st => {
        if (asset) st.assets.push(offer.asset);
        if (offer.quality) st.project.quality = clamp(st.project.quality + offer.quality, 0, 100);
        if (offer.filmExpense) st.project.budget += cost.money || 0;
        addStats(st, stats); st.locationBoards[location].usedIds.push(id);
      }, { reason, careerTier: offer.tier || 0, tag: 'בסבב הזה בעיר', weeklyOffer: true, offerEndsWeek: s.locationBoards.week, offerUsed: used, filmExpense: Boolean(offer.filmExpense) });
    }
  }

  function initialFestivalCircuit(s) { return { rng: seedNumber(s.rng ^ 0xbb67ae85), pending: [], history: [] }; }
  function crewOptions(s) {
    return Industry.getCrewOptions(s.project).map(person => Object.assign({}, person, Local.crewIdentity(person,s.life.cityId), { location: person.role === 'camera' || (person.role === 'sound' && s.project && s.project.stage === 'shoot') ? 'set' : 'studio' }));
  }
  function addCrewActions(s, location, add) {
    if (!['set', 'studio'].includes(location)) return;
    for (const person of crewOptions(s).filter(person => person.location === location)) {
      const gain = s.project ? Math.min(person.qualityBonus, 100 - s.project.quality) : person.qualityBonus;
      add('crew_' + person.id, 'לצרף לצוות: ' + person.displayTitle, person.description + (person.remote?' העבודה מרחוק, עם יעל בישראל.':'') + ' ' + person.fitLabel, { time: 2, money: person.cost, energy: 3 }, ['+' + gain + ' איכות, מיד עם הצטרפות לצוות', 'איש מקצוע אחד לתפקיד ' + person.roleLabel + ' בכל סרט'], st => {
        st.project.budget += person.cost; st.project.quality = clamp(st.project.quality + gain, 0, 100);
        st.project.crew.push({ id: person.id, title: person.title, displayTitle:person.displayTitle, homeCity:person.homeCity, role: person.role, roleLabel: person.roleLabel, cost: person.cost, qualityBonus: person.qualityBonus, appliedQuality: gain, fits: person.fits, fitLabel: person.fitLabel, hiredWeek: st.week, stage: st.project.stage });
      }, { reason: person.reason || (s.project && s.project.quality >= 100 ? 'איכות הסרט כבר 100. אין צורך לשלם על תוספת שלא תשפיע.' : ''), tag: 'צוות הסרט', crewOffer: true, crewRole: person.role, fitLabel: person.fitLabel, qualityBonus: gain, filmExpense: true });
    }
  }
  function getFilmCrewOptions(s) {
    const actions = ['set', 'studio'].flatMap(location => getActions(s, location)).filter(a => a.crewOffer);
    return crewOptions(s).map(person => { const a = actions.find(a => a.id === person.location + '.crew_' + person.id); return Object.assign({}, person, { actionId: a.id, crewCost: person.cost, cost: a.cost.money, actionCost: a.cost, fundingUsed: a.fundingUsed, appliedQuality: a.qualityBonus, disabled: a.disabled, reason: a.reason }); });
  }
  function festivalSubmissionOptions(s) {
    return Industry.getFestivalSubmissionOptions(s.films, Object.assign({}, s, { retirementRounds: retirementRounds(s) }));
  }
  function addFestivalActions(s, add) {
    for (const option of festivalSubmissionOptions(s)) {
      add('submit_' + option.filmId + '_' + option.festivalId, 'להגיש: ' + option.festivalTitle, '״' + option.filmTitle + '״ — ' + option.description + ' ' + option.fitLabel, { time: 2, money: option.fee, energy: 4 }, [option.acceptanceChance + '% סיכוי להיבחר', 'אם נבחר: ' + option.awardChance + '% סיכוי לפרס של ' + money(option.prize), 'בחירה: עד +' + option.acceptanceReputation + ' מוניטין; זכייה: עד +' + option.awardReputation, 'תשובה בסבב ' + option.dueWeek], st => {
        const film = st.films.find(film => film.id === option.filmId);
        const entry = { id: option.id, filmId: film.id, filmTitle: film.title, filmType: film.type, festivalId: option.festivalId, festivalTitle: option.festivalTitle, submittedWeek: st.week, dueWeek: option.dueWeek, fee: option.fee, acceptanceChance: option.acceptanceChance, awardChance: option.awardChance, prize: option.prize, prizeTitle: option.prizeTitle, acceptanceReputation: option.acceptanceReputation, awardReputation: option.awardReputation, quality: film.quality, craft: st.craft, reputationAtSubmission: st.reputation };
        st.festivalCircuit.pending.push(entry); film.festivalEntries.push(entry.id);
        note(st, '״' + film.title + '״ הוגש ל' + option.festivalTitle + '. דמי הגשה: ' + money(option.fee) + '. הסיכויים נקבעו: ' + option.acceptanceChance + '% לבחירה, ואז ' + option.awardChance + '% לפרס.');
      }, { reason: option.reason, tag: 'פסטיבלים ופרסים', festivalSubmission: true, festivalId: option.festivalId, filmId: option.filmId });
    }
  }
  function getFestivalSubmissions(s) {
    if (!s || !s.festivalCircuit) return [];
    const actions = getActions(s, 'festival').filter(a => a.festivalSubmission);
    return festivalSubmissionOptions(s).map(option => { const a = actions.find(a => a.id === option.actionId); return Object.assign({}, option, { cost: a.cost, disabled: a.disabled, reason: a.reason }); });
  }
  function closeRetirementSubmissions(s) {
    const circuit = s.festivalCircuit;
    for (const entry of circuit.pending) {
      const cash = entry.fee;
      addStats(s, { cash });
      if (s.weeklySummary) { s.weeklySummary.income += cash; s.weeklySummary.net += cash; s.weeklyTotals.income -= cash; }
      const text = 'ההגשה של ״' + entry.filmTitle + '״ ל' + entry.festivalTitle + ' נסגרה עם הפרישה בגיל 85, לפני מועד התשובה. דמי ההגשה הוחזרו: ' + money(cash) + '. לא התקבלה החלטת תחרות.';
      const result = Object.assign({}, entry, { outcome: 'withdrawn', cash, reputation: 0, week: s.week, resolvedWeek: s.week, text });
      circuit.history.push(result); if (s.weeklySummary) s.weeklySummary.festivalResults.push(Object.assign({}, result)); note(s, text);
    }
    circuit.pending = [];
  }
  function resolveFestivalCircuit(s) {
    const circuit = s.festivalCircuit;
    for (const entry of circuit.pending.filter(entry => entry.dueWeek <= s.week)) {
      const selected = random(circuit) * 100 < entry.acceptanceChance, awarded = selected && random(circuit) * 100 < entry.awardChance;
      const outcome = awarded ? 'award' : selected ? 'selected' : 'rejected', cash = awarded ? entry.prize : 0;
      const rep = awarded ? entry.awardReputation : selected ? entry.acceptanceReputation : 0, beforeRep = s.reputation;
      addStats(s, { cash, reputation: rep }); const reputation = s.reputation - beforeRep;
      if (s.weeklySummary && cash) { s.weeklySummary.income += cash; s.weeklySummary.net += cash; s.weeklyTotals.income -= cash; }
      const text = awarded ? '״' + entry.filmTitle + '״ זכה ב' + entry.prizeTitle + ': ' + money(cash) + ' ו־' + reputation + ' מוניטין. הפעם שם הסרט על המעטפה.' : selected ? '״' + entry.filmTitle + '״ נבחר ל' + entry.festivalTitle + '. נוספו ' + reputation + ' מוניטין; הפרס הלך לסרט אחר.' : '״' + entry.filmTitle + '״ לא נבחר ל' + entry.festivalTitle + '. דמי ההגשה אינם מוחזרים; אפשר לנסות פסטיבל אחר.';
      const result = Object.assign({}, entry, { outcome, cash, reputation, week: s.week, resolvedWeek: s.week, text });
      circuit.history.push(result); const film = s.films.find(film => film.id === entry.filmId);
      if (awarded) film.awards.push({ entryId: entry.id, festivalId: entry.festivalId, festivalTitle: entry.festivalTitle, title: entry.prizeTitle, prize: cash, week: s.week });
      if (s.weeklySummary) s.weeklySummary.festivalResults.push(Object.assign({}, result)); note(s, text);
    }
    circuit.pending = circuit.pending.filter(entry => entry.dueWeek > s.week);
  }

  function addCareerActions(s, location, add) {
    const commission = (base, title, description, id, time, energy, changes, tier) => {
      const wage = workPay(s, base, true);
      const happy = (changes.happiness || 0) - (s.characterId === 'tamar' ? 2 : 0);
      const effects = ['+' + money(wage)].concat(Object.entries(Object.assign({}, changes, { happiness: happy })).filter(([, n]) => n).map(([key, n]) => (n > 0 ? '+' : '') + n + ' ' + ({ craft: 'מיומנות', contacts: 'קשרים', reputation: 'מוניטין', happiness: 'אושר' })[key]));
      add(id, title, description, { time, energy }, effects, st => addStats(st, Object.assign({}, changes, { cash: wage, happiness: happy })), { limit: [id, 1], careerTier: tier, tag: 'הזדמנות' });
    };
    if (location === 'set') {
      commission(720, 'לצלם חתונה', 'שלוש מצלמות, שתי משפחות, ואפס אפשרות לעוד טייק בחופה.', 'wedding', 8, 23, { craft: 2, contacts: 1, happiness: -4 }, 0);
      commission(1650, 'לביים פרסומת', 'תקציב מסודר, עוד סבב הערות, ובקשה שהיוגורט יהיה ״יותר צעיר״.', 'ad', 9, 23, { craft: 2, contacts: 2, reputation: 2, happiness: -7 }, 1);
    }
    if (location === 'school') {
      add('lecture', 'להרצות על הסרט שלך', 'פעם ישבת בשורה האחרונה. היום שואלים אותך איך נכנסים לתעשייה.', { time: 4, energy: 9 }, ['+' + money(workPay(s, 720, false)), '+3 מוניטין', '+3 אושר'], st => addStats(st, { cash: workPay(s, 720, false), reputation: 3, happiness: 3 }), { limit: ['lecture', 1], careerTier: 1, tag: 'הזדמנות' });
      add('teach_masterclass', 'להנחות כיתת אמן', 'מקרינים סצנה שלך ומסבירים למה התאונה הייתה בעצם החלטה אמנותית.', { time: 5, energy: 13 }, ['+' + money(workPay(s, 1250, false)), '+4 מוניטין', '+2 מיומנות'], st => addStats(st, { cash: workPay(s, 1250, false), reputation: 4, craft: 2 }), { limit: ['teach_masterclass', 1], careerTier: 2, tag: 'הזדמנות' });
    }
    if (location === 'festival') add('jury', 'לשפוט בפסטיבל עולמי', 'שמונה סרטים, חמש דעות, ומישהו שמאוד רוצה שתצביע לחבר שלו.', { time: 6, energy: 12 }, ['+' + money(workPay(s, 1900, false)), '+5 מוניטין', '+4 קשרים', '+6 אושר'], st => addStats(st, { cash: workPay(s, 1900, false), reputation: 5, contacts: 4, happiness: 6 }), { limit: ['jury', 1], careerTier: 4, tag: 'הזדמנות' });
    if (location === 'bank') for (const key of ['apartment', 'studio_property']) {
      const item = ASSETS[key];
      add('buy_' + key, item.title, item.description, { time: 3, money: item.price }, [item.benefit, 'הנכס נספר בשווי נטו; אינו מזומן נזיל', 'רכישה אחת, ללא מכירה חוזרת'], st => { st.assets.push(key); st.weeklyTotals.expenses -= item.price; }, { reason: owns(s, key) ? 'הנכס כבר בבעלותך.' : '', careerTier: item.careerTier, tag: 'נדל״ן' });
    }
  }

  function fundingDetails(s, track) {
    const p = s.project;
    const cycleStart = 1 + track.offset + Math.floor((s.week - 1 - track.offset) / track.cycle) * track.cycle;
    const open = s.week >= 1 + track.offset && s.week < cycleStart + track.openWeeks;
    const nextOpening = open ? cycleStart : cycleStart + track.cycle;
    const deadlineWeek = nextOpening + track.openWeeks - 1;
    const attempts = p ? s.funding.history.filter(a => a.projectId === p.id && a.outcome !== 'withdrawn') : [];
    const last = attempts[attempts.length - 1];
    const improved = !last || p.dossier > last.dossier || p.quality >= last.quality + 8 || s.craft >= last.craft + 6;
    const chance = p ? clamp(Math.round((track.id === 'development' ? 45 : track.id === 'production' ? 35 : 40) + s.craft * 0.3 + s.contacts * 0.15 + p.quality * 0.25 + p.dossier * 15), 25, 85) : 0;
    let reason = '';
    if (!p) reason = 'צריך להתחיל סרט לפני שמבקשים תמיכה.';
    else if (track.partnerRequired && p.localPartner !== s.life.cityId) reason = 'למסלול הזה צריך לצרף שותף הפקה מקומי לסרט.';
    else if (p.grantAwarded) reason = 'הסרט הזה כבר קיבל מענק. לכל סרט תמיכה אחת.';
    else if (s.funding.application) reason = 'יש בקשה שממתינה לתשובה. בינתיים אפשר להמשיך לעבוד.';
    else if (attempts.length >= 2) reason = 'לכל סרט שתי הגשות לכל היותר. ממשיכים עם התקציב הקיים.';
    else if (!improved) reason = 'לפני ניסיון נוסף: לשפר תיק הגשה, להוסיף 8 איכות לסרט או 6 מיומנות.';
    else if (!track.stages.includes(p.stage)) reason = track.id === 'development' ? 'מסלול פיתוח פתוח רק לפני סיום התסריט.' : track.id === 'production' ? 'מסלול הפקה דורש תסריט גמור שטרם צולם.' : 'מסלול השלמה דורש סרט מצולם שטרם יצא לבכורה.';
    else if (track.id==='production'&&p.workload?.shootDone>0) reason='מגישים למענק הפקה לפני יום הצילום הראשון.';
    else if (s.craft < track.craft) reason = 'נדרשת לפחות ' + track.craft + ' מיומנות למסלול הזה.';
    else if (p.quality < track.quality) reason = 'נדרשת לפחות ' + track.quality + ' איכות למסלול הזה.';
    else if (track.waitWeeks > retirementRounds(s)) reason = 'התשובה צפויה אחרי הפרישה בגיל 85 בקצב ההפקה הנוכחי.';
    else if (s.week + track.waitWeeks > s.maxWeeks) reason = 'תשובת הקרן תגיע אחרי סוף הפרק. כבר מאוחר להגשה.';
    else if (!open) reason = nextOpening > s.maxWeeks ? 'מחזור ההגשה הבא נפתח אחרי סוף הפרק.' : 'חלון ההגשה סגור. נפתח בסבב ' + nextOpening + '.';
    return { id: track.id, fundName: track.fundName, title: track.title, description: track.description, amount: track.amount, waitWeeks: track.waitWeeks, chance, deadlineWeek, nextOpening, requirements: track.requirements.slice(), disabled: Boolean(reason), reason, actionId: 'bank.submit_' + track.id };
  }
  function addFundingActions(s, add) {
    for (const track of Local.tracks(FUND_TRACKS,s.life.cityId)) {
      const detail = fundingDetails(s, track);
      add('submit_' + track.id, 'להגיש: ' + track.title, track.fundName + ' — ' + track.description,
        { time: 3, energy: 6 }, [money(track.amount) + ' לתקציב הסרט בלבד', detail.chance + '% סיכוי לאישור', 'תשובה בעוד ' + track.waitWeeks + (track.waitWeeks === 1 ? ' שבוע' : ' סבבים'), 'חלון הגשה עד שבוע ' + detail.deadlineWeek], st => {
          const p = st.project;
          const attempt = st.funding.history.filter(a => a.projectId === p.id && a.outcome !== 'withdrawn').length + 1;
          st.funding.application = { id: p.id + '-' + attempt, projectId: p.id, projectTitle: p.title, trackId: track.id, title: track.title, fundName: track.fundName, amount: track.amount, submittedWeek: st.week, dueWeek: st.week + track.waitWeeks, chance: detail.chance, attempt, quality: p.quality, craft: st.craft, contacts: st.contacts, stage: p.stage, dossier: p.dossier };
          if(track.fundCity){st.funding.application.fundCity=track.fundCity;st.funding.application.localPartner=p.localPartner===track.fundCity;}
          note(st, track.fundName + ' קיבלה את הבקשה ל״' + p.title + '״. תשובה בסבב ' + st.funding.application.dueWeek + '. סיכוי האישור נקבע בעת ההגשה: ' + detail.chance + '%.');
        }, { reason: detail.reason, tag: 'קרנות' });
    }
    const p = s.project;
    const attempts = p ? s.funding.history.filter(a => a.projectId === p.id && a.outcome !== 'withdrawn') : [];
    const last = attempts[attempts.length - 1];
    const reason = !p ? 'צריך סרט פעיל.' : s.funding.application ? 'מחכים לתשובה על הבקשה הקיימת.' : p.grantAwarded ? 'המענק כבר אושר.' : attempts.length >= 2 ? 'שתי ההגשות לסרט הזה כבר נוצלו.' : !last || last.outcome !== 'rejected' ? 'תיקון תיק נפתח לאחר דחייה.' : p.dossier >= 1 ? 'תיק ההגשה כבר שופר.' : '';
    add('revise_application', 'לשפר את תיק ההגשה', 'מחדדים כוונת במאי, תקציב ותוכנית עבודה. הפעם בלי ״נסתדר״ בסעיף הסיכונים.', { time: 3, energy: 4 }, ['+15 נקודות אחוז לסיכוי האישור (עד 85%)', 'פותח ניסיון שני ואחרון', 'חלונות ההגשה ותנאי המסלול עדיין חלים'], st => { st.project.dossier = 1; }, { reason, tag: 'קרנות' });
  }
  function getFundingOptions(s) {
    if (!s || !s.funding) return [];
    const actions = getActions(s, 'bank');
    return Local.tracks(FUND_TRACKS,s.life.cityId).map(track => {
      const detail = fundingDetails(s, track);
      const a = actions.find(item => item.id === detail.actionId);
      return Object.assign(detail, { disabled: a.disabled, reason: a.reason, cost: a.cost });
    });
  }
  function recordFunding(s, application, outcome, reason) {
    const result = Object.assign({}, application, { outcome, reason, resolvedWeek: s.week });
    s.funding.history.push(result);
    s.funding.application = null;
    if (s.weeklySummary) s.weeklySummary.fundingResults.push(Object.assign({}, result));
    note(s, application.fundName + ': ' + reason);
    return result;
  }
  function withdrawApplication(s, reason) {
    if (s.funding && s.funding.application) recordFunding(s, s.funding.application, 'withdrawn', reason);
  }
  function resolveFunding(s) {
    const a = s.funding.application;
    if (!a || s.week < a.dueWeek) return;
    if (!s.project || s.project.id !== a.projectId) { withdrawApplication(s, 'ההפקה כבר נסגרה; הבקשה בוטלה ללא תשלום.'); return; }
    if (random(s) * 100 < a.chance) {
      s.project.grantBudget += a.amount;
      s.project.grantAwarded += a.amount;
      recordFunding(s, a, 'approved', 'אושר מענק של ' + money(a.amount) + ' ל״' + a.projectTitle + '״. התקציב מכסה צילום, עריכה והפצה; הוא לא נכנס לכיס האישי.');
    } else {
      recordFunding(s, a, 'rejected', a.attempt < 2 ? '״' + a.projectTitle + '״ לא נבחר במחזור הזה. הוועדה ביקשה תיק הפקה משכנע יותר: שיפור תיק, עוד 8 איכות או 6 מיומנות יאפשרו ניסיון נוסף בחלון מתאים.' : '״' + a.projectTitle + '״ נדחה גם בהגשה השנייה. שתי ההגשות נוצלו; הסרט עדיין יכול לצאת בתקציב עצמאי.');
    }
  }
  function makeProductionEvent(s, full) {
    const p = s.project;
    const context = p.type === 'doc' ? {
      id: 'doc_neighbor', title: 'המרואיין מבקש זכות וטו', body: 'המרואיין הכי טוב ב״' + p.title + '״ ראה את הפריים ואמר: ״רק אל תכניסו את מה שאמרתי על הוועד״. זה כמעט כל הסרט.',
      paid: 'לצלם ראיון המשך מסודר', free: 'לשנות כיוון ולספר דרך השכונה', review: 'השכונה גנבה את ההצגה. ועד הבית ביקש זכות תגובה.'
    } : full ? {
      id: 'full_generator', title: 'השקט על הסט יקר מהצפוי', body: 'הטייק המושלם של ״' + p.title + '״ מלווה בגנרטור של החתונה הסמוכה. מנהלת ההפקה מציעה שלוש דרכים להמשיך לנשום.',
      paid: 'להזמין הקלטת דיאלוג מחדש', free: 'להפוך את הרעש לחלק מהסצנה', review: 'החתונה שמעבר לקיר הפכה לדמות משנה. היא לא חתמה על ויתור.'
    } : {
      id: 'lean_friend', title: 'הצלם קיבל פרסומת', body: 'החבר שמצלם את ״' + p.title + '״ בחינם קיבל עבודה בתשלום. הוא ממש מצטער. גם חשבון החשמל שלו.',
      paid: 'לשלם למחליף מקצועי', free: 'לשכתב לסצנה שאפשר לצלם לבד', review: 'דווקא הסצנה הקטנה נשארת בראש. כנראה שגם תקציב קטן הוא שיטה.'
    };
    const personal = s.characterId === 'noa' ? ' נועה כבר פתחה קובץ בשם תיקון_קטן_23.' : s.characterId === 'amir' ? ' אמיר בדק: הוא מכיר מישהו, אבל גם המישהו רוצה לאכול.' : s.characterId === 'tamar' ? ' תמר שואלת אם הבעיה כוללת חשבונית.' : ' קובי בודק אם תרמוס נוסף יפתור את זה.';
    const choices = [
      { label: context.paid, quality: 8, filmCost: 180, hours: 0, effects: {}, review: 'המבקר ציין לטובה את הסצנה שהצלת עם איש מקצוע. החשבונית פחות פוטוגנית.' },
      { label: 'לתקן בעצמך עד שהקפה נגמר', quality: 4, filmCost: 0, hours: 0, effects: { energy: -12, happiness: -3 }, review: 'הסצנה המתוקנת עובדת. רק היוצר זוכר כמה קפה נשפך עליה.' },
      { label: context.free, quality: -3, filmCost: 0, hours: 0, effects: { happiness: 4 }, review: context.review }
    ];
    return { kind: 'production', projectId: p.id, twistId: context.id, title: context.title, body: context.body + personal, options: choices.map(o => {
      const f=filmFunding(p,o.filmCost),fundingUsed=f.total;
      const cashCost = o.filmCost - fundingUsed;
      const reason = cashCost > s.cash ? 'אין מספיק מזומן לאפשרות הזו.' : s.energy + (o.effects.energy || 0) < 0 ? 'צריך 12 אנרגיה לתיקון הזה.' : '';
      const description = [(o.quality >= 0 ? '+' : '') + o.quality + ' איכות', cashCost ? '−' + money(cashCost) + ' במזומן' : 'ללא עלות במזומן', fundingUsed ? money(fundingUsed) + (f.crowdUsed||f.contractUsed?' ממימון הסרט':' מתקציב הקרן') : '', o.effects.energy ? '−12 אנרגיה' : '', o.effects.happiness ? (o.effects.happiness > 0 ? '+' : '') + o.effects.happiness + ' אושר' : ''].filter(Boolean).join(' · ');
      return Object.assign(o, { description, disabled: Boolean(reason), reason });
    }) };
  }
  function reviewFor(p) {
    return p.twist ? p.twist.text : p.quality >= 65 ? '״יש פה קול אישי. וגם סוף, שזה כבר הישג״ — ביקורת המסדרון.' : '״סרט קטן עם לב גדול וכבל מאריך קצר״ — ביקורת המסדרון.';
  }

  const PRODUCTION_RISKS = {
    short: { chance: 20, minAmount: 40, maxAmount: 120, positiveChance: 15, minReward: 80, maxReward: 200 }, doc: { chance: 20, minAmount: 40, maxAmount: 120, positiveChance: 15, minReward: 80, maxReward: 200 },
    comedy: { chance: 25, minAmount: 100, maxAmount: 260, positiveChance: 16, minReward: 150, maxReward: 400 }, feature: { chance: 28, minAmount: 300, maxAmount: 900, positiveChance: 16, minReward: 400, maxReward: 1200 },
    blockbuster: { chance: 30, minAmount: 700, maxAmount: 1800, positiveChance: 18, minReward: 900, maxReward: 2400 }
  };
  function getProductionRisk(s, type) {
    const key = type || (s.project && s.project.type) || 'short', rule = PRODUCTION_RISKS[key];
    if (!rule) return null;
    const active = s.project && s.project.type === key, used = active ? (s.project.setbacks || []).length : 0;
    const remainingSetbacks = Math.max(0, 2 - used), remainingBreakthroughs = Math.max(0, 1 - (active ? (s.project.breakthroughs || []).length : 0));
    const description = (remainingSetbacks ? 'בכל שלב כתיבה, צילום ועריכה: ' + rule.chance + '% סיכוי להוצאה מפתיעה של ' + money(rule.minAmount) + ' עד ' + money(rule.maxAmount) + '. עד שתי תקלות לסרט; מענק, מזומן ואז חוב מפורש.' : 'שתי התקלות כבר נרשמו; לא יוגרלו חיובים נוספים.') + (remainingBreakthroughs ? ' וגם ' + rule.positiveChance + '% סיכוי להכנסה מפתיעה של ' + money(rule.minReward) + ' עד ' + money(rule.maxReward) + ', פעם אחת לסרט. הפתעה טובה ותקלה לא קורות באותו מעבר.' : ' ההפתעה הטובה של הסרט כבר התקבלה.');
    return Object.assign({}, rule, { chance: remainingSetbacks ? rule.chance : 0, positiveChance: remainingBreakthroughs ? rule.positiveChance : 0, maxSetbacks: 2, remainingSetbacks, maxBreakthroughs: 1, remainingBreakthroughs, description });
  }
  function productionBreakthrough(s, stage, risk) {
    const p = s.project;
    const stories = {
      script: ['הסינופסיס מצא קהל לפני הסרט', 'קבוצת הקרנות מקומית קנתה מראש רישיון הקרנה נפרד. מישהו אשכרה שילם על קובץ PDF.'],
      shoot: ['הקטע מהסט עשה את שלו', 'מועדון קולנוע ראה קטע מהצילומים והזמין הקרנה בתשלום מראש. הפעם ה״חשיפה״ הגיעה עם העברה.'],
      edit: ['מישהו אהב דווקא את הגרסה שלך', 'סדרת הקרנות רכשה רישיון נפרד אחרי צפייה בקטע ערוך. לא ביקשו אפילו ״רק עוד שינוי קטן״.']
    };
    const amount = risk.minReward + Math.floor(random(s) * (risk.maxReward - risk.minReward + 1));
    const [title, body] = stories[stage], text = body + ' התקבלו ' + money(amount) + ' במזומן כהכנסה מוקדמת של הסרט. זו הכנסה נפרדת; היא לא תשולם שוב בבכורה ואינה מבטיחה הצלחה בקופות.';
    const report = { kind: 'breakthrough', id: p.id + '-good-' + stage, projectId: p.id, stage, title, text, amount, rewardCash: amount, week: s.week };
    addStats(s, { cash: amount }); p.productionIncome += amount; p.breakthroughs.push(report); s.productionAlert = Object.assign({}, report);
    if (s.event && s.event.kind === 'production') s.event = makeProductionEvent(s, p.shootStyle === 'full');
    note(s, title + ': ' + text); return Object.assign({}, report);
  }
  function maybeProductionSurprise(s, stage) {
    const p = s.project, risk = getProductionRisk(s);
    if (!p || !['script', 'shoot', 'edit'].includes(stage) || (!risk.remainingSetbacks && !risk.remainingBreakthroughs)) return null;
    const roll = random(s) * 100;
    if (roll >= risk.chance) return roll < risk.chance + risk.positiveChance ? productionBreakthrough(s, stage, risk) : null;
    const variants = {
      script: [['הלוקיישן ביטל ברגע האחרון', 'צריך להחזיר מקדמה לצוות ולסגור חלופה לפני שהסיפור עובר לאוטובוס.'], ['התחקיר פתח עוד דלת. בתשלום.', 'כדי לסיים את התסריט צריך עוד נסיעה, חומר ארכיוני וסריקה שאיש לא הזכיר בתקציב.']],
      shoot: [['הציוד בחר לשבות באמצע הטייק', 'השכרה חלופית והובלה דחופה הצילו את היום. החשבונית הגיעה עוד לפני החומרים.'], ['יום הצילום גלש', 'השוט האחרון היה יפה. גם התוספת להסעות ולשעות הצוות אמיתית מאוד.']],
      edit: [['הסאונד הגיע עם מזגן בתפקיד ראשי', 'נדרש ניקוי מקצועי והקלטת תיקונים. הכפתור ״נסדר בפוסט״ עולה כסף.'], ['כונן הגיבוי היה אופטימי מדי', 'החומר ניצל. שחזור מסודר, כונן חלופי ושירות דחוף הצטרפו לתקציב.']]
    };
    const [title, body] = variants[stage][Math.floor(random(s) * variants[stage].length)];
    const amount = risk.minAmount + Math.floor(random(s) * (risk.maxAmount - risk.minAmount + 1));
    const funding=spendFilmFunding(p,amount),grantUsed=funding.grantUsed,crowdUsed=funding.crowdUsed,contractUsed=funding.contractUsed,cashPaid=Math.min(amount-funding.total,s.cash),debtAdded=amount-funding.total-cashPaid;
    p.budget += amount; s.cash -= cashPaid; s.debt += debtAdded; s.weeklyTotals.expenses += cashPaid + debtAdded;
    const text = body + ' עלות לא מתוכננת: ' + money(amount) + '.' + (grantUsed ? ' מתמיכת הקרן: ' + money(grantUsed) + '.' : '') + (crowdUsed ? ' ממימון המונים: '+money(crowdUsed)+'.' : '') + (contractUsed ? ' מתקציב השותף: '+money(contractUsed)+'.' : '') + (cashPaid ? ' שולם במזומן: ' + money(cashPaid) + '.' : '') + (debtAdded ? ' אין מספיק מזומן: ' + money(debtAdded) + ' נוספו לחוב ונושאים את הריבית בסבב הזהית.' : '');
    const report = { kind: 'setback', id: p.id + '-' + stage, projectId: p.id, stage, title, text, amount, grantUsed, ...(crowdUsed?{crowdUsed}:{}), ...(contractUsed?{contractUsed}:{}), cashPaid, debtAdded, week: s.week };
    p.setbacks.push(report); s.productionAlert = Object.assign({}, report);
    // A shoot may also open a creative dilemma: its price preview must use the post-invoice balance.
    if (s.event && s.event.kind === 'production') s.event = makeProductionEvent(s, p.shootStyle === 'full');
    note(s, title + ': ' + text); return Object.assign({}, report);
  }
  function acknowledgeSetback(s) {
    if (!s || !s.productionAlert) return { ok: false, message: 'אין עדכון הפקה חדש שמחכה לאישור.' };
    const message = (s.productionAlert.kind === 'breakthrough' ? 'ההכנסה הטובה נרשמה לזכות ״' : 'התקלה נרשמה בתקציב ״') + (s.project ? s.project.title : 'הסרט') + '״. ממשיכים עם התוכנית המעודכנת.';
    s.productionAlert = null; checkVictory(s); return { ok: true, message };
  }

  function releaseOutcome(s, festival) {
    const p = s.project;
    if (!p) return { revenue: 0, reputation: 0, happiness: 0, royalty: 0 };
    const type = FILM_TYPES[p.type];
    return {
      revenue: Math.round((festival ? 220 + p.quality * 12 : 500 + p.quality * 23) * type.revenue),
      reputation: Math.round((festival ? 12 + p.quality * 0.21 : 6 + p.quality * 0.11) * type.reputation),
      happiness: festival ? 12 : 10,
      royalty: Math.round((festival ? 15 : 35) + p.quality * (festival ? 0.3 : 0.6))
    };
  }
  function getReleaseForecast(s, festival) {
    const p = s.project, out = releaseOutcome(s, festival);
    if (!p) return null;
    const big = FILM_TYPES[p.type].careerTier || 0;
    const fee = big === 3 ? 1400 : big === 2 ? 600 : festival ? 180 : 80;
    const riskChance = big ? clamp((big === 3 ? 58 : 40) - Math.floor(p.quality * 0.22) - Math.floor(s.contacts * 0.08) - (festival ? 10 : 0), 8, 45) : 0;
    const flopRevenue = big ? Math.round(out.revenue * (big === 3 ? 0.2 : 0.32)) : out.revenue;
    return { fee, riskChance, revenueMin: flopRevenue, revenueMax: out.revenue, successRevenue: out.revenue, flopRevenue, expectedRevenue: Math.round(out.revenue * (1 - riskChance / 100) + flopRevenue * riskChance / 100) };
  }
  function addRelease(s, add, festival) {
    const p = s.project, out = releaseOutcome(s, festival), forecast = getReleaseForecast(s, festival);
    const fee = forecast ? forecast.fee : festival ? 180 : 80;
    const effects = forecast && forecast.riskChance ? ['בהצלחה: ' + money(forecast.successRevenue), 'בכישלון מסחרי: ' + money(forecast.flopRevenue), forecast.riskChance + '% סיכון לכישלון מסחרי', 'בהצלחה +' + out.reputation + ' מוניטין; בכישלון רק ' + Math.round(out.reputation * 0.45), 'תמלוגים: ' + money(Math.round(out.royalty * 0.35)) + ' עד ' + money(out.royalty) + ' בסבב', 'בכישלון: −8 אושר'] : ['+' + money(out.revenue) + ' הכנסות', '+' + out.reputation + ' מוניטין', '+' + out.happiness + ' אושר', money(out.royalty) + ' תמלוגים בסבב'];
    if(p?.contract)effects.push(p.contract.share+'% מהכנסות הבכורה לשותף; תמלוגים ופרסים נשארים שלך', 'נטו בכורה משוער: '+money(Math.round((forecast?.revenueMin??out.revenue)*(100-p.contract.share)/100))+'–'+money(Math.round((forecast?.revenueMax??out.revenue)*(100-p.contract.share)/100)));
    add(festival ? 'release_festival' : 'release_commercial', festival ? 'הקרנת בכורה בסינמטק' : 'להפיץ לקהל ול־VOD', festival ? 'הקרנת בכורה עם שיחת קהל: פחות הכנסות, יותר מוניטין. לתחרויות ופרסים מגישים בנפרד אחרי שהסרט יוצא.' : 'יותר הכנסות, פחות יוקרה. גם לדודה יש איפה לצפות.', { time: 4, money: fee, energy: 7 }, effects, st => {
      const flop = forecast.riskChance > 0 && random(st) * 100 < forecast.riskChance;
      const actual = { revenue: flop ? forecast.flopRevenue : out.revenue, reputation: flop ? Math.round(out.reputation * 0.45) : out.reputation, happiness: flop ? -8 : out.happiness, royalty: flop ? Math.round(out.royalty * 0.35) : out.royalty };
      withdrawApplication(st, 'הסרט כבר יצא לבכורה; הבקשה נסגרה ללא תשלום.');
      if (st.project.grantBudget) note(st, 'יתרת מענק של ' + money(st.project.grantBudget) + ' נסגרה בבכורה; היא אינה כסף אישי.');
      payDirector(st,st.project,'release');
      Crowd.close(st.project,st.week);
      st.project.grantExpired = st.project.grantBudget; st.project.grantBudget = 0;
      const film = Object.assign({}, st.project, { festivalEntries: [], awards: [], review: reviewFor(st.project), stage: 'released', releasedWeek: st.week, releasedQuarter: st.life.quarters, route: festival ? 'festival' : 'commercial', budget: st.project.budget + fee, revenue: actual.revenue, royalty: actual.royalty });
      if (forecast.riskChance) { film.boxOfficeSuccess = !flop; film.forecast = forecast; }
      if(film.contract){const c=film.contract;Network.close(film,st.week,'released');c.producerPaid=Math.round(actual.revenue*c.share/100);c.netRevenue=actual.revenue-c.producerPaid;film.netRevenue=c.netRevenue;}
      st.films.push(film); st.project = null;
      addStats(st, { cash: film.netRevenue??actual.revenue, reputation: actual.reputation, happiness: actual.happiness });
      if (forecast.riskChance) note(st, (flop ? 'הקהל לא הגיע כצפוי. ' : 'הבכורה עמדה בציפיות. ') + 'הכנסות בפועל: ' + money(actual.revenue) + ', תקציב כולל: ' + money(film.budget) + '.');
    }, { reason: !p || p.stage !== 'release' ? 'צריך סרט שעריכתו הסתיימה.' : festival&&p.contract?.kind==='producer'?'בחוזה המפיק נבחרה בכורה מסחרית. אחרי הבכורה אפשר להגיש לתחרויות.':'', tag: 'בכורה', filmExpense: true, forecast });
  }
  function getActions(s, locationId) {
    if (!s || !LOCATIONS.some(l => l.id === locationId)) return [];
    return actionsFor(s, locationId).map(({ _apply, _location, _usage, ...visible }) => visible);
  }
  function act(s, actionId, options) {
    if (!s || typeof actionId !== 'string') return { ok: false, message: 'פעולה לא מוכרת.' };
    const location = actionId.split('.')[0];
    if (!LOCATIONS.some(l => l.id === location)) return { ok: false, message: 'המקום הזה עוד לא קיבל היתר צילום.' };
    const genre = options && options.storyGenre;
    if (genre !== undefined && (!actionId.startsWith('home.start_') || !Stories.options(actionId.slice(11)).some(g=>g.id===genre))) return {ok:false,message:'הז׳אנר אינו מתאים להיקף ההפקה הזה.'};
    const selected = actionsFor(s, location, genre).find(a => a.id === actionId);
    if (!selected) return { ok: false, message: 'פעולה לא מוכרת.' };
    if (selected.disabled) return { ok: false, message: selected.reason };
    const previousStage = s.project ? s.project.stage : null;
    const previousFilmCount = s.films.length;
    s.hours -= selected.cost.time;
    s.cash -= selected.cost.money;
    s.energy -= selected.cost.energy;
    s.weeklyTotals.expenses += selected.cost.money;
    if (selected.fundingUsed || selected.crowdUsed || selected.contractUsed) spendFilmFunding(s.project,selected.fundingUsed+selected.crowdUsed+selected.contractUsed);
    s.location = selected._location;
    if (selected._usage) s.used[selected._usage] += 1;
    selected._apply(s);
    if(previousStage==='shoot'&&s.project?.stage==='edit') { if(s.project.contract?.kind==='copro')s.project.contract.shotAbroad=true;payDirector(s,s.project,'shoot');if(s.event?.kind==='production')s.event=makeProductionEvent(s,s.project.shootStyle==='full'); }
    if (s.project && s.project.stage !== previousStage || s.films.length > previousFilmCount || selected.crewOffer || /^(set\.shoot_|studio\.edit)/.test(actionId)) s.life.productionLoad += selected.workDays || 1;
    const productionReport = s.project && ['script', 'shoot', 'edit'].includes(previousStage) && s.project.stage !== previousStage ? maybeProductionSurprise(s, previousStage) : null;
    let story = '';
    if (s.films.length > previousFilmCount) {
      const film = s.films[s.films.length - 1];
      story = '״' + film.title + '״ יצא ' + (film.route === 'festival' ? 'לבכורה בסינמטק. מישהו בשורה השלישית אפילו מחא כפיים ראשון.' : 'לקהל. עכשיו אפשר לשלוח למשפחה קישור אמיתי.') + ' איכות הסרט: ' + film.quality + '/100. ' + (film.forecast ? (film.boxOfficeSuccess ? 'הבכורה הצליחה: ' : 'התחזית התפספסה: ') + money(film.revenue) + ' הכנסות בפועל. ' : '') + film.review;
    } else if (s.project && s.project.stage !== previousStage) {
      const title = '״' + s.project.title + '״';
      if (s.project.stage === 'script') story = 'נולד ' + title + '. יש רעיון; עכשיו צריך להפוך אותו לתסריט שאפשר לצלם.';
      if (s.project.stage === 'shoot') story = 'התסריט של ' + title + ' נסגר. הגיע הזמן לאסוף צוות וללחוץ רקורד.';
      if (s.project.stage === 'edit') story = title + ' צולם. כל החומרים מחכים בחדר העריכה, כולל שלוש דקות של מכסה עדשה.';
      if (s.project.stage === 'release') story = 'העריכה של ' + title + ' נעולה. הבכורה מחכה: הקרנה בסינמטק או הפצה מסחרית לקהל?';
    }
    const message = (story || selected.title) + ' — ' + selected.effects.join(' · ');
    note(s, message);
    checkVictory(s);
    return { ok: true, message, setback: productionReport && productionReport.kind === 'setback' ? productionReport : null, breakthrough: productionReport && productionReport.kind === 'breakthrough' ? productionReport : null };
  }
  const EVENT_TEMPLATES = [
    { title: '״זה בעיקר בשביל החשיפה״', body: 'מפיק מציע לך קרדיט על עבודה. חברת החשמל עדיין מתעקשת על כסף.', options: [
      { label: 'להסכים, אבל עם גבולות', description: '+5 קשרים, +4 מוניטין, −6 אושר.', effects: { contacts: 5, reputation: 4, happiness: -6 } },
      { label: 'לבקש תשלום כמו בן אדם', description: '+180 ₪, +2 מוניטין.', effects: { cash: 180, reputation: 2 } },
      { label: 'ללכת לים', description: '+9 אושר, +8 אנרגיה.', effects: { happiness: 9, energy: 8 } }
    ] },
    { title: 'החתול נכנס לפריים', body: 'הטייק הכי טוב כולל חתול שמסתכל ישר למצלמה. הוא כרגע השחקן הכי אמין בסרט.', options: [
      { label: 'להכריז שזו בחירה אמנותית', description: '+4 מוניטין, +5 אושר.', effects: { reputation: 4, happiness: 5 } },
      { label: 'ללמוד למחוק אותו בעריכה', description: '+6 מיומנות, −5 אנרגיה.', effects: { craft: 6, energy: -5 } }
    ] },
    { title: 'אמא שולחת מודעת דרושים', body: '״דרוש מנהל תוכן, תנאים טובים״. מצורפים שבעה סימני שאלה ולב.', options: [
      { label: 'להסביר לה איפה הקריירה עומדת', description: '+8 אושר, +5 אנרגיה.', effects: { happiness: 8, energy: 5 } },
      { label: 'לקחת עבודת תוכן קטנה', description: '+320 ₪, −6 אושר, −6 אנרגיה.', effects: { cash: 320, happiness: -6, energy: -6 } }
    ] },
    { title: 'הפסטיבל רוצה אותך. ואת דמי ההרשמה.', body: 'פסטיבל ״עדשת הנגב״ פותח מסלול חדש. בטופס יש יותר שדות מאשר בנגב.', options: [
      { label: 'להירשם ולפגוש אנשים', description: '−180 ₪, +7 מוניטין, +5 קשרים.', effects: { cash: -180, reputation: 7, contacts: 5 } },
      { label: 'לארגן הקרנה בסלון', description: '+5 אושר, +2 מוניטין.', effects: { happiness: 5, reputation: 2 } }
    ] },
    { title: 'הלקוח ביקש ״יותר ויראלי״', body: 'אין לו הערות נוספות, רק המילים ״יותר ויראלי״ וקישור לסרטון של כלב.', options: [
      { label: 'לשלוח גרסה ולעמוד על התשלום', description: '+250 ₪, −5 אנרגיה.', effects: { cash: 250, energy: -5 } },
      { label: 'להפוך את הבריף לתרגיל יצירתי', description: '+6 מיומנות, +3 אושר.', effects: { craft: 6, happiness: 3 } }
    ] },
    { title: 'איתי העלה ״חדשות גדולות בקרוב״', body: 'תמונה עם תג פסטיבל, כוס יין וטקסט ארוך מאוד. החדשות עצמן לא מופיעות.', options: [
      { label: 'לפרגן ולהזמין לקפה', description: '+6 קשרים, +3 אושר.', effects: { contacts: 6, happiness: 3 } },
      { label: 'לסגור את האפליקציה ולעבוד', description: '+5 מיומנות, +4 אנרגיה.', effects: { craft: 5, energy: 4 } }
    ] },
    { title: 'יום ההולדת שכמעט פספסת', body: 'החברים כתבו ״הפעם בלי לפטופ״. זו כנראה התערבות.', options: [
      { label: 'להגיע עם מתנה ובלי תירוצים', description: '−120 ₪, +15 אושר, +5 אנרגיה.', effects: { cash: -120, happiness: 15, energy: 5 } },
      { label: 'להביא עוגה ביתית', description: '+9 אושר, −4 אנרגיה.', effects: { happiness: 9, energy: -4 } }
    ] }
  ];
  function eventPool(cityId) {
    let classics=EVENT_TEMPLATES.map((t,i)=>Object.assign({id:'classic_'+i},t));
    if(cityId!=='tel_aviv')classics=classics.filter(t=>t.title==='הלקוח ביקש ״יותר ויראלי״'||t.title==='איתי העלה ״חדשות גדולות בקרוב״').map(t=>t.title.startsWith('איתי')?Object.assign({},t,{options:t.options.map((o,i)=>i===0?Object.assign({},o,{label:'לפרגן ולהרים שיחת וידאו'}):o)}):t);
    return (Events.BY_CITY[cityId]||[]).concat(classics);
  }
  function weeklyEvent(template,s) {
    return {kind:'weekly',templateId:template.id,cityId:s.life.cityId,title:template.title,body:template.body,options:template.options.map(o=>{
      const need=Math.max(0,-(o.effects.cash||0));
      return {label:o.label,description:o.description,disabled:need>s.cash,reason:need>s.cash?'אין מספיק מזומן לאפשרות הזו.':'',effects:Object.assign({},o.effects)};
    })};
  }
  function makeEvent(s) {
    const pool=eventPool(s.life.cityId),recent=(s.life.eventHistory||[]).slice(-Math.min(7,pool.length-1));
    const candidates=pool.filter(t=>!recent.includes(t.id));
    const template=candidates[Math.floor(random(s)*candidates.length)];
    s.life.eventHistory=(s.life.eventHistory||[]).concat(template.id).slice(-7);
    return weeklyEvent(template,s);
  }
  function chooseEvent(s, index) {
    if (s && s.productionAlert) return { ok: false, message: 'קודם מאשרים את העדכון החדש מההפקה.' };
    if (!s || s.status !== 'playing' || !s.event || !Number.isInteger(index) || !s.event.options[index]) return { ok: false, message: 'אין אפשרות כזו באירוע הנוכחי.' };
    const option = s.event.options[index];
    if (option.disabled || s.cash + (option.effects.cash || 0) < 0) return { ok: false, message: option.reason || 'אין מספיק מזומן.' };
    const message = option.label + ' — ' + option.description;
    if (s.event.kind === 'production') {
      if (!s.project || s.project.id !== s.event.projectId || s.project.twist) return { ok: false, message: 'הדילמה כבר נסגרה.' };
      const credit = filmFunding(s.project,option.filmCost).total;
      const cashCost = option.filmCost - credit;
      if (s.cash < cashCost || s.hours < option.hours || s.energy + (option.effects.energy || 0) < 0) return { ok: false, message: 'אין מספיק משאבים לאפשרות הזו.' };
      spendFilmFunding(s.project,credit);
      s.project.budget += option.filmCost;
      s.cash -= cashCost; s.weeklyTotals.expenses += cashCost; s.hours -= option.hours;
      s.project.quality = clamp(s.project.quality + option.quality, 0, 100);
      s.project.twist = { id: s.event.twistId, choice: index, text: option.review };
    }
    addStats(s, option.effects); s.event = null;
    note(s, message); checkVictory(s);
    return { ok: true, message };
  }
  function endWeek(s) {
    if (!s || s.status !== 'playing') return { ok: false, message: 'המשחק כבר הסתיים.' };
    if (s.productionAlert) return { ok: false, message: 'קודם מאשרים את העדכון החדש מההפקה.' };
    if (s.event) return { ok: false, message: 'קודם בוחרים מה לעשות באירוע בסבב הזה.' };
    const config = DIFFICULTIES[s.difficulty], completedWeek = s.week, periodQuarters = nextPeriodQuarters(s), living = Math.round(config.living * Life.city(s).livingMultiplier);
    const rent = s.assets.reduce((sum, id) => sum + (ASSETS[id].rent || 0), 0);
    const royalty = s.films.reduce((sum, film) => sum + Life.royalty(film, s.life.quarters), 0);
    s.cash += royalty + rent;
    const interest = Math.ceil(s.debt * config.interest);
    s.debt += interest;
    s.cash -= living;
    if (s.cash < 0) { s.debt += -s.cash; s.cash = 0; }
    const income = s.weeklyTotals.income + royalty + rent;
    const expenses = s.weeklyTotals.expenses + living + interest;
    const summary = 'מחיה: ' + money(living) + ' · ריבית: ' + money(interest) + (royalty ? ' · תמלוגים: ' + money(royalty) : '') + (rent ? ' · שכירות מנכסים: ' + money(rent) : '') + '. שבוע המפתח הסתיים בתוך ' + (periodQuarters * 3) + ' חודשי הפקה; יתר התקופה היא שגרה מאוזנת.';
    s.weeklySummary = { income, expenses, net: income - expenses, royalties: royalty, rent, text: summary, fundingResults: [], festivalResults: [], rivalReport: null };
    s.happiness = clamp(s.happiness - (s.used.work >= 3 ? 8 : 5) + (owns(s, 'desk') ? 2 : 0), 0, 100);
    s.energy = clamp(s.energy + 24, 0, 100);
    s.crisisWeeks = s.happiness <= 5 ? s.crisisWeeks + 1 : 0;
    s.weeklySummary.rivalReport = runRivalWeek(s);
    s.weeklySummary.lifeReport = Life.advance(s, periodQuarters);
    note(s, 'סוף שבוע ' + s.week + ': ' + summary);
    // Deliver the next week's decisions before deciding the outcome of this transition.
    if (completedWeek < s.maxWeeks) {
      s.week += 1; s.maxHours = BASE_HOURS; s.hours = s.maxHours; s.location = 'home';
      s.used = freshUsage(); s.weeklyTotals = { income: 0, expenses: 0 };
      resolveFunding(s); resolveCrowdfunding(s); resolveFestivalCircuit(s); refreshLocationBoards(s); refreshRivalPlan(s, false);
      const report = s.weeklySummary.rivalReport;
      if (report) { report.gapAfter = raceScore(s, s) - raceScore(s, s.rival); report.gapChange = report.gapAfter - report.gapBefore; s.rival.weekStartGap = report.gapAfter; }
    }
    checkVictory(s);
    if (s.life.quarters >= Life.MAX_QUARTERS) return retireCareer(s, true);
    if (s.status === 'won') return { ok: true, message: s.ending };
    if (s.debt > 6500) {
      s.status = 'lost'; s.ending = 'החוב עבר 6,500 ₪ והבנק הוריד את השאלטר להפקה. בפעם הבאה: עבודה קבועה, סרט קטן, ופחות ״נחזיר מההכנסות״.';
    } else if (s.crisisWeeks >= 2) {
      s.status = 'lost'; s.ending = 'שבועיים בלי אוויר לנשימה. החלטת לקחת הפסקה מהתעשייה. בסיבוב הבא, גם החברים והשנ״צ צריכים מקום ביומן.';
    } else if (rivalFinished(s)) {
      s.status = 'lost'; s.ending = 'איתי השלים את כל ארבעת יעדי הפרק ואת יעד הסרט לפני שהספקת. הוא מסיים עם ' + money(s.rival.cash - s.rival.debt) + ' בשווי נטו ו־' + s.rival.films.length + ' סרטים. עכשיו יש לך מסלול אמיתי לנסות להקדים בסיבוב הבא.';
    } else if (completedWeek >= s.maxWeeks) {
      s.status = 'lost';
      s.ending = 'הפרק הסתיימה לפני שכל היעדים שלך הושגו. הניקוד שלך: ' + raceScore(s, s) + ', של איתי: ' + raceScore(s, s.rival) + '. בסיבוב הבא אפשר לתכנן מסלול חד יותר.';
    }
    if (s.status === 'lost') { if(s.debt>6500){Crowd.close(s.project,s.week);Network.close(s.project,s.week);}recordChapter(s); withdrawApplication(s, 'הפרק הסתיימה לפני השלמת ההפקה; הבקשה נסגרה ללא תשלום.'); note(s, s.ending); return { ok: true, message: s.ending }; }
    if (s.week === 2 || random(s) < 0.43) s.event = makeEvent(s);
    return { ok: true, message: s.event ? 'שבוע ' + s.week + ' מתחיל עם סיפור חדש: ' + s.event.title : 'שבוע ' + s.week + ' התחיל. יש לך שוב 50 שעות להפתיע את התעשייה.' };
  }
  function validateSave(raw) {
    try {
      const s = typeof raw === 'string' ? JSON.parse(raw) : JSON.parse(JSON.stringify(raw));
      const object = value => value && typeof value === 'object' && !Array.isArray(value);
      const num = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
      const integer = (value, min, max) => Number.isInteger(value) && num(value, min, max);
      const str = (value, max) => typeof value === 'string' && value.length <= max;
      if (!object(s) || ![1, 2, 3, 4, VERSION].includes(s.version) || !Object.prototype.hasOwnProperty.call(DIFFICULTIES, s.difficulty)) return null;
      const sourceVersion = s.version, legacy = s.version === 1;
      if (sourceVersion < 5) {
        if(s.maxHours!==32||!integer(s.hours,0,32)||!object(s.used))return null;
        // Preserve hours already spent, funds, age and all queued outcomes.
        s.hours += BASE_HOURS-32;s.maxHours=BASE_HOURS;s.used.overtime=0;
      }
      // The live preview briefly wrote v3 reports before weekly gap baselines existed.
      // Recognize only that complete old shape; a partially deleted modern report is corruption.
      if (sourceVersion === 3 && object(s.rival) && !Object.prototype.hasOwnProperty.call(s.rival, 'weekStartGap') && Array.isArray(s.rival.history) && s.rival.history.every(report => object(report) && !('gapAfter' in report) && !('gapChange' in report))) {
        if (s.seasonFilmBase === undefined && s.season === 1) s.seasonFilmBase = 0;
        if (s.rival.seasonFilmBase === undefined && s.season === 1) s.rival.seasonFilmBase = 0;
        let previousGap = null;
        for (const report of s.rival.history) {
          const after = report.gapBefore + report.scoreBefore - report.scoreAfter;
          report.gapAfter = after; report.gapBefore = previousGap === null ? after : previousGap; report.gapChange = after - report.gapBefore;
          previousGap = after;
        }
        if (s.weeklySummary && s.weeklySummary.rivalReport) {
          const matching = s.rival.history.find(report => report.week === s.weeklySummary.rivalReport.week);
          if (!matching) return null;
          s.weeklySummary.rivalReport = JSON.parse(JSON.stringify(matching));
        }
        s.rival.weekStartGap = raceScore(s, s) - raceScore(s, s.rival);
      }
      if (sourceVersion < 4) s.life = Life.createLife(s, true);
      if (!validLife(s)) return null;
      const previousProjects = Array.isArray(s.films) ? s.films.concat(s.project ? [s.project] : []) : [];
      if (!Object.prototype.hasOwnProperty.call(s, 'productionAlert') && previousProjects.every(p => object(p) && !Object.prototype.hasOwnProperty.call(p, 'setbacks'))) {
        s.productionAlert = null; for (const p of previousProjects) p.setbacks = [];
      }
      if (previousProjects.every(p => object(p) && !Object.prototype.hasOwnProperty.call(p, 'breakthroughs') && !Object.prototype.hasOwnProperty.call(p, 'productionIncome'))) {
        for (const p of previousProjects) { p.breakthroughs = []; p.productionIncome = 0; if (Array.isArray(p.setbacks)) for (const item of p.setbacks) if (!('kind' in item)) item.kind = 'setback'; }
        if (object(s.productionAlert) && !('kind' in s.productionAlert)) s.productionAlert.kind = 'setback';
      }
      const config = DIFFICULTIES[s.difficulty];
      if (!str(s.name, 30) || !s.name.trim() || !integer(s.week, 1, s.maxWeeks) || (sourceVersion < 3 ? s.maxWeeks !== config.maxWeeks : !integer(s.season, 1, 1000) || s.maxWeeks !== config.maxWeeks * s.season || !integer(s.seasonStartedWeek, 1, s.week) || !integer(s.seasonFilmBase, 0, s.films && s.films.length)) || !object(s.used) || !integer(s.used.overtime,0,2) || s.maxHours !== BASE_HOURS+s.used.overtime*5 || !integer(s.hours, 0, s.maxHours)) return null;
      for (const stat of ['energy', 'happiness', 'craft', 'reputation', 'contacts']) if (!num(s[stat], 0, 100)) return null;
      if (!integer(s.cash, 0, 100000000) || !integer(s.debt, 0, 100000000) || !integer(s.job, 0, JOBS.length - 1) || !LOCATIONS.some(l => l.id === s.location)) return null;
      if (!['playing', 'won', 'lost', 'retired'].includes(s.status) || !str(s.ending, 2000) || !integer(s.rng, 1, 4294967295) || !integer(s.crisisWeeks, 0, 2)) return null;
      if (!Array.isArray(s.assets) || s.assets.length > Object.keys(ASSETS).length || new Set(s.assets).size !== s.assets.length || s.assets.some(a => !Object.prototype.hasOwnProperty.call(ASSETS, a))) return null;
      const filmValid = (p, released) => object(p) && Local.validProject(p) && Workload.valid(p) && Stories.valid(p) && Crowd.valid(p,s.week,s.life?.retired) && str(p.title, 100) && Object.prototype.hasOwnProperty.call(FILM_TYPES, p.type) && p.genre === FILM_TYPES[p.type].genre && num(p.quality, 0, 100) && integer(p.budget, 0, 10000000) && integer(p.startedWeek, 1, s.week) && (released ? p.stage === 'released' && integer(p.releasedWeek, p.startedWeek, s.week) && ['festival', 'commercial'].includes(p.route) && integer(p.revenue, 0, 1000000) && integer(p.royalty, 0, 1000) : ['script', 'shoot', 'edit', 'release'].includes(p.stage));
      if (s.project !== null && !filmValid(s.project, false)) return null;
      if (!Array.isArray(s.films) || s.films.length > 500 || !s.films.every(f => filmValid(f, true))) return null;
      if (!object(s.used) || Object.keys(freshUsage()).filter(k => sourceVersion >= 3 || !['wedding', 'ad', 'lecture', 'teach_masterclass', 'jury'].includes(k)).some(k => !integer(s.used[k], 0, k === 'work' ? 3 : ['meal','overtime'].includes(k) ? 2 : 1))) return null;
      if (!object(s.weeklyTotals) || !integer(s.weeklyTotals.income, 0, 100000000) || !integer(s.weeklyTotals.expenses, 0, 100000000)) return null;
      if (!Array.isArray(s.log) || s.log.length > 50 || !s.log.every(item => object(item) && integer(item.week, 1, s.week) && str(item.text, 2000))) return null;
      if (!object(s.rival) || s.rival.name !== 'איתי' || !num(s.rival.progress, 0, 100) || !str(s.rival.quote, 300) || !Object.prototype.hasOwnProperty.call(RIVAL_QUOTES, s.rival.location)) return null;
      if (s.weeklySummary !== null && (!object(s.weeklySummary) || !integer(s.weeklySummary.income, 0, 100000000) || !integer(s.weeklySummary.expenses, 0, 100000000) || !integer(s.weeklySummary.net, -100000000, 100000000) || !str(s.weeklySummary.text, 2000))) return null;
      if (s.event !== null) {
        if (!object(s.event) || s.status !== 'playing' || !str(s.event.title, 300) || !str(s.event.body, 2000) || !Array.isArray(s.event.options) || s.event.options.length < 2 || s.event.options.length > 3) return null;
        if (!s.event.options.every(o => object(o) && str(o.label, 300) && str(o.description, 1000) && typeof o.disabled === 'boolean' && str(o.reason, 300) && object(o.effects) && Object.entries(o.effects).every(([key, value]) => ['cash', 'energy', 'happiness', 'craft', 'reputation', 'contacts'].includes(key) && integer(value, -10000, 10000)))) return null;
        if (!s.event.options.some(o => !o.disabled && s.cash + (o.effects.cash || 0) >= 0)) return null;
      }
      if (legacy) {
        s.version = VERSION; s.characterId = 'kobi'; s.nextProjectId = 1; s.funding = { application: null, history: [] };
        for (const p of s.films.concat(s.project ? [s.project] : [])) {
          Object.assign(p, { id: s.nextProjectId++, grantBudget: 0, grantAwarded: 0, grantExpired: 0, dossier: 0, twist: null, dilemmaEligible: ['script', 'shoot'].includes(p.stage) });
          if (p.stage === 'released') p.review = reviewFor(p);
        }
        if (s.event) s.event.kind = 'weekly';
        if (s.weeklySummary) s.weeklySummary.fundingResults = [];
      }
      if (!CHARACTERS.some(c => c.id === s.characterId) || !integer(s.nextProjectId, 1, 1001)) return null;
      const projects = s.films.concat(s.project ? [s.project] : []);
      const projectIds = new Set();
      for (const p of projects) {
        if (!integer(p.id, 1, s.nextProjectId - 1) || projectIds.has(p.id) || !integer(p.dossier, 0, 1) || typeof p.dilemmaEligible !== 'boolean') return null;
        projectIds.add(p.id);
        if (!integer(p.grantAwarded, 0, 900) || ![0, 400, 500, 900].includes(p.grantAwarded) || !integer(p.grantBudget, 0, p.grantAwarded) || !integer(p.grantExpired, 0, p.grantAwarded)) return null;
        if (p.grantAwarded - p.grantBudget - p.grantExpired > p.budget) return null;
        if (p.stage === 'released' ? p.grantBudget !== 0 || !str(p.review, 1000) : p.grantExpired !== 0) return null;
        if (p.shootStyle !== undefined && !['lean', 'full'].includes(p.shootStyle)) return null;
        if (p.twist !== null && (!object(p.twist) || !['doc_neighbor', 'full_generator', 'lean_friend'].includes(p.twist.id) || !integer(p.twist.choice, 0, 2) || !str(p.twist.text, 1000) || ['script', 'shoot'].includes(p.stage))) return null;
        if (p.dilemmaEligible && ['edit', 'release', 'released'].includes(p.stage) && !p.twist && !(s.event && s.event.kind === 'production' && s.event.projectId === p.id)) return null;
      }
      if (s.nextProjectId !== projects.length + 1) return null;
      if (!object(s.funding) || !Array.isArray(s.funding.history) || s.funding.history.length > 1000) return null;
      const applicationValid = (a, resolved) => {
        if (!object(a)) return false;
        if (a.fundCity !== undefined && (!Object.hasOwn(Local.FUNDS,a.fundCity) || typeof a.localPartner !== 'boolean')) return false;
        const t = Local.tracks(FUND_TRACKS,a.fundCity||'tel_aviv').find(track => track.id === a.trackId);
        if(t?.partnerRequired && !a.localPartner)return false;
        const p = projects.find(project => project.id === a.projectId);
        if (!t || !p || !integer(a.attempt, 1, 2) || a.id !== a.projectId + '-' + a.attempt || a.projectTitle !== p.title || a.title !== t.title || a.fundName !== t.fundName || a.amount !== t.amount) return false;
        if (!integer(a.submittedWeek, p.startedWeek, s.week) || !integer(a.dueWeek, a.submittedWeek + t.waitWeeks, a.submittedWeek + t.waitWeeks) || a.dueWeek > s.maxWeeks || !integer(a.chance, 25, 85) || !num(a.quality, 0, 100) || !num(a.craft, 0, 100) || !num(a.contacts, 0, 100) || !integer(a.dossier, 0, 1)) return false;
        const cyclePosition = (a.submittedWeek - 1 - t.offset) % t.cycle;
        const expectedChance = clamp(Math.round((t.id === 'development' ? 45 : t.id === 'production' ? 35 : 40) + a.craft * 0.3 + a.contacts * 0.15 + a.quality * 0.25 + a.dossier * 15), 25, 85);
        if (cyclePosition < 0 || cyclePosition >= t.openWeeks || !t.stages.includes(a.stage) || a.craft < t.craft || a.quality < t.quality || a.chance !== expectedChance || a.dossier > p.dossier) return false;
        if (resolved) return ['approved', 'rejected', 'withdrawn'].includes(a.outcome) && str(a.reason, 2000) && integer(a.resolvedWeek, a.submittedWeek, s.week) && (a.outcome === 'withdrawn' ? a.resolvedWeek <= a.dueWeek : a.resolvedWeek === a.dueWeek);
        return s.status === 'playing' && s.project && s.project.id === a.projectId && a.dueWeek > s.week && !s.project.grantAwarded && !('outcome' in a) && !('resolvedWeek' in a);
      };
      if (!s.funding.history.every(a => applicationValid(a, true))) return null;
      if (s.funding.application !== null && !applicationValid(s.funding.application, false)) return null;
      const applicationIds = new Set();
      for (const a of s.funding.history.concat(s.funding.application ? [s.funding.application] : [])) {
        if (applicationIds.has(a.id)) return null;
        applicationIds.add(a.id);
      }
      for (const p of projects) {
        const applications = s.funding.history.filter(a => a.projectId === p.id).concat(s.funding.application && s.funding.application.projectId === p.id ? [s.funding.application] : []);
        if (applications.length > 2 || applications.some((a, i) => a.attempt !== i + 1)) return null;
        if (applications.length === 2 && (applications[0].outcome !== 'rejected' || applications[1].submittedWeek < applications[0].resolvedWeek || !(applications[1].dossier > applications[0].dossier || applications[1].quality >= applications[0].quality + 8 || applications[1].craft >= applications[0].craft + 6))) return null;
        const awards = applications.filter(a => a.outcome === 'approved');
        if (awards.length > 1 || p.grantAwarded !== (awards[0] ? awards[0].amount : 0)) return null;
      }
      if (s.weeklySummary !== null && (!Array.isArray(s.weeklySummary.fundingResults) || s.weeklySummary.fundingResults.length > 2 || !s.weeklySummary.fundingResults.every(a => applicationValid(a, true) && s.funding.history.some(h => JSON.stringify(h) === JSON.stringify(a))))) return null;
      if (sourceVersion < 3) {
        s.version = VERSION; s.season = 1; s.seasonStartedWeek = 1; s.seasonFilmBase = 0;
        for (const key of ['wedding', 'ad', 'lecture', 'teach_masterclass', 'jury']) s.used[key] = 0;
        s.rival = rivalInitial(s, s.rng ^ 0x9e3779b9); refreshRivalPlan(s, true); s.rival.progress = raceScore(s, s.rival); s.rival.weekStartGap = raceScore(s, s) - s.rival.progress;
        if (s.weeklySummary) s.weeklySummary.rivalReport = null;
      }
      if (s.event) {
        if (!['weekly', 'production'].includes(s.event.kind)) return null;
        if (s.event.kind === 'production') {
          if (!s.project || s.project.stage !== 'edit' || !s.project.dilemmaEligible || s.project.twist || s.event.projectId !== s.project.id || !['lean', 'full'].includes(s.project.shootStyle)) return null;
          const expected = makeProductionEvent(s, s.project.shootStyle === 'full');
          if (JSON.stringify(s.event) !== JSON.stringify(expected)) return null;
        } else {
          if (s.event.projectId !== undefined || s.event.twistId !== undefined) return null;
          if(s.event.templateId!==undefined){const t=eventPool(s.life.cityId).find(t=>t.id===s.event.templateId);if(!t||s.life.eventHistory?.at(-1)!==t.id||JSON.stringify(s.event)!==JSON.stringify(weeklyEvent(t,s)))return null;}
          // Legacy weekly events keep the v1 shape; reject extra production costs/effects.
          if (s.event.options.some(o => ['quality', 'filmCost', 'hours', 'review'].some(key => key in o))) return null;
        }
      }
      const setbackValid = (item, p) => {
        const rule = PRODUCTION_RISKS[p.type], stageIndex = ['script', 'shoot', 'edit'].indexOf(item && item.stage), currentIndex = ['script', 'shoot', 'edit', 'release', 'released'].indexOf(p.stage);
        return object(item) && item.kind === 'setback' && stageIndex >= 0 && stageIndex < currentIndex && item.id === p.id + '-' + item.stage && item.projectId === p.id && str(item.title, 300) && str(item.text, 2000) && integer(item.week, p.startedWeek, s.week) && integer(item.amount, rule.minAmount, rule.maxAmount) && integer(item.grantUsed, 0, p.grantAwarded) && integer(item.cashPaid, 0, item.amount) && integer(item.debtAdded, 0, item.amount) && integer(item.crowdUsed||0,0,p.crowdfunding?.spent||0) && integer(item.contractUsed||0,0,p.contract?.spent||0) && item.amount === item.grantUsed + (item.crowdUsed||0) + (item.contractUsed||0) + item.cashPaid + item.debtAdded;
      };
      for (const p of projects) {
        if (!Array.isArray(p.setbacks) || p.setbacks.length > 2 || !p.setbacks.every(item => setbackValid(item, p)) || new Set(p.setbacks.map(item => item.id)).size !== p.setbacks.length) return null;
        if (p.setbacks.reduce((sum,item)=>sum+(item.contractUsed||0),0)>(p.contract?.spent||0)) return null;
        if (p.setbacks.reduce((sum,item)=>sum+(item.crowdUsed||0),0)>(p.crowdfunding?.spent||0)) return null;
        if (p.setbacks.reduce((sum, item) => sum + item.amount, 0) > p.budget || p.setbacks.reduce((sum, item) => sum + item.grantUsed, 0) > p.grantAwarded - p.grantBudget - p.grantExpired) return null;
        if (p.setbacks.length === 2 && (['script', 'shoot', 'edit'].indexOf(p.setbacks[0].stage) >= ['script', 'shoot', 'edit'].indexOf(p.setbacks[1].stage) || p.setbacks[0].week > p.setbacks[1].week)) return null;
      }
      const breakthroughValid = (item, p) => object(item) && item.kind === 'breakthrough' && ['script', 'shoot', 'edit'].includes(item.stage) && ['script', 'shoot', 'edit'].indexOf(item.stage) < ['script', 'shoot', 'edit', 'release', 'released'].indexOf(p.stage) && item.id === p.id + '-good-' + item.stage && item.projectId === p.id && str(item.title, 300) && str(item.text, 2000) && integer(item.week, p.startedWeek, s.week) && integer(item.amount, PRODUCTION_RISKS[p.type].minReward, PRODUCTION_RISKS[p.type].maxReward) && item.rewardCash === item.amount;
      for (const p of projects) {
        if (!Array.isArray(p.breakthroughs) || p.breakthroughs.length > 1 || !p.breakthroughs.every(item => breakthroughValid(item, p)) || !integer(p.productionIncome, 0, PRODUCTION_RISKS[p.type].maxReward) || p.productionIncome !== p.breakthroughs.reduce((sum, item) => sum + item.rewardCash, 0) || p.breakthroughs.some(item => p.setbacks.some(bad => bad.stage === item.stage))) return null;
      }
      if (s.productionAlert !== null) {
        if (!s.project || s.status !== 'playing' || !object(s.productionAlert)) return null;
        const good = s.productionAlert.kind === 'breakthrough', history = good ? s.project.breakthroughs : s.project.setbacks;
        if (!(good ? breakthroughValid(s.productionAlert, s.project) : setbackValid(s.productionAlert, s.project)) || JSON.stringify(s.productionAlert) !== JSON.stringify(history[history.length - 1])) return null;
      }
      const forecastValid = (f, film) => object(f) && ['fee', 'revenueMin', 'revenueMax', 'successRevenue', 'flopRevenue', 'expectedRevenue'].every(k => integer(f[k], 0, 1000000)) && integer(f.riskChance, 8, 45) && f.revenueMin === f.flopRevenue && f.revenueMax === f.successRevenue && f.revenueMin <= f.revenueMax && f.expectedRevenue === Math.round(f.successRevenue * (1 - f.riskChance / 100) + f.flopRevenue * f.riskChance / 100) && f.fee === (film.type === 'blockbuster' ? 1400 : 600);
      for (const f of s.films) {
        if (['feature', 'blockbuster'].includes(f.type)) {
          if (typeof f.boxOfficeSuccess !== 'boolean' || !forecastValid(f.forecast, f) || f.revenue !== (f.boxOfficeSuccess ? f.forecast.successRevenue : f.forecast.flopRevenue)) return null;
        } else if (f.forecast !== undefined || f.boxOfficeSuccess !== undefined) return null;
      }
      const r = s.rival;
      if (!integer(r.rng, 1, 4294967295) || !integer(r.cash, 0, 100000000) || !integer(r.debt, 0, 100000000) || !['craft', 'reputation', 'contacts', 'happiness'].every(k => num(r[k], 0, 100)) || !integer(r.initializedWeek, 1, s.week) || !integer(r.lastReportWeek, r.initializedWeek - 1, s.week) || !num(r.weekStartGap, -100, 100)) return null;
      const rivalFilmValid = f => object(f) && str(f.title, 100) && ['short', 'feature', 'blockbuster'].includes(f.type) && num(f.quality, 0, 100) && f.route === 'commercial' && integer(f.budget, 0, 1000000) && integer(f.revenue, 0, 1000000) && integer(f.royalty, 0, 1000) && integer(f.releasedWeek, r.initializedWeek, s.week);
      if (!Array.isArray(r.films) || r.films.length > 500 || !r.films.every(rivalFilmValid) || !integer(r.seasonFilmBase, 0, r.films.length)) return null;
      if (r.project !== null && (!object(r.project) || !str(r.project.title, 100) || !['short', 'feature', 'blockbuster'].includes(r.project.type) || !['shoot', 'release'].includes(r.project.stage) || !num(r.project.quality, 0, 100) || !integer(r.project.budget, 0, 1000000))) return null;
      if (!object(r.plan) || !integer(r.plan.week, s.week, s.week + 1) || !str(r.plan.goal, 300) || !Array.isArray(r.plan.actions) || r.plan.actions.length < 2 || r.plan.actions.length > 3 || new Set(r.plan.actions.map(a => a.id)).size !== r.plan.actions.length || !r.plan.actions.every(a => object(a) && Object.prototype.hasOwnProperty.call(RIVAL_ACTIONS, a.id) && a.label === RIVAL_ACTIONS[a.id].label)) return null;
      if (!str(r.nextPlan, 1000) || !integer(r.dueWeek, s.week + 1, s.week + 2)) return null;
      const reportValid = report => object(report) && integer(report.week, r.initializedWeek, s.week) && str(report.goal, 300) && Array.isArray(report.actions) && report.actions.length >= 2 && report.actions.length <= 3 && report.actions.every(a => object(a) && Object.prototype.hasOwnProperty.call(RIVAL_ACTIONS, a.id) && a.label === RIVAL_ACTIONS[a.id].label && str(a.text, 1000) && ['cashDelta', 'craftDelta', 'reputationDelta', 'contactsDelta'].every(k => integer(a[k], -1000000, 1000000))) && object(report.delta) && ['income', 'expenses', 'cash', 'wealth', 'reputation', 'craft', 'contacts', 'happiness', 'films'].every(k => integer(report.delta[k], -1000000, 1000000)) && report.delta.income >= 0 && report.delta.expenses >= 0 && report.delta.wealth === report.delta.income - report.delta.expenses && integer(report.scoreBefore, 0, 100) && integer(report.scoreAfter, 0, 100) && integer(report.gapBefore, -100, 100) && integer(report.gapAfter, -100, 100) && report.gapChange === report.gapAfter - report.gapBefore && str(report.nextPlan, 1000) && report.dueWeek === report.week + 2;
      if (!Array.isArray(r.history) || r.history.length > 2000 || !r.history.every((report, i) => reportValid(report) && report.week === r.initializedWeek + i) || r.lastReportWeek !== r.initializedWeek + r.history.length - 1) return null;
      if (!Object.prototype.hasOwnProperty.call(s, 'locationBoards')) refreshLocationBoards(s);
      const boards = s.locationBoards;
      // A move or an event can lower contacts after a board was drawn. Retain its
      // cards; action career gates still prevent using an offer while ineligible.
      if (!object(boards) || boards.week !== s.week || !integer(boards.rng, 1, 4294967295)) return null;
      for (const location of ['cafe', 'gear']) {
        const board = boards[location], catalog = LOCATION_OFFERS[location];
        if (!object(board) || !Array.isArray(board.offerIds) || board.offerIds.length !== 3 || new Set(board.offerIds).size !== board.offerIds.length || !board.offerIds.every(id => catalog.some(offer => offer.id === id)) || board.offerIds.filter(id => catalog.find(offer => offer.id === id).stages).length > 1 || !Array.isArray(board.usedIds) || board.usedIds.length > 2 || new Set(board.usedIds).size !== board.usedIds.length || !board.usedIds.every(id => board.offerIds.includes(id))) return null;
      }
      if (!Object.prototype.hasOwnProperty.call(s, 'festivalCircuit') && projects.every(p => !Object.prototype.hasOwnProperty.call(p, 'crew')) && s.films.every(f => !Object.prototype.hasOwnProperty.call(f, 'festivalEntries') && !Object.prototype.hasOwnProperty.call(f, 'awards'))) {
        s.festivalCircuit = initialFestivalCircuit(s);
        for (const p of projects) p.crew = [];
        for (const f of s.films) { f.festivalEntries = []; f.awards = []; }
        if (s.weeklySummary) s.weeklySummary.festivalResults = [];
      }
      for (const p of projects) {
        if (!Array.isArray(p.crew) || p.crew.length > 3 || new Set(p.crew.map(member => member.role)).size !== p.crew.length) return null;
        const catalog = Industry.getCrewOptions(Object.assign({}, p, { crew: [] }));
        for (const member of p.crew) {
          const expected = catalog.find(person => person.id === (member && member.id));
          if (!object(member) || !expected || !Local.validCrew(member) || !['title', 'role', 'roleLabel', 'cost', 'qualityBonus', 'fits', 'fitLabel'].every(k => member[k] === expected[k]) || !num(member.appliedQuality, Number.EPSILON, expected.qualityBonus) || !integer(member.hiredWeek, p.startedWeek, s.week) || !expected.stages.includes(member.stage) || ['script', 'shoot', 'edit', 'release', 'released'].indexOf(member.stage) > ['script', 'shoot', 'edit', 'release', 'released'].indexOf(p.stage)) return null;
        }
        if (p.crew.reduce((sum, member) => sum + member.cost, 0) > p.budget) return null;
      }
      const circuit = s.festivalCircuit;
      if (!object(circuit) || !integer(circuit.rng, 1, 4294967295) || !Array.isArray(circuit.pending) || !Array.isArray(circuit.history) || circuit.pending.length > 500 || circuit.history.length > 1500) return null;
      const festivalEntryValid = (entry, resolved) => {
        if (!object(entry)) return false;
        const film = s.films.find(f => f.id === entry.filmId);
        if (!film || entry.id !== film.id + '-' + entry.festivalId || entry.filmTitle !== film.title || entry.filmType !== film.type || entry.quality !== film.quality || !num(entry.craft, 0, 100) || !num(entry.reputationAtSubmission, 0, 100) || !integer(entry.submittedWeek, film.releasedWeek, s.week)) return false;
        const option = Industry.getFestivalOptions(film, { week: entry.submittedWeek, maxWeeks: s.maxWeeks, craft: entry.craft, reputation: entry.reputationAtSubmission }).find(option => option.id === entry.festivalId);
        if (!option || !option.eligible || entry.festivalTitle !== option.title || !['fee', 'dueWeek', 'acceptanceChance', 'awardChance', 'prize', 'prizeTitle', 'acceptanceReputation', 'awardReputation'].every(k => entry[k] === option[k])) return false;
        if (!resolved) return entry.dueWeek > s.week && !('outcome' in entry) && !('cash' in entry) && !('resolvedWeek' in entry);
        if (entry.outcome === 'withdrawn') return s.life.retired && s.life.quarters === Life.MAX_QUARTERS && entry.resolvedWeek === entry.week && integer(entry.week, entry.submittedWeek, s.week) && entry.week < entry.dueWeek && entry.cash === entry.fee && entry.reputation === 0 && str(entry.text, 2000);
        if (!['selected', 'rejected', 'award'].includes(entry.outcome) || entry.week !== entry.dueWeek || entry.resolvedWeek !== entry.dueWeek || entry.week > s.week || !str(entry.text, 2000)) return false;
        const expectedCash = entry.outcome === 'award' ? entry.prize : 0, maxRep = entry.outcome === 'award' ? entry.awardReputation : entry.outcome === 'selected' ? entry.acceptanceReputation : 0;
        return entry.cash === expectedCash && num(entry.reputation, 0, maxRep);
      };
      if (!circuit.pending.every(entry => festivalEntryValid(entry, false)) || !circuit.history.every(entry => festivalEntryValid(entry, true))) return null;
      const allEntries = circuit.pending.concat(circuit.history);
      if (new Set(allEntries.map(entry => entry.id)).size !== allEntries.length) return null;
      for (const f of s.films) {
        const entries = allEntries.filter(entry => entry.filmId === f.id), awards = circuit.history.filter(entry => entry.filmId === f.id && entry.outcome === 'award');
        if (!Array.isArray(f.festivalEntries) || f.festivalEntries.length !== entries.length || f.festivalEntries.length > 3 || new Set(f.festivalEntries).size !== f.festivalEntries.length || !f.festivalEntries.every(id => entries.some(entry => entry.id === id)) || !Array.isArray(f.awards) || f.awards.length !== awards.length || new Set(f.awards.map(a => a.entryId)).size !== f.awards.length) return null;
        if (!f.awards.every(award => object(award) && awards.some(entry => award.entryId === entry.id && award.festivalId === entry.festivalId && award.festivalTitle === entry.festivalTitle && award.title === entry.prizeTitle && award.prize === entry.cash && award.week === entry.week))) return null;
      }
      if (s.weeklySummary && (!Array.isArray(s.weeklySummary.festivalResults) || s.weeklySummary.festivalResults.length > 500 || !s.weeklySummary.festivalResults.every(entry => festivalEntryValid(entry, true) && circuit.history.some(item => JSON.stringify(item) === JSON.stringify(entry))))) return null;
      // Later v4 chapters ask for the next film, while legacy chapters always
      // required a blockbuster. Recompute only the live derived comparison.
      if (sourceVersion < 4 && s.season > 3) { r.progress = raceScore(s, r); r.weekStartGap = raceScore(s, s) - r.progress; }
      if (r.progress !== raceScore(s, r)) return null;
      const total = key => r.history.reduce((sum, report) => sum + report.delta[key], 0);
      if (r.cash !== config.startingCash + total('cash') || r.cash - r.debt !== config.startingCash - 800 + total('wealth') || r.films.length !== total('films') || r.craft !== 12 + total('craft') || r.reputation !== 8 + total('reputation') || r.contacts !== 8 + total('contacts') || r.happiness !== 62 + total('happiness')) return null;
      if (s.weeklySummary && s.weeklySummary.rivalReport !== null && (!reportValid(s.weeklySummary.rivalReport) || !r.history.some(report => JSON.stringify(report) === JSON.stringify(s.weeklySummary.rivalReport)))) return null;
      if(!Network.valid(s)||!projects.every(p=>Network.validContract(p,s)))return null;
      s.version = VERSION;
      return s;
    } catch (_) { return null; }
  }
  return { PRODUCTION_DAYS: Workload.DAYS, getWorkload: Workload.view, BASE_HOURS, getCrowdfunding, STORY_GENRES: Stories.GENRES, VERSION, CHARACTERS, LOCATIONS, DIFFICULTIES, JOBS, ASSETS, FILM_TYPES, createGame, getActions, act, endWeek, chooseEvent, goals, getJobTitle, getFundingOptions, getCareer, getCareerPath, getReleaseForecast, getProductionRisk, getLocationBoard, getFilmCrewOptions, getFestivalSubmissions, acknowledgeSetback, acknowledgeProductionEvent: acknowledgeSetback, getRivalComparison, continueCareer, retireCareer: s => retireCareer(s, false), getLife, getLifeActions, netWorth, validateSave };
});
