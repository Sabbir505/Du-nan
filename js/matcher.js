// js/matcher.js
// Works in Node (for tests) and in the browser (via <script> tag).
(function () {
  'use strict';

  function norm(s) {
    const t = String(s == null ? '' : s).trim();
    return /[A-Za-z]/.test(t) ? t.toLowerCase() : t;
  }

  // Find factory rows that match a company name, applying the suffix rule:
  // plain name `X` matches factory names `X`, `X1`, `X2`, ... (any trailing digits).
  function factoryMatches(companyName, factoryRows, factoryNameKey) {
    const c = norm(companyName);
    if (!c) return [];
    return factoryRows.filter(r => {
      const fn = norm(r[factoryNameKey]);
      if (!fn) return false;
      if (fn === c) return true;
      // suffix: factory name equals company name + one or more trailing digits
      return fn.length > c.length && fn.startsWith(c) && /^\d+$/.test(fn.slice(c.length));
    });
  }

  // Track which factory rows were consumed by a match so leftover factory rows
  // can be reported as missing from the company side.
  function matchByName(factoryRows, companyPersonRows, mappings) {
    const matched = [];
    const needsReview = [];
    const facNameKey = mappings.factory.name;
    const coNameKey  = mappings.company.name;
    const coRecKey   = mappings.company.recruiter;

    const consumed = new Set();

    for (const co of companyPersonRows) {
      const name = co[coNameKey];
      const recruiter = co[coRecKey] == null ? '' : String(co[coRecKey]).trim();
      const facs = factoryMatches(name, factoryRows, facNameKey);
      if (facs.length === 0) {
        needsReview.push({
          name, recruiter,
          reason: 'Not found in factory sheet',
          side: 'factory' // the name exists in the company sheet but not in the factory sheet
        });
      } else {
        facs.forEach((f) => consumed.add(f));
        matched.push({
          name,
          recruiter,
          company: co,
          matchedFactoryRows: facs,
          status: facs.length > 1 ? 'duplicate' : 'matched'
        });
      }
    }

    // Every factory row that no company name matched is missing from our side.
    for (const fr of factoryRows) {
      if (consumed.has(fr)) continue;
      const fn = norm(fr[facNameKey]);
      if (!fn) continue;
      needsReview.push({
        name: fn,
        recruiter: '',
        reason: 'Not found in company sheet',
        side: 'company' // the name exists in the factory sheet but not in the company sheet
      });
    }

    return { matched, needsReview };
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { matchByName, norm, factoryMatches };
  } else {
    window.HrMatcher = { matchByName, norm, factoryMatches };
  }
})();