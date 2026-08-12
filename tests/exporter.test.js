const test = require('node:test');
const assert = require('node:assert');
const { buildWorkbookBytes, getExportFilename, buildSheetBytes } = require('../js/exporter.js');

const mappings = { factory: { name: '姓名', dept: '四级部门', position: '岗位', hours: '计薪天数/小时', bonus: '绩效奖金' } };

test('buildWorkbookBytes returns a non-empty Uint8Array', () => {
  const matched = [{
    name: '张三', recruiter: '杨树海', status: 'matched',
    company: {},
    matchedFactoryRows: [{ '姓名':'张三','四级部门':'质量科','岗位':'质检','计薪天数/小时':280,'绩效奖金':0 }]
  }];
  const needsReview = [{ name: '李四', recruiter: '吴梦', reason: 'Not found in factory sheet' }];
  const subtotals = [{ recruiter: '方经理', amount: 5312 }];
  const summary = [{ recruiter: '杨树海', people: 1, totalHours: 280 }];
  const bytes = buildWorkbookBytes({ matched, needsReview, subtotals, summary, mappings });
  assert.ok(bytes instanceof Uint8Array);
  assert.ok(bytes.length > 100);
  // ZIP magic bytes "PK\x03\x04"
  assert.strictEqual(bytes[0], 0x50);
  assert.strictEqual(bytes[1], 0x4b);
});

test('getExportFilename matches hours-report-YYYY-MM-DD.xlsx pattern', () => {
  const fn = getExportFilename();
  assert.match(fn, /^hours-report-\d{4}-\d{2}-\d{2}\.xlsx$/);
});

test('buildSheetBytes returns a single-sheet non-empty workbook', () => {
  const rows = [{ '姓名': '张三', '招聘人': '杨树海' }, { '姓名': '李四', '招聘人': '' }];
  const bytes = buildSheetBytes(rows, '工厂全部名单');
  assert.ok(bytes instanceof Uint8Array);
  assert.ok(bytes.length > 100);
  assert.strictEqual(bytes[0], 0x50);
  assert.strictEqual(bytes[1], 0x4b);
});

test('rosterToRows maps recruiters and factory fallback name', () => {
  const { rosterToRows } = require('../js/exporter.js');
  const roster = [
    { row: { '姓名': '张三', '四级部门': '质量科' }, name: '张三', recruiters: ['杨树海'], matched: true },
    { row: { '姓名': '王五', '四级部门': '物流科' }, name: '王五', recruiters: [], matched: false }
  ];
  const mappings = { factory: { name: '姓名', dept: '四级部门', position: '', hours: '计薪天数/小时', bonus: '' } };
  const rows = rosterToRows(roster, mappings, 'zh', 'myfactory');
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows[0]['姓名'], '张三');
  assert.strictEqual(rows[0]['招聘人'], '杨树海');
  assert.strictEqual(rows[0]['工厂'], 'myfactory');
  assert.strictEqual(rows[0]['状态'], '已匹配');
  assert.strictEqual(rows[1]['招聘人'], '');
  assert.strictEqual(rows[1]['状态'], '未匹配');
});