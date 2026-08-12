const test = require('node:test');
const assert = require('node:assert');
const { buildWorkbookBytes, getExportFilename } = require('../js/exporter.js');

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