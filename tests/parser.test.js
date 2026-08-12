const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { parseWorkbook, classifyCompanyRows, detectRecruiterColumn } = require('../js/parser.js');

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

test('detectRecruiterColumn + classifyCompanyRows: separates person vs subtotal rows', () => {
  const buf = fs.readFileSync(CO_XLS);
  const { headers, keys, rows } = parseWorkbook(new Uint8Array(buf));
  const nameIdx = headers.findIndex(h => /姓名|name/i.test(h));
  assert.ok(nameIdx >= 0, 'must detect a name column');
  const nameKey = keys[nameIdx];
  // headerless recruiter column — auto-detect it
  const recruiterKey = detectRecruiterColumn(keys, rows, nameKey);
  assert.ok(recruiterKey !== '', 'must detect the (headerless) recruiter column');
  const mappings = { name: nameKey, recruiter: recruiterKey };
  const { personRows, subtotalRows } = classifyCompanyRows(rows, mappings);
  assert.strictEqual(personRows.length, 46, 'expected 46 person rows from sample');
  assert.strictEqual(subtotalRows.length, 7,  'expected 7 subtotal rows from sample');
});