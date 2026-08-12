// tests/integration.test.js
// Runs the full pipeline — parse → classify → match → summarize → export —
// against the two real sample spreadsheets.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseWorkbook, classifyCompanyRows, detectRecruiterColumn } = require('../js/parser.js');
const { matchByName } = require('../js/matcher.js');
const { buildWorkbookBytes } = require('../js/exporter.js');

const FAC_XLSX = path.join(__dirname, '..', 'sample_factory_attendance.xlsx');
const CO_XLS   = path.join(__dirname, '..', 'sample_factory.xls');

const samplesPresent = fs.existsSync(FAC_XLSX) && fs.existsSync(CO_XLS);

const findCol = (headers, re) => headers.findIndex(h => re.test(h));

function pickSubtotalAmount(row) {
  const vals = Object.values(row).filter(v => typeof v === 'number' && v > 0);
  return vals.length ? Math.max(...vals) : 0;
}

// The sample spreadsheets contain real HR data and are intentionally NOT
// committed to the repo. When they're absent (e.g. a fresh clone), the
// pipeline is still exercised by the unit tests — skip cleanly here.
test('full pipeline against real samples produces valid workbook', { skip: !samplesPresent }, () => {
  // 1) Parse both files
  const fac = parseWorkbook(new Uint8Array(fs.readFileSync(FAC_XLSX)));
  const co  = parseWorkbook(new Uint8Array(fs.readFileSync(CO_XLS)));
  assert.ok(fac.rows.length > 0, 'factory sheet parsed with rows');
  assert.ok(co.rows.length > 40, 'company sheet parsed with rows');

  // 2) Build factory mapping from headers/keys
  const facNameIdx  = findCol(fac.headers, /姓名|name/);
  const facDeptIdx  = findCol(fac.headers, /部门|department/);
  const facPosIdx   = findCol(fac.headers, /岗位|position/);
  const facHoursIdx = findCol(fac.headers, /计薪|小时|hours/);
  const facBonusIdx = findCol(fac.headers, /绩效|奖金|bonus/);
  assert.ok(facNameIdx >= 0 && facHoursIdx >= 0, 'factory name+hours columns detected');

  const factoryMapping = {
    name: fac.keys[facNameIdx],
    dept: fac.keys[facDeptIdx],
    position: fac.keys[facPosIdx],
    hours: fac.keys[facHoursIdx],
    bonus: fac.keys[facBonusIdx]
  };

  // 3) Build company mapping (recruiter is headerless — auto-detect)
  const coNameIdx = findCol(co.headers, /姓名|name/);
  assert.ok(coNameIdx >= 0, 'company name column detected');
  const coNameKey = co.keys[coNameIdx];
  const coPosIdx  = findCol(co.headers, /岗位|position/);
  const coHoursIdx = findCol(co.headers, /计薪|小时|hours/);
  const coRecKey = detectRecruiterColumn(co.keys, co.rows, coNameKey);
  assert.ok(coRecKey !== '', 'recruiter column auto-detected');

  const companyMapping = {
    name: coNameKey,
    recruiter: coRecKey,
    position: co.keys[coPosIdx],
    hours: co.keys[coHoursIdx]
  };

  // 4) Classify company rows
  const { personRows, subtotalRows } = classifyCompanyRows(co.rows, companyMapping);
  assert.strictEqual(personRows.length, 46, 'expected 46 person rows');
  assert.strictEqual(subtotalRows.length, 7, 'expected 7 subtotal rows');

  // 5) Match
  const { matched, needsReview } = matchByName(fac.rows, personRows, {
    factory: factoryMapping,
    company: companyMapping
  });
  // The two samples are from different months (June company vs July factory),
  // so people who left/joined between months are legitimately unmatched —
  // the tool must surface them in Needs Review rather than guess.
  assert.strictEqual(matched.length, 30, 'expected 30 matched from the sample pair');
  assert.strictEqual(needsReview.length, 54, 'expected 54 unmatched (month turnover)');

  // Bidirectional missing detection: 16 company names missing from the factory
  // sheet; 38 factory names missing from the company sheet (70 factory people
  // minus the 32 factory rows consumed by the 30 matches).
  const factorySide = needsReview.filter(n => n.side === 'factory');
  const companySide = needsReview.filter(n => n.side === 'company');
  assert.strictEqual(factorySide.length, 16, '16 names missing from the factory sheet');
  assert.strictEqual(companySide.length, 38, '38 names missing from the company sheet');

  // Confirm the known duplicate surfaced: 黄亚丽 has 黄亚丽1 + 黄亚丽2 in factory
  const huang = matched.find(m => String(m.name).trim() === '黄亚丽');
  assert.ok(huang, '黄亚丽 should be present');
  assert.strictEqual(huang.status, 'duplicate');
  assert.strictEqual(huang.matchedFactoryRows.length, 2); // 黄亚丽1 + 黄亚丽2

  // Confirm a few specific correct matches
  const names = new Set(matched.map(m => String(m.name).trim()));
  for (const n of ['刘英博', '朱嘉年', '卢欢', '魏强', '梁平']) {
    assert.ok(names.has(n), `${n} should be matched`);
  }
  // Confirm a genuine unmatched case lands in review with its recruiter
  const dan = needsReview.find(n => String(n.name).trim() === '单丹丹');
  assert.ok(dan, '单丹丹 should be in Needs Review');
  assert.strictEqual(dan.recruiter, '杨树海');

  // 6) Build summary by recruiter
  const byRec = new Map();
  for (const m of matched) {
    const key = m.recruiter || '(unknown)';
    let totalH = 0;
    for (const f of m.matchedFactoryRows) totalH += Number(f[factoryMapping.hours]) || 0;
    const e = byRec.get(key) || { recruiter: key, people: 0, totalHours: 0 };
    e.people += 1;
    e.totalHours += totalH;
    byRec.set(key, e);
  }
  const summary = Array.from(byRec.values());
  assert.ok(summary.length >= 5, 'expected several recruiters in summary');

  // 7) Subtotals
  const subtotals = subtotalRows.map(r => ({
    recruiter: String(r[companyMapping.recruiter] || '').trim(),
    amount: pickSubtotalAmount(r)
  }));

  // 8) Export
  const bytes = buildWorkbookBytes({ matched, needsReview, subtotals, summary, mappings: { factory: factoryMapping } });
  assert.ok(bytes.length > 1000, 'workbook should be substantial');
  assert.strictEqual(bytes[0], 0x50); // P
  assert.strictEqual(bytes[1], 0x4b); // K  → valid ZIP/XLSX
});