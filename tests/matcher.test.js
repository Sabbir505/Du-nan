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

test('suffix rule only for trailing digits, not for names starting with same chars', () => {
  // '刘英' must NOT match '刘英博' — 博 is not a digit
  const fac = [f('刘英博','物流科',280)];
  const r = matchByName(fac, [c('刘英','杨树海')], mappings);
  assert.strictEqual(r.matched.length, 0);
  assert.strictEqual(r.needsReview.length, 1);
});