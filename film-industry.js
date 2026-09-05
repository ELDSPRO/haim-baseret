(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FilmIndustry = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Original fictional people, festivals, prices and rules for the game only.
  // Helpers never spend money, award quality, roll randomness or mutate input.
  const FILM_LABELS = Object.freeze({ short: 'דרמה קצרה', doc: 'דוקו', comedy: 'קומדיה', feature: 'פיצ׳ר', blockbuster: 'סרט לקהל גדול' });
  const COST_SCALE = Object.freeze({ short: 1, doc: 0.85, comedy: 1.35, feature: 4, blockbuster: 8 });
  const ROLE_STAGES = Object.freeze({ camera: Object.freeze(['shoot']), editor: Object.freeze(['edit']), sound: Object.freeze(['shoot', 'edit']) });
  const ROLE_LABELS = Object.freeze({ camera: 'צילום', editor: 'עריכה', sound: 'סאונד' });
  const STAGE_NOTES = Object.freeze({ camera: 'אחרי סיום התסריט, לפני הצילום.', editor: 'אחרי הצילום, לפני נעילת העריכה.', sound: 'לפני הצילום או לפני נעילת העריכה; העסקה אחת לסרט.' });
  function freezeRows(rows) {
    return Object.freeze(rows.map(function (row) {
      Object.keys(row).forEach(function (key) { if (Array.isArray(row[key])) Object.freeze(row[key]); });
      return Object.freeze(row);
    }));
  }
  const CREW = freezeRows([
    { id: 'camera_arbel', title: 'ארבל — צילום קרוב לאנשים', role: 'camera', baseCost: 140, baseQuality: 4, fitBonus: 5, fits: ['doc', 'short'], description: 'עובד עם אור קיים ואנשים אמיתיים. גם הפלורסנט של ועד הבית מקבל יחס.' },
    { id: 'camera_maayan', title: 'מעיין — צילום בקנה מידה גדול', role: 'camera', baseCost: 180, baseQuality: 5, fitBonus: 4, fits: ['comedy', 'feature', 'blockbuster'], description: 'מתכננת תנועה, תאורה וימי צילום עמוסים. המסוק עדיין לא כלול.' },
    { id: 'editor_yael', title: 'יעל — למצוא את הסיפור', role: 'editor', baseCost: 130, baseQuality: 4, fitBonus: 5, fits: ['doc', 'short', 'feature'], description: 'מוצאת רגש וקצב בחומר מורכב. את סצנת החלום היא תמחק בעדינות.' },
    { id: 'editor_dor', title: 'דור — קצב ופאנץ׳', role: 'editor', baseCost: 150, baseQuality: 4, fitBonus: 5, fits: ['comedy', 'blockbuster'], description: 'יודע מתי לחתוך ומתי לחכות לצחוק. בעיקר כשעוד אין קהל בחדר.' },
    { id: 'sound_samir', title: 'סמיר — להקשיב לשטח', role: 'sound', baseCost: 110, baseQuality: 3, fitBonus: 4, fits: ['doc', 'short'], description: 'מציל דיאלוגים ולוקיישנים קטנים. המזגן יורד מדרגת שחקן ראשי.' },
    { id: 'sound_rotem', title: 'רותם — לבנות עולם בסאונד', role: 'sound', baseCost: 150, baseQuality: 4, fitBonus: 4, fits: ['comedy', 'feature', 'blockbuster'], description: 'דיאלוג, מוזיקה ואפקטים שעובדים יחד. הדלת תישמע יקרה יותר ממה שעלתה.' }
  ]);
  const FESTIVALS = freezeRows([
    {
      id: 'first_take', title: '״טייק ראשון״ — שבוע הסרט הקצר', fictional: true,
      description: 'פסטיבל בדיוני לסרטים קטנים עם קול משלהם. אורך שיחת הקהל אינו מוגבל.',
      eligibleTypes: ['short', 'doc', 'comedy'], fits: ['short', 'doc'], minQuality: 0, minReputation: 0,
      fee: 80, waitWeeks: 1, prize: 450, acceptanceBase: 22, qualityWeight: 0.48, fitAcceptance: 14,
      awardBase: 8, acceptanceReputation: 3, awardReputation: 8,
      prizeTitle: 'פרס הסרט הקצר של ״טייק ראשון״'
    },
    {
      id: 'israeli_screen', title: '״המסך שלנו״ — תחרות הפיצ׳ר', fictional: true,
      description: 'תחרות ישראלית בדיונית לקולנוע עלילתי ארוך. גם כאן כולם מכירים את עורך הסאונד.',
      eligibleTypes: ['feature', 'blockbuster'], fits: ['feature'], minQuality: 50, minReputation: 25,
      fee: 240, waitWeeks: 2, prize: 1600, acceptanceBase: 12, qualityWeight: 0.5, fitAcceptance: 14,
      awardBase: 7, acceptanceReputation: 5, awardReputation: 12,
      prizeTitle: 'פרס הפיצ׳ר של ״המסך שלנו״'
    },
    {
      id: 'audience_choice', title: '״יש קהל״ — חגיגת הקומדיה', fictional: true,
      description: 'פסטיבל בדיוני שבו הקהל בוחר. מותר סוף סוף לצחוק בלי להסביר את האירוניה.',
      eligibleTypes: ['short', 'doc', 'comedy', 'feature', 'blockbuster'], fits: ['comedy', 'blockbuster'], minQuality: 35, minReputation: 0,
      fee: 180, waitWeeks: 1, prize: 1100, acceptanceBase: 18, qualityWeight: 0.44, fitAcceptance: 16,
      awardBase: 10, acceptanceReputation: 4, awardReputation: 10,
      prizeTitle: 'פרס הקהל של ״יש קהל״'
    },
    {
      id: 'world_frame', title: '״פריים פתוח״ — המפגש הבינלאומי', fictional: true,
      description: 'מפגש יוצרים בינלאומי בדיוני לקול אישי. הכתוביות באנגלית; החשבונית ברורה בכל שפה.',
      eligibleTypes: ['short', 'doc', 'comedy', 'feature', 'blockbuster'], fits: ['doc', 'short', 'feature'], minQuality: 72, minReputation: 55,
      fee: 420, waitWeeks: 3, prize: 4200, acceptanceBase: 2, qualityWeight: 0.55, fitAcceptance: 12,
      awardBase: 4, acceptanceReputation: 7, awardReputation: 18,
      prizeTitle: 'פרס היוצרים של ״פריים פתוח״'
    }
  ]);
  const DISCLAIMER = 'כל אנשי הצוות, הפסטיבלים, הפרסים ותנאי ההגשה בדיוניים ונוצרו למשחק.';
  const MAX_PENDING_FESTIVALS = 12;
  const MAX_SUBMISSIONS_PER_FILM = 3;
  const clamp = function (n, low, high) { return Math.max(low, Math.min(high, n)); };
  const stat = function (value) { return Number.isFinite(value) ? clamp(value, 0, 100) : 0; };
  const knownType = function (type) { return Object.prototype.hasOwnProperty.call(FILM_LABELS, type); };
  function genreList(types) { return types.map(function (type) { return FILM_LABELS[type]; }).join(' / '); }

  /**
   * project: { type, stage, crew?: Array<string | {id, role?}> }
   * Costs and quality are previews. The engine validates resources and applies
   * each chosen qualityBonus exactly once, capped by the game's quality limit.
   */
  function getCrewOptions(project) {
    const valid = project && knownType(project.type), type = valid ? project.type : 'short';
    const hired = project && Array.isArray(project.crew) ? project.crew : [];
    const ids = hired.map(function (member) { return typeof member === 'string' ? member : member && member.id; });
    const occupiedRoles = hired.map(function (member) {
      const entry = CREW.find(function (person) { return person.id === (typeof member === 'string' ? member : member && member.id); });
      return entry ? entry.role : member && member.role;
    });
    return CREW.map(function (person) {
      const fits = person.fits.includes(type), alreadyHired = ids.includes(person.id), roleOccupied = occupiedRoles.includes(person.role);
      let reason = '';
      if (!valid) reason = 'קודם מתחילים סרט בבית.';
      else if (alreadyHired) reason = 'כבר בצוות של הסרט הזה.';
      else if (roleOccupied) reason = 'התפקיד כבר מאויש בסרט הזה. בוחרים איש מקצוע אחד לכל תפקיד.';
      else if (!ROLE_STAGES[person.role].includes(project.stage)) reason = STAGE_NOTES[person.role];
      return {
        id: person.id, title: person.title, role: person.role, roleLabel: ROLE_LABELS[person.role], description: person.description,
        cost: Math.round(person.baseCost * COST_SCALE[type] / 10) * 10,
        qualityBonus: person.baseQuality + (fits ? person.fitBonus : 0),
        baseQuality: person.baseQuality, fitBonus: fits ? person.fitBonus : 0,
        fits: fits, fitLabel: fits ? 'התמחות מתאימה ל־' + FILM_LABELS[type] : 'מקצועי גם כאן; ההתמחות היא ב־' + genreList(person.fits),
        specialtyTypes: person.fits.slice(), stages: ROLE_STAGES[person.role].slice(), stageNote: STAGE_NOTES[person.role],
        eligible: !reason, disabled: Boolean(reason), reason: reason, alreadyHired: alreadyHired, roleOccupied: roleOccupied
      };
    });
  }

  /**
   * film: a released film with {type, stage:'released', quality}.
   * state: optional {craft,reputation,week,maxWeeks}; reads no bankroll or RNG.
   * awardChance is CONDITIONAL on acceptance. Prize is paid only on an award;
   * acceptance alone gives acceptanceReputation, not the cash prize.
   * Crew affects chances through the film's final quality, never counted twice.
   * The engine owns duplicate submissions, pending/history and money checks.
   */
  function getFestivalOptions(film, state) {
    state = state || {};
    const valid = film && knownType(film.type), type = valid ? film.type : 'short';
    const quality = stat(film && film.quality), reputation = stat(state.reputation), craft = stat(state.craft);
    return FESTIVALS.map(function (festival) {
      const fits = festival.fits.includes(type);
      const acceptanceChance = clamp(Math.round(festival.acceptanceBase + quality * festival.qualityWeight + (fits ? festival.fitAcceptance : 0) + reputation * 0.05 + craft * 0.025), 5, 92);
      const awardChance = clamp(Math.round(festival.awardBase + Math.max(0, quality - 50) * 0.3 + (fits ? 6 : 0) + reputation * 0.025), 3, 40);
      const requirements = ['סרט שכבר יצא לאור'];
      if (festival.eligibleTypes.length < 5) requirements.push('סוגי סרטים: ' + genreList(festival.eligibleTypes));
      if (festival.minQuality) requirements.push(festival.minQuality + ' איכות לפחות');
      if (festival.minReputation) requirements.push(festival.minReputation + ' מוניטין לפחות');
      let reason = '';
      if (!valid || film.stage !== 'released') reason = 'קודם מפיצים את הסרט; מגישים סרט שכבר יצא לאור.';
      else if (!festival.eligibleTypes.includes(type)) reason = 'התחרות מיועדת ל־' + genreList(festival.eligibleTypes) + '.';
      else if (quality < festival.minQuality) reason = 'נדרשת איכות ' + festival.minQuality + ' לפחות; איכות הסרט: ' + Math.round(quality) + '.';
      else if (reputation < festival.minReputation) reason = 'נדרש מוניטין ' + festival.minReputation + ' לפחות.';
      else if (Number.isFinite(state.week) && Number.isFinite(state.maxWeeks) && state.week + festival.waitWeeks > state.maxWeeks) reason = 'התשובה תגיע אחרי סוף העונה. אפשר להגיש בעונת המשך.';
      return {
        id: festival.id, title: festival.title, description: festival.description, fictional: true, disclaimer: DISCLAIMER,
        fee: festival.fee, waitWeeks: festival.waitWeeks, dueWeek: Number.isFinite(state.week) ? state.week + festival.waitWeeks : null,
        acceptanceChance: acceptanceChance, awardChance: awardChance, awardChanceConditional: true,
        prize: festival.prize, prizeTitle: festival.prizeTitle,
        acceptanceReputation: festival.acceptanceReputation, awardReputation: festival.awardReputation,
        fits: fits, fitLabel: fits ? 'התאמה טובה: ' + FILM_LABELS[type] : 'מתקבלים גם קולות אחרים; הדגש כאן הוא ' + genreList(festival.fits),
        minQuality: festival.minQuality, minReputation: festival.minReputation, eligibleTypes: festival.eligibleTypes.slice(), requirements: requirements,
        eligible: !reason, disabled: Boolean(reason), reason: reason
      };
    });
  }

  // A film may visit several festivals at once, and each festival may receive
  // several of the player's films. Only an already submitted film/festival pair
  // is a duplicate. This read-only planner never changes a saved entry's odds.
  function getFestivalSubmissionOptions(films, state) {
    state = state || {};
    const circuit = state.festivalCircuit || {};
    const pending = Array.isArray(circuit.pending) ? circuit.pending : [];
    const history = Array.isArray(circuit.history) ? circuit.history : [];
    const allEntries = pending.concat(history);
    return (Array.isArray(films) ? films : []).flatMap(function (film) {
      const filmEntries = Array.isArray(film.festivalEntries) ? film.festivalEntries : [];
      return getFestivalOptions(film, state).map(function (festival) {
        const id = film.id + '-' + festival.id;
        const existing = filmEntries.includes(id) || allEntries.some(function (entry) {
          return entry.id === id || entry.filmId === film.id && entry.festivalId === festival.id;
        });
        let reason = existing ? 'הסרט כבר הוגש לפסטיבל הזה.' : '';
        if (!reason && filmEntries.length >= MAX_SUBMISSIONS_PER_FILM) reason = 'שלוש ההגשות המותרות לסרט כבר נוצלו.';
        if (!reason && pending.length >= MAX_PENDING_FESTIVALS) reason = 'יש כבר 12 הגשות שממתינות לתשובה. עם הגעת תשובות יתפנה מקום להגשות נוספות.';
        if (!reason && Number.isFinite(state.retirementRounds) && festival.waitWeeks > state.retirementRounds) reason = 'התשובה תגיע לאחר גיל 85 בקצב ההפקה הנוכחי. אין חיוב על הגשה שלא תספיק.';
        if (!reason) reason = festival.reason;
        return Object.assign({}, festival, {
          id: id, filmId: film.id, filmTitle: film.title,
          festivalId: festival.id, festivalTitle: festival.title,
          actionId: 'festival.submit_' + film.id + '_' + festival.id,
          alreadySubmitted: existing, pendingCount: pending.length,
          pendingLimit: MAX_PENDING_FESTIVALS, submissionLimit: MAX_SUBMISSIONS_PER_FILM,
          eligible: !reason, disabled: Boolean(reason), reason: reason
        });
      });
    });
  }
  return Object.freeze({ CREW: CREW, FESTIVALS: FESTIVALS, DISCLAIMER: DISCLAIMER, MAX_PENDING_FESTIVALS: MAX_PENDING_FESTIVALS, MAX_SUBMISSIONS_PER_FILM: MAX_SUBMISSIONS_PER_FILM, getCrewOptions: getCrewOptions, getFestivalOptions: getFestivalOptions, getFestivalSubmissionOptions: getFestivalSubmissionOptions });
});
