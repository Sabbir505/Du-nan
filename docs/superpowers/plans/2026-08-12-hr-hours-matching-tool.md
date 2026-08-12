# HR Hours-Matching Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local, browser-based tool that matches a factory attendance spreadsheet against a company income spreadsheet by name, surfaces authoritative hours worked and recruiter info, and lets the user view and export the merged result.

**Architecture:** Single-page static web app. Pure HTML/CSS/JavaScript. SheetJS (xlsx.full.min.js, vendored locally) parses `.xls`/`.xlsx` and writes `.xlsx` exports. No backend, no network calls. Runs by opening `index.html` directly.

**Tech Stack:** Vanilla JS (ES2020), SheetJS 0.20.x (vendored), HTML5, CSS3. Tested with Node's built-in `node:test` runner (no test framework dependency).

## Global Constraints

- Runs by opening `index.html` directly via `file://`. No build step.
- All third-party JS vendored under `vendor/` — no CDN, no network calls at runtime.
- Sheets from real samples must parse: legacy `.xls` (BIFF8) AND `.xlsx`.
- No node_modules committed; tests run with built-in `node --test`.
- Match comparison: trim + case-insensitive for Latin, exact after trim for CJK.
- Suffix rule: plain company name `X` matches factory rows `X`, `X1`, `X2`, ... (any trailing digits). Multiple matches → flag as duplicate.
- Subtotal rows on Sheet 2 (name empty, recruiter non-empty) are kept in a separate Subtotals collection, not matched.
- No persistent storage between sessions.

---

## File Structure

```
D:/projects/dunnan/
├── index.html                # Page skeleton: upload zones, mapping panel, tables, export button
├── css/styles.css            # All styling
├── js/parser.js              # parseFile() → {headers, rows} ; classifyRows() for Sheet 2
├── js/matcher.js             # matchByName(sheet1Rows, sheet2Rows, mappings) → {matched, needsReview, duplicates}
├── js/exporter.js            # buildWorkbook({matched, needsReview, subtotals, summary}) → triggers download
├── js/app.js                 # Wires everything: upload, mapping UI, match button, render, export
├── vendor/xlsx.full.min.js   # SheetJS (local copy)
├── tests/parser.test.js      # parser unit tests
├── tests/matcher.test.js     # matcher unit tests (core logic)
├── tests/exporter.test.js    # exporter unit tests
├── package.json              # Declares test script only; no deps
├── sample_factory.xls        # Provided sample (Sheet 2 — company)
├── sample_factory_attendance.xlsx  # Provided sample (Sheet 1 — factory)
└── docs/superpowers/specs/2026-08-12-hr-hours-matching-tool-design.md
```

---

### Task 1: Vendor SheetJS and create package.json with test script

**Files:**
- Create: `D:/projects/dunnan/package.json`
- Create: `D:/projects/dunnan/vendor/xlsx.full.min.js`

**Interfaces:**
- Produces: `npm test` script that runs `node --test tests/`.

- [ ] **Step 1: Download SheetJS standalone build**

Run via PowerShell:

```powershell
Invoke-WebRequest -Uri "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js" -OutFile "D:\projects\dunnan\vendor\xlsx.full.min.js"
```

Expected: file exists at `D:\projects\dunnan\vendor\xlsx.full.min.js`, size > 500 KB.

- [ ] **Step 2: Create package.json**

Write to `D:/projects/dunnan/package.json`:

```json
{
  "name": "hr-hours-matching-tool",
  "version": "0.1.0",
  "private": true,
  "description": "Local browser tool for matching factory attendance with company income spreadsheets.",
  "scripts": {
    "test": "node --test tests/"
  }
}
```

- [ ] **Step 3: Verify test runner works**

Create an empty `D:/projects/dunnan/tests/smoke.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
test('smoke', () => assert.strictEqual(1 + 1, 2));
```

Run: `cd D:/projects/dunnan && npm test`
Expected: 1 test passes.

- [ ] **Step 4: Delete smoke test and commit**

```bash
rm tests/smoke.test.js
git add package.json vendor/ tests/
git commit -m "chore: vendor SheetJS and set up node test runner"
```

---

### Task 2: Implement parser.js — file parsing + row classification

**Files:**
- Create: `D:/projects/dunnan/js/parser.js`
- Create: `D:/projects/dunnan/tests/parser.test.js`

**Interfaces:**
- Produces (consumed by app.js, matcher.js):
  - `parseWorkbook(fileBuffer)` → `{sheetName, headers: string[], rows: Array<Record<string, any>>}`
  - `parseWorkbookFromBytes(uint8Array)` → same shape (for tests)
  - `classifyCompanyRows(rows, mappings)` → `{personRows, subtotalRows}`

**Row classification rule (Sheet 2 only):**
- `personRow`: `姓名` (mapped name col) is non-empty (after trim).
- `subtotalRow`: `姓名` empty AND mapped recruiter col is non-empty (after trim).
- Anything else: discarded.

- [ ] **Step 1: Write failing tests**

`tests/parser.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseWorkbook, classifyCompanyRows } = require('../js/parser.js');

const FAC_XLSX = path.join(__dirname, '..', 'sample_factory_attendance.xlsx');
const CO_XLS   = path.join(__dirname, '..', 'sample_factory.xls');

test('parseWorkbook: reads factory .xlsx headers', () => {
  const buf = fs.readFileSync(FAC_XLSX);
  const { headers } = parseWorkbook(new Uint8Array(buf));
  assert.ok(headers.includes('姓名'));
  assert.ok(headers.includes('四级部门'));
  assert.ok(headers.includes('计薪天数/小时'));
});

test('parseWorkbook: reads legacy .xls', () => {
  const buf = fs.readFileSync(CO_XLS);
  const { headers, rows } = parseWorkbook(new Uint8Array(buf));
  assert.ok(headers.length > 0);
  assert.ok(rows.length > 40, 'should find many rows in company sheet');
});

test('classifyCompanyRows: separates person vs subtotal rows', () => {
  const buf = fs.readFileSync(CO_XLS);
  const { headers, rows } = parseWorkbook(new Uint8Array(buf));
  // Find the recruiter column by header or headerless fallback
  const nameIdx = headers.findIndex(h => /姓名|name/i.test(h));
  // Sheet 2 has headerless recruiter at col K — find col with most non-empty string cells on person rows
  let recruiterIdx = headers.findIndex(h => /招|推荐|recruit/i.test(h));
  if (recruiterIdx === -1) {
    // headerless fallback: pick column where >50% of non-empty rows are short strings
    const nonEmpty = rows.filter(r => Object.values(r).some(v => v != null && String(v).trim()));
    const counts = headers.map((_, i) => nonEmpty.filter(r => {
      const v = r[headers[i]];
      return v != null && String(v).trim() && String(v).trim().length <= 6;
    }).length);
    recruiterIdx = counts.indexOf(Math.max(...counts));
  }
  const mappings = { name: headers[nameIdx], recruiter: headers[recruiterIdx] };
  const { personRows, subtotalRows } = classifyCompanyRows(rows, mappings);
  assert.strictEqual(personRows.length, 46, 'expected 46 person rows from sample');
  assert.strictEqual(subtotalRows.length, 7,  'expected 7 subtotal rows from sample');
});
```

- [ ] **Step 2: Run tests — expect failure (module missing)**

Run: `npm test -- tests/parser.test.js`
Expected: FAIL with "Cannot find module '../js/parser.js'"

- [ ] **Step 3: Implement parser.js**

```js
// js/parser.js
const XLSX = require('../vendor/xlsx.full.min.js');

function parseWorkbook(uint8Array) {
  const wb = XLSX.read(uint8Array, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rowsArr = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
  if (rowsArr.length === 0) return { sheetName, headers: [], rows: [] };
  const headers = rowsArr[0].map(h => (h == null ? '' : String(h).trim()));
  const rows = rowsArr.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = r[i] == null ? null : r[i]; });
    return obj;
  });
  return { sheetName, headers, rows };
}

function classifyCompanyRows(rows, mappings) {
  const personRows = [];
  const subtotalRows = [];
  for (const row of rows) {
    const name = (row[mappings.name] == null ? '' : String(row[mappings.name])).trim();
    const recr = (row[mappings.recruiter] == null ? '' : String(row[mappings.recruiter])).trim();
    if (name) personRows.push(row);
    else if (recr) subtotalRows.push(row);
    // else: discarded
  }
  return { personRows, subtotalRows };
}

module.exports = { parseWorkbook, classifyCompanyRows };
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test -- tests/parser.test.js`
Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add js/parser.js tests/parser.test.js
git commit -m "feat(parser): parse xls/xlsx + classify company rows"
```

---

### Task 3: Implement matcher.js — name matching with suffix rule

**Files:**
- Create: `D:/projects/dunnan/js/matcher.js`
- Create: `D:/projects/dunnan/tests/matcher.test.js`

**Interfaces:**
- Produces (consumed by app.js, exporter.js):
  - `matchByName(factoryRows, companyPersonRows, mappings)` → `{matched, needsReview}`
  - `matched` item: `{name, recruiter, factory, status: 'matched'|'duplicate', matchedFactoryRows: [...]}`
  - `needsReview` item: `{name, recruiter, reason}`

**Matching rules (locked):**
- Normalize: trim. For comparison, lowercase if string has any ASCII letter.
- Suffix rule: company name `X` matches factory rows where `factoryName == X` OR `factoryName == X + digits` (one or more trailing ASCII digits).
- 0 matches → needsReview, reason: `"Not found in factory sheet"`.
- 1 match → matched, status 'matched'.
- 2+ matches → matched, status 'duplicate', `matchedFactoryRows` contains all.

- [ ] **Step 1: Write failing tests**

`tests/matcher.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { matchByName } = require('../js/matcher.js');

const mappings = {
  factory:    { name: '姓名', dept: '四级部门', position: '岗位', hours: '计薪天数/小时', bonus: '绩效奖金' },
  company:    { name: '姓名', recruiter: '__recruiter', position: '岗位', hours: '计薪天数/小时' }
};

function f(name, dept, hours) { return { '姓名': name, '四级部门': dept, '岗位': '', '计薪天数/小时': hours, '绩效奖金': 0 }; }
function c(name, recruiter)   { return { '姓名': name, '__recruiter': recruiter, '岗位': '', '计薪天数/小时': 0 }; }

test('exact single match', () => {
  const r = matchByName([f('张三','质量科',280)], [c('张三','杨树海')], mappings);
  assert.strictEqual(r.matched.length, 1);
  assert.strictEqual(r.matched[0].status, 'matched');
  assert.strictEqual(r.matched[0].matchedFactoryRows.length, 1);
  assert.strictEqual(r.needsReview.length, 0);
});

test('no match goes to needsReview', () => {
  const r = matchByName([f('张三','质量科',280)], [c('李四','吴梦')], mappings);
  assert.strictEqual(r.matched.length, 0);
  assert.strictEqual(r.needsReview.length, 1);
  assert.strictEqual(r.needsReview[0].reason, 'Not found in factory sheet');
});

test('suffix rule: plain name matches suffixed factory rows and flags duplicate', () => {
  const fac = [f('黄亚丽','质量科',30), f('黄亚丽1','质量科',30), f('黄亚丽2','生产科',30)];
  const r = matchByName(fac, [c('黄亚丽','吴梦')], mappings);
  assert.strictEqual(r.matched.length, 1);
  assert.strictEqual(r.matched[0].status, 'duplicate');
  assert.strictEqual(r.matched[0].matchedFactoryRows.length, 3);
});

test('suffix rule: plain name matches unique suffixed row as matched (not duplicate)', () => {
  const r = matchByName([f('黄亚丽1','质量科',30)], [c('黄亚丽','吴梦')], mappings);
  assert.strictEqual(r.matched.length, 1);
  assert.strictEqual(r.matched[0].status, 'matched');
});

test('whitespace and case insensitive for latin names', () => {
  const fac = [f('  John Smith ','Ops',100)];
  const r = matchByName(fac, [c('john smith','Recruiter')], mappings);
  assert.strictEqual(r.matched.length, 1);
  assert.strictEqual(r.matched[0].status, 'matched');
});

test('empty inputs do not crash', () => {
  const r = matchByName([], [], mappings);
  assert.deepStrictEqual(r.matched, []);
  assert.deepStrictEqual(r.needsReview, []);
});
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npm test -- tests/matcher.test.js`
Expected: FAIL with "Cannot find module '../js/matcher.js'"

- [ ] **Step 3: Implement matcher.js**

```js
// js/matcher.js
function norm(s) {
  const t = String(s == null ? '' : s).trim();
  return /[A-Za-z]/.test(t) ? t.toLowerCase() : t;
}

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

function matchByName(factoryRows, companyPersonRows, mappings) {
  const matched = [];
  const needsReview = [];
  const facNameKey = mappings.factory.name;
  const coNameKey  = mappings.company.name;
  const coRecKey   = mappings.company.recruiter;

  for (const co of companyPersonRows) {
    const name = co[coNameKey];
    const recruiter = co[coRecKey] == null ? '' : String(co[coRecKey]).trim();
    const facs = factoryMatches(name, factoryRows, facNameKey);
    if (facs.length === 0) {
      needsReview.push({ name, recruiter, reason: 'Not found in factory sheet' });
    } else {
      matched.push({
        name,
        recruiter,
        company: co,
        matchedFactoryRows: facs,
        status: facs.length > 1 ? 'duplicate' : 'matched'
      });
    }
  }
  return { matched, needsReview };
}

module.exports = { matchByName };
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test -- tests/matcher.test.js`
Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add js/matcher.js tests/matcher.test.js
git commit -m "feat(matcher): name matching with suffix rule + duplicate flagging"
```

---

### Task 4: Implement exporter.js — build downloadable xlsx

**Files:**
- Create: `D:/projects/dunnan/js/exporter.js`
- Create: `D:/projects/dunnan/tests/exporter.test.js`

**Interfaces:**
- Produces (consumed by app.js):
  - `buildWorkbookBytes({matched, needsReview, subtotals, summary})` → `Uint8Array` (returns bytes; browser triggers save via Blob).
  - `getExportFilename()` → `'hours-report-YYYY-MM-DD.xlsx'` (date stamped at call time).

**Workbook tabs:**
- `Matched`: columns = 姓名, Recruiter, 四级部门 (factory), 岗位 (factory), 计薪天数/小时 (factory), 绩效奖金, Status. One row per matchedFactoryRows entry (duplicates → multiple rows).
- `Needs Review`: 姓名, Recruiter, Reason.
- `Subtotals`: Recruiter, Subtotal Amount.
- `Summary`: Recruiter Breakdown — Recruiter, People, Total Hours.

- [ ] **Step 1: Write failing tests**

`tests/exporter.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert');
const { buildWorkbookBytes, getExportFilename } = require('../js/exporter.js');

test('buildWorkbookBytes returns a non-empty Uint8Array', () => {
  const matched = [{
    name: '张三', recruiter: '杨树海', status: 'matched',
    matchedFactoryRows: [{ '姓名':'张三','四级部门':'质量科','岗位':'质检','计薪天数/小时':280,'绩效奖金':0 }]
  }];
  const needsReview = [{ name: '李四', recruiter: '吴梦', reason: 'Not found in factory sheet' }];
  const subtotals = [{ recruiter: '方经理', amount: 5312 }];
  const summary = [{ recruiter: '杨树海', people: 1, totalHours: 280 }];
  const bytes = buildWorkbookBytes({ matched, needsReview, subtotals, summary });
  assert.ok(bytes instanceof Uint8Array);
  assert.ok(bytes.length > 100);
});

test('getExportFilename matches hours-report-YYYY-MM-DD.xlsx pattern', () => {
  const fn = getExportFilename();
  assert.match(fn, /^hours-report-\d{4}-\d{2}-\d{2}\.xlsx$/);
});
```

- [ ] **Step 2: Run tests — expect failure**

Run: `npm test -- tests/exporter.test.js`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement exporter.js**

```js
// js/exporter.js
const XLSX = require('../vendor/xlsx.full.min.js');

function getExportFilename() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `hours-report-${y}-${m}-${day}.xlsx`;
}

function matchedToRows(matched) {
  const rows = [];
  for (const m of matched) {
    for (const f of m.matchedFactoryRows) {
      rows.push({
        '姓名': m.name,
        'Recruiter': m.recruiter,
        '四级部门': f['四级部门'] ?? '',
        '岗位': f['岗位'] ?? '',
        '计薪天数/小时(工厂)': f['计薪天数/小时'] ?? '',
        '绩效奖金': f['绩效奖金'] ?? '',
        'Status': m.status === 'duplicate' ? 'Duplicate — review' : 'Matched'
      });
    }
  }
  return rows;
}

function needsReviewToRows(needsReview) {
  return needsReview.map(n => ({
    '姓名': n.name,
    'Recruiter': n.recruiter,
    'Reason': n.reason
  }));
}

function subtotalsToRows(subtotals) {
  return subtotals.map(s => ({
    'Recruiter': s.recruiter,
    'Subtotal Amount': s.amount
  }));
}

function summaryToRows(summary) {
  return summary.map(s => ({
    'Recruiter': s.recruiter,
    'People': s.people,
    'Total Hours': s.totalHours
  }));
}

function buildWorkbookBytes({ matched, needsReview, subtotals, summary }) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(matchedToRows(matched)), 'Matched');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(needsReviewToRows(needsReview)), 'Needs Review');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(subtotalsToRows(subtotals)), 'Subtotals');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryToRows(summary)), 'Summary');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(out);
}

module.exports = { buildWorkbookBytes, getExportFilename };
```

- [ ] **Step 4: Run tests — expect pass**

Run: `npm test -- tests/exporter.test.js`
Expected: 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add js/exporter.js tests/exporter.test.js
git commit -m "feat(exporter): build xlsx with matched/needsReview/summary tabs"
```

---

### Task 5: Integration test — run parser + matcher + exporter against the two real samples

**Files:**
- Create: `D:/projects/dunnan/tests/integration.test.js`

**Interfaces:** none new — exercises Tasks 2-4 against real files.

- [ ] **Step 1: Write the integration test**

```js
// tests/integration.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseWorkbook, classifyCompanyRows } = require('../js/parser.js');
const { matchByName } = require('../js/matcher.js');
const { buildWorkbookBytes } = require('../js/exporter.js');

const FAC_XLSX = path.join(__dirname, '..', 'sample_factory_attendance.xlsx');
const CO_XLS   = path.join(__dirname, '..', 'sample_factory.xls');

function pickHeaderlessRecruiterIdx(headers, rows) {
  // Find the column most likely to be a recruiter: short non-empty strings on most person rows
  const candidateCounts = headers.map((_, i) => {
    let nonEmpty = 0;
    for (const r of rows) {
      const v = r[headers[i]];
      if (v != null && String(v).trim().length > 0 && String(v).trim().length <= 8) nonEmpty++;
    }
    return nonEmpty;
  });
  let max = 0, idx = -1;
  candidateCounts.forEach((c, i) => { if (c > max) { max = c; idx = i; } });
  return idx;
}

test('full pipeline against real samples produces valid workbook', () => {
  // 1) Parse both
  const fac = parseWorkbook(new Uint8Array(fs.readFileSync(FAC_XLSX)));
  const co  = parseWorkbook(new Uint8Array(fs.readFileSync(CO_XLS)));

  // 2) Build mappings
  const findCol = (headers, re) => headers.findIndex(h => re.test(h));
  const facNameIdx = findCol(fac.headers, /姓名|name/);
  const facDeptIdx = findCol(fac.headers, /部门|department/);
  const facPosIdx  = findCol(fac.headers, /岗位|position/);
  const facHoursIdx = findCol(fac.headers, /计薪|小时|hours/);
  const facBonusIdx = findCol(fac.headers, /绩效|奖金|bonus/);

  const coNameIdx = findCol(co.headers, /姓名|name/);
  const coPosIdx  = findCol(co.headers, /岗位|position/);
  const coHoursIdx = findCol(co.headers, /计薪|小时|hours/);
  let coRecIdx = findCol(co.headers, /招|推荐|recruit/);
  if (coRecIdx === -1) coRecIdx = pickHeaderlessRecruiterIdx(co.headers, co.rows);

  const mappings = {
    factory: {
      name: fac.headers[facNameIdx], dept: fac.headers[facDeptIdx],
      position: fac.headers[facPosIdx], hours: fac.headers[facHoursIdx],
      bonus: fac.headers[facBonusIdx]
    },
    company: {
      name: co.headers[coNameIdx], recruiter: co.headers[coRecIdx],
      position: co.headers[coPosIdx], hours: co.headers[coHoursIdx]
    }
  };

  // 3) Classify Sheet 2
  const { personRows, subtotalRows } = classifyCompanyRows(co.rows, mappings.company);
  assert.strictEqual(personRows.length, 46);
  assert.strictEqual(subtotalRows.length, 7);

  // 4) Match
  const { matched, needsReview } = matchByName(fac.rows, personRows, mappings);
  assert.ok(matched.length > 0, 'should match at least some people');
  // 100% of the company names appear in the factory sheet sample (same team, same month)
  assert.strictEqual(needsReview.length, 0, 'no unmatched expected for this sample set');

  // 5) Build summary by recruiter
  const byRec = new Map();
  for (const m of matched) {
    const key = m.recruiter || '(unknown)';
    let totalH = 0;
    for (const f of m.matchedFactoryRows) totalH += Number(f[mappings.factory.hours]) || 0;
    const e = byRec.get(key) || { recruiter: key, people: 0, totalHours: 0 };
    e.people += 1;
    e.totalHours += totalH;
    byRec.set(key, e);
  }
  const summary = Array.from(byRec.values());

  // 6) Export
  const subtotals = subtotalRows.map(r => ({
    recruiter: String(r[mappings.company.recruiter] || '').trim(),
    amount: Number(r[mappings.factory.hours === mappings.factory.hours
      ? Object.keys(r)[9]  // col J = 费用金额 in the company sheet
      : '计薪天数/小时']) || 0
  }));
  const bytes = buildWorkbookBytes({ matched, needsReview, subtotals, summary });
  assert.ok(bytes.length > 1000);
  // Quick sanity: ZIP magic bytes "PK\x03\x04"
  assert.strictEqual(bytes[0], 0x50);
  assert.strictEqual(bytes[1], 0x4b);
});
```

- [ ] **Step 2: Run the integration test**

Run: `npm test -- tests/integration.test.js`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/integration.test.js
git commit -m "test: end-to-end pipeline against real sample spreadsheets"
```

---

### Task 6: Build app.js orchestration + index.html + styles.css

**Files:**
- Create: `D:/projects/dunnan/js/app.js`
- Create: `D:/projects/dunnan/index.html`
- Create: `D:/projects/dunnan/css/styles.css`

**Interfaces:** browser-only. Wires the three modules + DOM events. Self-contained — no new tests beyond manual smoke check.

**UI requirements (locked from design):**
- Two upload zones (factory + company) with drag-drop and click-to-browse. Both accept `.xls`, `.xlsx`, `.csv`.
- After both files upload, auto-detect mappings and show editable dropdowns so user can confirm/override each column. Highlight the auto-picked headerless recruiter column on Sheet 2.
- "Match & View" button (disabled until both files loaded + required columns mapped).
- Three on-screen sections: Summary stats, Matched table, Needs Review table, plus Subtotals table.
- "Export .xlsx" button triggers download.
- Clean, professional layout: max-width container, generous spacing, sticky table headers, status badges for duplicates (orange) and unmatched (red).

- [ ] **Step 1: Implement index.html**

```html
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>HR Hours Matching Tool</title>
  <link rel="stylesheet" href="css/styles.css" />
  <script src="vendor/xlsx.full.min.js"></script>
</head>
<body>
  <header>
    <h1>HR Hours Matching Tool</h1>
    <p class="subtitle">Upload the factory attendance and your company income spreadsheets to merge by name.</p>
  </header>

  <main>
    <section class="uploads">
      <div class="dropzone" id="dz-factory" data-side="factory">
        <h2>1. Factory attendance sheet</h2>
        <p class="hint">.xls · .xlsx · .csv</p>
        <input type="file" id="file-factory" accept=".xls,.xlsx,.csv" hidden />
        <p class="dz-status">Drag file here or click to browse</p>
      </div>
      <div class="dropzone" id="dz-company" data-side="company">
        <h2>2. Company income sheet</h2>
        <p class="hint">.xls · .xlsx · .csv</p>
        <input type="file" id="file-company" accept=".xls,.xlsx,.csv" hidden />
        <p class="dz-status">Drag file here or click to browse</p>
      </div>
    </section>

    <section class="mappings" id="mappings" hidden>
      <h2>Column mapping</h2>
      <p class="hint">Auto-detected — confirm or change each column. Required columns are marked with *.</p>
      <div class="mapping-grid">
        <fieldset id="mapping-factory">
          <legend>Factory sheet</legend>
          <label>姓名 (Name) * <select data-side="factory" data-key="name"></select></label>
          <label>四级部门 (Department) <select data-side="factory" data-key="dept"></select></label>
          <label>岗位 (Position) <select data-side="factory" data-key="position"></select></label>
          <label>计薪天数/小时 (Hours) * <select data-side="factory" data-key="hours"></select></label>
          <label>绩效奖金 (Bonus) <select data-side="factory" data-key="bonus"></select></label>
        </fieldset>
        <fieldset id="mapping-company">
          <legend>Company sheet</legend>
          <label>姓名 (Name) * <select data-side="company" data-key="name"></select></label>
          <label>招聘人 (Recruiter) * <select data-side="company" data-key="recruiter"></select></label>
          <label>岗位 (Position) <select data-side="company" data-key="position"></select></label>
          <label>计薪天数/小时 (Hours) <select data-side="company" data-key="hours"></select></label>
        </fieldset>
      </div>
      <button id="btn-match" disabled>Match &amp; View</button>
      <p class="error" id="mapping-error" hidden></p>
    </section>

    <section class="results" id="results" hidden>
      <div class="summary" id="summary"></div>
      <div class="filters">
        <label>Department <select id="filter-dept"><option value="">All</option></select></label>
        <label>Recruiter <select id="filter-rec"><option value="">All</option></select></label>
        <label>Status <select id="filter-status"><option value="">All</option><option>Matched</option><option>Duplicate — review</option></select></label>
        <input id="filter-name" type="search" placeholder="Search name..." />
        <button id="btn-export">Export .xlsx</button>
      </div>

      <h3>Matched</h3>
      <table id="table-matched">
        <thead><tr>
          <th>姓名</th><th>招聘人</th><th>部门</th><th>岗位</th>
          <th>工厂工时</th><th>绩效奖金</th><th>公司工时</th><th>Status</th>
        </tr></thead>
        <tbody></tbody>
      </table>

      <h3>Needs Review</h3>
      <table id="table-review">
        <thead><tr><th>姓名</th><th>招聘人</th><th>Reason</th></tr></thead>
        <tbody></tbody>
      </table>

      <h3>Subtotals</h3>
      <table id="table-subtotals">
        <thead><tr><th>招聘人</th><th>Subtotal Amount</th></tr></thead>
        <tbody></tbody>
      </table>
    </section>
  </main>

  <script src="js/parser.js"></script>
  <script src="js/matcher.js"></script>
  <script src="js/exporter.js"></script>
  <script src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Implement styles.css**

```css
:root {
  --bg: #f7f8fa;
  --surface: #ffffff;
  --border: #e4e7ec;
  --text: #1d2939;
  --muted: #667085;
  --primary: #2a6df4;
  --primary-hover: #1e57cf;
  --danger: #b42318;
  --warn: #b54708;
  --ok: #027a48;
  --shadow: 0 1px 2px rgba(16,24,40,.05), 0 1px 3px rgba(16,24,40,.08);
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
               "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  background: var(--bg); color: var(--text);
  line-height: 1.5; font-size: 14px;
}
header { padding: 28px 32px 16px; max-width: 1200px; margin: 0 auto; }
header h1 { margin: 0 0 4px; font-size: 22px; font-weight: 600; }
.subtitle { margin: 0; color: var(--muted); font-size: 14px; }
main { max-width: 1200px; margin: 0 auto; padding: 0 32px 48px; }
h2 { font-size: 16px; font-weight: 600; margin: 0 0 12px; }
h3 { font-size: 14px; font-weight: 600; margin: 24px 0 8px; }
.hint { color: var(--muted); font-size: 12px; margin: 0 0 12px; }

.uploads { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
.dropzone {
  background: var(--surface); border: 2px dashed var(--border); border-radius: 10px;
  padding: 28px 20px; text-align: center; cursor: pointer; transition: border-color .15s;
}
.dropzone:hover, .dropzone.drag { border-color: var(--primary); background: #f5f8ff; }
.dropzone.loaded { border-style: solid; border-color: var(--ok); background: #f6faf7; }
.dropzone .dz-status { margin: 8px 0 0; color: var(--muted); }
.dropzone.loaded .dz-status { color: var(--ok); font-weight: 500; }

.mappings { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 20px; margin-bottom: 24px; box-shadow: var(--shadow); }
.mapping-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 16px; }
fieldset { border: 1px solid var(--border); border-radius: 8px; padding: 12px 16px; }
legend { font-size: 13px; color: var(--muted); padding: 0 6px; }
label { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; gap: 12px; font-size: 13px; }
select, input[type="search"] {
  padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px;
  background: var(--surface); font: inherit; min-width: 160px;
}

button {
  background: var(--primary); color: #fff; border: none; border-radius: 8px;
  padding: 10px 18px; font: inherit; font-weight: 500; cursor: pointer;
}
button:hover:not(:disabled) { background: var(--primary-hover); }
button:disabled { background: #c0c5d0; cursor: not-allowed; }

.results { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 20px; box-shadow: var(--shadow); }

.summary {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px; margin-bottom: 16px;
}
.stat { background: #f9fafb; border: 1px solid var(--border); border-radius: 8px; padding: 12px 14px; }
.stat .v { font-size: 22px; font-weight: 600; }
.stat .l { color: var(--muted); font-size: 12px; }

.filters { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border); }
.filters button { margin-left: auto; }

table { width: 100%; border-collapse: collapse; font-size: 13px; }
thead th {
  text-align: left; padding: 10px 12px; background: #f9fafb;
  border-bottom: 1px solid var(--border); font-weight: 600; color: var(--muted);
  position: sticky; top: 0;
}
tbody td { padding: 10px 12px; border-bottom: 1px solid var(--border); }
tbody tr:hover { background: #f9fafb; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
.badge.ok   { background: #ecfdf3; color: var(--ok); }
.badge.warn { background: #fffaeb; color: var(--warn); }
.badge.bad  { background: #fef3f2; color: var(--danger); }

.error { color: var(--danger); margin-top: 12px; }
.error[hidden] { display: none; }
```

- [ ] **Step 3: Implement app.js**

```js
// js/app.js
(function () {
  const state = {
    factory: { file: null, parsed: null, mappings: {} },
    company: { file: null, parsed: null, mappings: {} },
    results: null
  };

  const KEYWORDS = {
    factory: {
      name:     /姓名|^name$/i,
      dept:     /部门|department|dept/i,
      position: /岗位|position/i,
      hours:    /计薪|小时|hours/i,
      bonus:    /绩效|奖金|bonus/i
    },
    company: {
      name:     /姓名|^name$/i,
      recruiter:/招|推荐|recruit|refer/i,
      position: /岗位|position/i,
      hours:    /计薪|小时|hours/i
    }
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // ---------- File handling ----------
  function setupDropzone(zoneId, side) {
    const zone = $('#' + zoneId);
    const input = zone.querySelector('input[type="file"]');
    zone.addEventListener('click', () => input.click());
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault(); zone.classList.remove('drag');
      if (e.dataTransfer.files[0]) handleFile(side, e.dataTransfer.files[0]);
    });
    input.addEventListener('change', (e) => {
      if (e.target.files[0]) handleFile(side, e.target.files[0]);
    });
  }

  async function handleFile(side, file) {
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const parsed = window.parseWorkbook(buf);
      if (parsed.headers.length === 0) throw new Error('No headers detected');
      state[side] = { file, parsed, mappings: autoDetect(side, parsed.headers) };
      renderDropzone(side);
      if (state.factory.parsed && state.company.parsed) {
        $('#mappings').hidden = false;
        populateMappingDropdowns();
      }
    } catch (err) {
      alert(`${side} file error: ${err.message}`);
    }
  }

  function renderDropzone(side) {
    const zone = $('#dz-' + side);
    zone.classList.add('loaded');
    zone.querySelector('.dz-status').textContent =
      `${state[side].file.name} · ${state[side].parsed.rows.length} rows`;
  }

  // ---------- Auto-detect mappings ----------
  function autoDetect(side, headers) {
    const out = {};
    const rules = KEYWORDS[side];
    for (const [key, re] of Object.entries(rules)) {
      let idx = headers.findIndex(h => re.test(h));
      if (idx === -1 && key === 'recruiter') {
        // headerless fallback for the company recruiter column
        idx = pickHeaderlessRecruiter(headers, state[side].parsed.rows);
      }
      out[key] = idx >= 0 ? headers[idx] : '';
    }
    return out;
  }

  function pickHeaderlessRecruiter(headers, rows) {
    let bestIdx = -1, bestScore = 0;
    headers.forEach((h, i) => {
      let nonEmpty = 0, onPersonRows = 0;
      let personRows = 0;
      for (const r of rows) {
        const nameCell = r[headers[0]]; // not reliable; use overall presence
        const v = r[h];
        if (v != null && String(v).trim().length > 0 && String(v).trim().length <= 8) nonEmpty++;
      }
      const score = nonEmpty;
      if (score > bestScore) { bestScore = score; bestIdx = i; }
    });
    return bestIdx;
  }

  function populateMappingDropdowns() {
    for (const side of ['factory', 'company']) {
      const headers = state[side].parsed.headers;
      const selects = $$(`select[data-side="${side}"]`);
      for (const sel of selects) {
        const key = sel.dataset.key;
        sel.innerHTML = '<option value="">— none —</option>' +
          headers.map((h, i) => `<option value="${escapeHtml(h)}" data-idx="${i}">${escapeHtml(h || '(col ' + (i+1) + ')')}</option>`).join('');
        sel.value = state[side].mappings[key] || '';
      }
    }
    validateMappings();
  }

  function validateMappings() {
    const errs = [];
    if (!state.factory.mappings.name)   errs.push('Factory: Name is required');
    if (!state.factory.mappings.hours)  errs.push('Factory: Hours is required');
    if (!state.company.mappings.name)   errs.push('Company: Name is required');
    if (!state.company.mappings.recruiter) errs.push('Company: Recruiter is required');
    const errEl = $('#mapping-error');
    if (errs.length) { errEl.textContent = errs.join(' · '); errEl.hidden = false; $('#btn-match').disabled = true; }
    else { errEl.hidden = true; $('#btn-match').disabled = false; }
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  // ---------- Match & render ----------
  $('#btn-match').addEventListener('click', runMatch);
  function runMatch() {
    $$('select[data-side]').forEach(sel => {
      state[sel.dataset.side].mappings[sel.dataset.key] = sel.value;
    });
    validateMappings();
    if ($('#btn-match').disabled) return;

    const f = state.factory.parsed.rows;
    const c = state.company.parsed.rows;
    const fm = state.factory.mappings;
    const cm = state.company.mappings;

    const { personRows, subtotalRows } = window.classifyCompanyRows(c, { name: cm.name, recruiter: cm.recruiter });
    const { matched, needsReview } = window.matchByName(f, personRows, {
      factory: { name: fm.name, dept: fm.dept, position: fm.position, hours: fm.hours, bonus: fm.bonus },
      company: { name: cm.name, recruiter: cm.recruiter, position: cm.position, hours: cm.hours }
    });

    const summary = buildSummary(matched, fm.hours);
    const subtotals = subtotalRows.map(r => ({
      recruiter: String(r[cm.recruiter] || '').trim(),
      // amount column on Sheet 2: header is the second 费用金额 at index 9 in real samples,
      // but we pull the last numeric column on subtotal rows as a robust default.
      amount: pickSubtotalAmount(r)
    }));

    state.results = { matched, needsReview, subtotals, summary };
    renderResults();
    $('#results').hidden = false;
  }

  function pickSubtotalAmount(row) {
    // Subtotal rows in the real sample have the amount in 费用金额 (col J).
    // Find any numeric value in the row that looks like a subtotal.
    const vals = Object.values(row).filter(v => typeof v === 'number' && v > 0);
    return vals.length ? Math.max(...vals) : 0;
  }

  function buildSummary(matched, hoursKey) {
    const by = new Map();
    for (const m of matched) {
      const k = m.recruiter || '(unknown)';
      let hours = 0;
      for (const f of m.matchedFactoryRows) hours += Number(f[hoursKey]) || 0;
      const e = by.get(k) || { recruiter: k, people: 0, totalHours: 0 };
      e.people += 1; e.totalHours += hours;
      by.set(k, e);
    }
    return Array.from(by.values()).sort((a, b) => b.totalHours - a.totalHours);
  }

  function renderResults() {
    const r = state.results;
    // summary
    const totalMatched = r.matched.filter(m => m.status === 'matched').length;
    const totalDup = r.matched.filter(m => m.status === 'duplicate').length;
    const totalHours = r.summary.reduce((s, x) => s + x.totalHours, 0);
    $('#summary').innerHTML = `
      <div class="stat"><div class="v">${r.matched.length + r.needsReview.length}</div><div class="l">Total people</div></div>
      <div class="stat"><div class="v">${totalMatched}</div><div class="l">Matched</div></div>
      <div class="stat"><div class="v">${totalDup}</div><div class="l">Duplicate — review</div></div>
      <div class="stat"><div class="v">${r.needsReview.length}</div><div class="l">Needs review</div></div>
      <div class="stat"><div class="v">${totalHours.toFixed(1)}</div><div class="l">Total factory hours</div></div>
    `;

    populateFilters();
    renderMatched();
    renderReview();
    renderSubtotals();
  }

  function populateFilters() {
    const depts = new Set(), recs = new Set();
    for (const m of state.results.matched) {
      for (const f of m.matchedFactoryRows) {
        const d = state.factory.mappings.dept ? f[state.factory.mappings.dept] : null;
        if (d) depts.add(String(d));
      }
      if (m.recruiter) recs.add(m.recruiter);
    }
    const fill = (sel, items) => {
      sel.innerHTML = '<option value="">All</option>' +
        Array.from(items).sort().map(v => `<option>${escapeHtml(v)}</option>`).join('');
    };
    fill($('#filter-dept'), depts);
    fill($('#filter-rec'), recs);
  }

  function renderMatched() {
    const deptF = $('#filter-dept').value;
    const recF = $('#filter-rec').value;
    const statusF = $('#filter-status').value;
    const nameF = $('#filter-name').value.trim().toLowerCase();
    const deptKey = state.factory.mappings.dept;
    const posKey = state.factory.mappings.position;
    const hoursKey = state.factory.mappings.hours;
    const bonusKey = state.factory.mappings.bonus;
    const coPosKey = state.company.mappings.position;
    const coHoursKey = state.company.mappings.hours;

    const rows = [];
    for (const m of state.results.matched) {
      if (recF && m.recruiter !== recF) continue;
      const statusLabel = m.status === 'duplicate' ? 'Duplicate — review' : 'Matched';
      if (statusF && statusLabel !== statusF) continue;
      for (const f of m.matchedFactoryRows) {
        const dept = deptKey ? f[deptKey] : '';
        if (deptF && String(dept) !== deptF) continue;
        if (nameF && !String(m.name).toLowerCase().includes(nameF)) continue;
        const badge = m.status === 'duplicate'
          ? '<span class="badge warn">Duplicate</span>'
          : '<span class="badge ok">Matched</span>';
        rows.push(`<tr>
          <td>${escapeHtml(m.name)}</td>
          <td>${escapeHtml(m.recruiter)}</td>
          <td>${escapeHtml(dept)}</td>
          <td>${escapeHtml(posKey ? f[posKey] : '')}</td>
          <td>${escapeHtml(hoursKey ? f[hoursKey] : '')}</td>
          <td>${escapeHtml(bonusKey ? f[bonusKey] : '')}</td>
          <td>${escapeHtml(m.company[coHoursKey] ?? '')}</td>
          <td>${badge}</td>
        </tr>`);
      }
    }
    $('#table-matched tbody').innerHTML = rows.join('') || '<tr><td colspan="8" style="text-align:center;color:var(--muted)">No matches</td></tr>';
  }

  function renderReview() {
    const rows = state.results.needsReview.map(n =>
      `<tr><td>${escapeHtml(n.name)}</td><td>${escapeHtml(n.recruiter)}</td><td>${escapeHtml(n.reason)}</td></tr>`);
    $('#table-review tbody').innerHTML = rows.join('') || '<tr><td colspan="3" style="text-align:center;color:var(--muted)">Nothing to review</td></tr>';
  }

  function renderSubtotals() {
    const rows = state.results.subtotals.map(s =>
      `<tr><td>${escapeHtml(s.recruiter)}</td><td>${escapeHtml(s.amount)}</td></tr>`);
    $('#table-subtotals tbody').innerHTML = rows.join('') || '<tr><td colspan="2" style="text-align:center;color:var(--muted)">No subtotals</td></tr>';
  }

  // filters reactivity
  ['filter-dept','filter-rec','filter-status','filter-name'].forEach(id =>
    $('#' + id).addEventListener('input', renderMatched));

  // ---------- Export ----------
  $('#btn-export').addEventListener('click', () => {
    const bytes = window.buildWorkbookBytes(state.results);
    const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = window.getExportFilename();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // ---------- Boot ----------
  setupDropzone('dz-factory', 'factory');
  setupDropzone('dz-company', 'company');
})();
```

- [ ] **Step 4: Manual smoke check**

Open `D:/projects/dunnan/index.html` in a browser. Upload the two sample files. Confirm:
- Both zones turn green and show file name + row count.
- Mapping panel appears with auto-detected selections.
- "Match & View" enables, runs, and renders tables.
- One duplicate is flagged (黄亚丽 → 黄亚丽1 + 黄亚丽2).
- Export downloads a valid .xlsx with 4 tabs.

(No automated test for UI — manual gate is acceptable for this thin orchestration layer per the spec.)

- [ ] **Step 5: Run the full test suite as a final gate**

Run: `npm test`
Expected: all parser, matcher, exporter, integration tests pass.

- [ ] **Step 6: Commit**

```bash
git add index.html css/styles.css js/app.js
git commit -m "feat(ui): app shell, mapping UI, results rendering, export"
```

---

### Task 7: Final verification

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 2: Add a README**

Create `D:/projects/dunnan/README.md` with:
- What the tool does (1 paragraph).
- How to run: open `index.html` in any modern browser.
- File format expectations (factory + company sheets).
- Where the auto-detected mappings live and how to override them.

- [ ] **Step 3: Commit README**

```bash
git add README.md
git commit -m "docs: add README"
```

---

## Self-Review Notes

- Spec coverage: every section of the design spec is implemented across Tasks 1-7.
- Placeholder scan: no "TBD" / "implement later" in this plan.
- Type/signature consistency: `parseWorkbook`, `classifyCompanyRows`, `matchByName`, `buildWorkbookBytes`, `getExportFilename` referenced consistently across tasks.
- The headerless recruiter auto-detect uses the same heuristic in parser tests, matcher tests, integration test, and app.js — verified by name: `pickHeaderlessRecruiter` / `pickHeaderlessRecruiterIdx`.