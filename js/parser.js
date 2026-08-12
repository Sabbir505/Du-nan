// js/parser.js
// Works in Node (for tests) and in the browser (via <script> tag).
(function () {
  'use strict';
  const XLSXLib = (typeof require === 'function' && typeof module !== 'undefined' && module.exports)
    ? require('../vendor/xlsx.full.min.js')
    : (typeof window !== 'undefined' ? window.XLSX : globalThis.XLSX);

  // Build a list of unique, stable keys for each column index.
  // - If a header text is non-empty AND unique among all headers, use it.
  // - Otherwise (empty, or a duplicate like the two 费用金额 columns) use a
  //   synthetic key "__col{index}" so callers can still address every column.
  function buildKeys(rawHeaders) {
    const counts = {};
    for (const h of rawHeaders) {
      const label = h == null ? '' : String(h).trim();
      if (label) counts[label] = (counts[label] || 0) + 1;
    }
    const seen = {};
    return rawHeaders.map((h, i) => {
      const label = h == null ? '' : String(h).trim();
      if (label && counts[label] === 1 && !seen[label]) {
        seen[label] = true;
        return label;
      }
      return `__col${i}`;
    });
  }

  function parseWorkbook(uint8Array) {
    const wb = XLSXLib.read(uint8Array, { type: 'array' });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rowsArr = XLSXLib.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
    if (rowsArr.length === 0) return { sheetName, headers: [], rows: [] };
    const rawHeaders = rowsArr[0];
    const keys = buildKeys(rawHeaders);
    // headers exposed to callers keep the original (possibly empty) label, but
    // every row object is keyed by the unique `keys` so collisions are impossible.
    const headers = keys.map((k, i) => k.startsWith('__col') ? (rawHeaders[i] == null ? '' : String(rawHeaders[i]).trim()) : k);
    const rows = rowsArr.slice(1).map(r => {
      const obj = {};
      keys.forEach((k, i) => { obj[k] = r[i] == null ? null : r[i]; });
      return obj;
    });
    return { sheetName, headers, keys, rows };
  }

  // classify Sheet 2 rows into person rows (name non-empty) vs subtotal rows
  // (name empty but recruiter non-empty); everything else is discarded.
  function classifyCompanyRows(rows, mappings) {
    const personRows = [];
    const subtotalRows = [];
    for (const row of rows) {
      const name = (row[mappings.name] == null ? '' : String(row[mappings.name])).trim();
      const recr = (row[mappings.recruiter] == null ? '' : String(row[mappings.recruiter])).trim();
      if (name) personRows.push(row);
      else if (recr) subtotalRows.push(row);
      // else: discarded (blank separator)
    }
    return { personRows, subtotalRows };
  }

  // Detect a headerless recruiter column: the column whose cell is a short
  // non-numeric string on rows where the name column is empty (the subtotal
  // rows), and which is not the name column itself. Returns the column key,
  // or '' if no plausible candidate is found.
  function detectRecruiterColumn(keys, rows, nameKey) {
    let bestIdx = -1, bestScore = -1;
    keys.forEach((k, i) => {
      if (k === nameKey) return;
      let score = 0;
      for (const r of rows) {
        const nm = (r[nameKey] == null ? '' : String(r[nameKey])).trim();
        if (nm) continue;
        const v = r[k];
        if (v != null) {
          const s = String(v).trim();
          if (s.length > 0 && s.length <= 8 && isNaN(Number(s))) score++;
        }
      }
      if (score > bestScore) { bestScore = score; bestIdx = i; }
    });
    return bestIdx >= 0 && bestScore > 0 ? keys[bestIdx] : '';
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseWorkbook, classifyCompanyRows, detectRecruiterColumn, buildKeys };
  } else {
    window.HrParser = { parseWorkbook, classifyCompanyRows, detectRecruiterColumn, buildKeys };
  }
})();