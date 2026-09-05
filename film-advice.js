(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else if (root) root.FilmAdvice = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const labels = { energy: 'אנרגיה', happiness: 'אושר', craft: 'מיומנות', contacts: 'קשרים', reputation: 'מוניטין', quality: 'איכות', cash: '₪' };
  const stats = ['energy', 'happiness', 'craft', 'contacts', 'reputation', 'quality', 'cash'];
  const number = value => Number.isFinite(value) ? value : 0;
  const positive = value => Math.max(0, number(value));
  const playing = s => s && (!s.status || s.status === 'playing') && !s.productionAlert;

  // Read only public views and current resources, never a roll or pending result.
  function context(s, G) {
    const life = typeof G?.getLife === 'function' ? G.getLife(s) : null;
    const config = G?.DIFFICULTIES?.[s.difficulty];
    const living = Math.round((config?.living || 410) * (life?.city?.livingMultiplier || 1));
    const reserve = living + Math.ceil(positive(s.debt) * positive(config?.interest));
    const targets = { craft: 60, contacts: 32, reputation: 55, happiness: 68 };
    if (typeof G?.goals === 'function') for (const goal of G.goals(s) || []) {
      if (goal.id in targets && Number.isFinite(goal.target)) targets[goal.id] = goal.target;
    }
    const career = typeof G?.getCareer === 'function' ? G.getCareer(s) : null;
    for (const requirement of career?.requirements || []) {
      const match = /^(\d+) (מיומנות|קשרים|מוניטין|אושר)$/.exec(requirement.label);
      if (!match || requirement.met) continue;
      const key = Object.keys(targets).find(key => labels[key] === match[2]);
      if (key) targets[key] = Math.min(targets[key], Number(match[1]));
    }
    return { reserve, poor: number(s.cash) < reserve * 1.5, targets };
  }
  function visibleEffects(effects) {
    const result = Object.fromEntries(stats.map(key => [key, 0]));
    if (!Array.isArray(effects)) {
      for (const key of stats) result[key] = number(effects?.[key]);
      return result;
    }
    for (const text of effects) {
      if (typeof text !== 'string') continue;
      const match = /^\s*([+−-])\s*([\d,]+(?:\.\d+)?)\s*(אנרגיה|אושר|מיומנות|קשרים|מוניטין|איכות|₪)(?:\s|$)/.exec(text);
      if (!match) continue; // Do not mistake a forecast, loan or quoted price for pay.
      const key = stats.find(key => labels[key] === match[3]);
      result[key] += Number(match[2].replace(/,/g, '')) * (match[1] === '+' ? 1 : -1);
    }
    return result;
  }
  function impact(s, effects, cost) {
    const d = visibleEffects(effects);
    d.cash -= positive(cost?.money);
    d.energy -= positive(cost?.energy);
    for (const key of stats.filter(key => key !== 'cash')) {
      const current = key === 'quality' ? number(s.project?.quality) : number(s[key]);
      d[key] = Math.min(d[key], 100 - current);
    }
    return d;
  }
  function affordable(s, item, cost, d) {
    return !item.disabled && positive(cost?.money) <= number(s.cash) && positive(cost?.time) <= number(s.hours)
      && positive(cost?.energy) <= number(s.energy) && number(s.cash) + d.cash >= 0
      && number(s.energy) + d.energy >= 0;
  }
  function criticalLoss(s, d) {
    return d.energy < 0 && (number(s.energy) < 20 || number(s.energy) + d.energy < 12)
      || d.happiness < 0 && (number(s.happiness) < 20 || number(s.happiness) + d.happiness < 8);
  }
  function gains(s, d, c) {
    const weights = {
      energy: s.energy < 30 ? 9 : s.energy < 55 ? 2 : 0.6,
      happiness: s.happiness < 25 ? 8 : s.happiness < c.targets.happiness ? 2 : 0.5,
      quality: s.project ? 2 : 0, cash: c.poor ? 0.09 : 0.008
    };
    for (const key of ['craft', 'contacts', 'reputation']) weights[key] = number(s[key]) < c.targets[key] ? 3 : 0.3;
    return stats.reduce((sum, key) => sum + d[key] * weights[key], 0);
  }
  function improvementReason(s, d, c) {
    if (s.energy < 30 && d.energy > 0) return 'מחזיר אנרגיה לפני הצעד הבא.';
    if (s.happiness < 25 && d.happiness > 0) return 'נותן מקום גם לאושר שנשחק.';
    if (c.poor && d.cash > 0) return 'מוסיף מזומן להוצאות הקרובות.';
    if (c.poor && d.cash === 0) return 'שומר על המזומן שנשאר להוצאות.';
    if (d.quality > 0) return 'יכול לחזק את הסרט בלי לחרוג מהמשאבים הזמינים.';
    const key = ['craft', 'contacts', 'reputation', 'happiness', 'energy'].filter(key => d[key] > 0)
      .sort((a, b) => d[b] - d[a])[0];
    return key ? 'מוסיף ' + labels[key] + ' לצעד הבא.' : null;
  }
  function stageAction(s, id) {
    const stage = s.project?.stage;
    return stage === 'script' && id === 'home.write'
      || stage === 'shoot' && /^set\.shoot_(lean|full)$/.test(id)
      || stage === 'edit' && /^studio\.edit(_polish)?$/.test(id)
      || stage === 'release' && /^(studio\.release_commercial|festival\.release_festival)$/.test(id);
  }
  function paidWork(a, d) {
    return d.cash > 0 && (/^(set\.(work|wedding|ad|city_athens|city_london)|school\.(lecture|teach_masterclass)|festival\.jury)$/.test(a.id)
      || a.paidGig === true || a.networkKind === 'gig');
  }
  function pickAction(s, actions, G) {
    if (!playing(s) || s.event || !Array.isArray(actions)) return null;
    const c = context(s, G);
    const stageCosts = actions.filter(a => a && stageAction(s, a.id)).map(a => positive(a.cost?.money));
    const nextFilmCost = stageCosts.length ? Math.min(...stageCosts) : 0;
    let best = null;
    for (const a of actions) {
      if (!a || typeof a.id !== 'string') continue;
      if (/^(home\.write|set\.shoot_(lean|full)|studio\.edit(_polish)?|studio\.release_commercial|festival\.release_festival)$/.test(a.id) && !stageAction(s, a.id)) continue;
      const d = impact(s, a.effects, a.cost);
      const work = paidWork(a, d);
      if (/\.(network_|borrow|stock|city_|start_|buy_|repay|overtime|retire|breakup|partner_)/.test(a.id) && !work) continue;
      if (!affordable(s, a, a.cost, d) || criticalLoss(s, d)) continue;
      let score = gains(s, d, c) - positive(a.cost?.time) * 2;
      let reason = improvementReason(s, d, c);
      if (s.energy < 30 && d.energy > 0) score += 10000;
      else if (s.happiness < 20 && d.happiness > 0) score += 9000;
      else if (c.poor && work) score += 8000;
      else if (a.crewOffer) {
        const role = a.crewRole || a.role;
        const fits = a.fits === true || /^התמחות מתאימה/.test(a.fitLabel || '');
        const roleStages = { camera: ['shoot'], editor: ['edit'], sound: ['shoot', 'edit'] };
        const occupied = s.project?.crew?.some(member => member.role === role || member.id && a.id.endsWith('crew_' + member.id));
        if (!fits || occupied || !roleStages[role]?.includes(s.project?.stage) || number(s.project?.quality) >= 100
          || number(s.cash) - positive(a.cost?.money) < c.reserve + nextFilmCost) continue;
        score += 1700 + positive(a.qualityBonus) * 2;
        reason = 'התמחות שמתאימה לסרט, בלי לוותר על כרית למחיה.';
      } else if (stageAction(s, a.id)) {
        score += 1500;
        reason = s.project.stage === 'release' ? 'מוציא את הסרט שכבר השלמת לקהל.' : 'מקדם את הסרט לשלב הבא.';
      } else if (a.qualityBonus || a.forecast || a.festivalSubmission || a.lifeOffer && !work) continue;
      // Preserve a living cushion when an optional improvement costs cash.
      if (positive(a.cost?.money) && number(s.cash) - a.cost.money < c.reserve) score -= 400;
      if (score > 0 && reason && (!best || score > best.score)) best = { id: a.id, reason, score };
    }
    return best ? { id: best.id, reason: best.reason } : null;
  }
  function pickEvent(s, event, G) {
    if (!playing(s) || !event || !Array.isArray(event.options)) return null;
    const c = context(s, G);
    let best = null;
    event.options.forEach((option, index) => {
      if (!option) return;
      const filmCost = positive(option.filmCost);
      const funds = positive(s.project?.grantBudget) + positive(s.project?.crowdfunding?.balance) + positive(s.project?.contract?.balance);
      const cost = { money: positive(option.cost?.money) + Math.max(0, filmCost - funds), time: positive(option.cost?.time ?? option.hours), energy: positive(option.cost?.energy) };
      const d = impact(s, option.effects, cost);
      d.quality = Math.min(d.quality + number(option.quality), Math.max(0, 100 - number(s.project?.quality)));
      if (!affordable(s, option, cost, d) || criticalLoss(s, d)) return;
      const score = gains(s, d, c) - cost.time * 2 - (cost.money > 0 && number(s.cash) - cost.money < c.reserve ? 40 : 0);
      const reason = improvementReason(s, d, c);
      if (reason && (!best || score > best.score)) best = { index, reason, score };
    });
    return best ? { index: best.index, reason: best.reason } : null;
  }
  return Object.freeze({ pickAction, pickEvent });
});
