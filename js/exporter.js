// js/exporter.js
// Works in Node (for tests) and in the browser (via <script> tag).
(function () {
  'use strict';
  const XLSXLib = (typeof require === 'function' && typeof module !== 'undefined' && module.exports)
    ? require('../vendor/xlsx.full.min.js')
    : (typeof window !== 'undefined' ? window.XLSX : globalThis.XLSX);

  function getExportFilename() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `hours-report-${y}-${m}-${day}.xlsx`;
  }

  function cell(v) {
    if (v == null) return '';
    if (typeof v === 'number') return v;
    return String(v);
  }

  // Headers for the exported workbook, localized. `lang` defaults to 'zh'
  // (Chinese is the tool's primary language).
  const HDR = {
    zh: {
      sheetMatched: '已匹配', sheetReview: '待处理', sheetSubtotals: '招聘人小计', sheetSummary: '汇总',
      name: '姓名', recruiter: '招聘人', dept: '四级部门', position: '岗位',
      hoursFactory: '计薪天数/小时(工厂)', bonus: '绩效奖金', status: '状态',
      reason: '原因', subtotal: '小计金额', people: '人数', totalHours: '工时合计',
      statusMatched: '已匹配', statusDuplicate: '重复 — 待处理',
      reasonNotFound: '工厂表中未找到'
    },
    en: {
      sheetMatched: 'Matched', sheetReview: 'Needs Review', sheetSubtotals: 'Subtotals', sheetSummary: 'Summary',
      name: 'Name', recruiter: 'Recruiter', dept: 'Department', position: 'Position',
      hoursFactory: 'Billable days/hours (factory)', bonus: 'Bonus', status: 'Status',
      reason: 'Reason', subtotal: 'Subtotal Amount', people: 'People', totalHours: 'Total Hours',
      statusMatched: 'Matched', statusDuplicate: 'Duplicate — review',
      reasonNotFound: 'Not found in factory sheet'
    }
  };

  function hdr(lang, key) { return HDR[lang || 'zh'][key]; }

  // matched items: { name, recruiter, company, matchedFactoryRows, status }
  // mappings.factory holds the column keys for dept/position/hours/bonus.
  function matchedToRows(matched, mappings, lang) {
    const rows = [];
    const { dept, position, hours, bonus } = mappings.factory;
    for (const m of matched) {
      for (const f of m.matchedFactoryRows) {
        rows.push({
          [hdr(lang, 'name')]: cell(m.name),
          [hdr(lang, 'recruiter')]: cell(m.recruiter),
          [hdr(lang, 'dept')]: cell(dept ? f[dept] : ''),
          [hdr(lang, 'position')]: cell(position ? f[position] : ''),
          [hdr(lang, 'hoursFactory')]: cell(hours ? f[hours] : ''),
          [hdr(lang, 'bonus')]: cell(bonus ? f[bonus] : ''),
          [hdr(lang, 'status')]: m.status === 'duplicate' ? hdr(lang, 'statusDuplicate') : hdr(lang, 'statusMatched')
        });
      }
    }
    return rows;
  }

  function needsReviewToRows(needsReview, lang) {
    return needsReview.map(n => ({
      [hdr(lang, 'name')]: cell(n.name),
      [hdr(lang, 'recruiter')]: cell(n.recruiter),
      [hdr(lang, 'reason')]: n.reason === 'Not found in factory sheet' ? hdr(lang, 'reasonNotFound') : cell(n.reason)
    }));
  }

  function subtotalsToRows(subtotals, lang) {
    return subtotals.map(s => ({
      [hdr(lang, 'recruiter')]: cell(s.recruiter),
      [hdr(lang, 'subtotal')]: cell(s.amount)
    }));
  }

  function summaryToRows(summary, lang) {
    return summary.map(s => ({
      [hdr(lang, 'recruiter')]: cell(s.recruiter),
      [hdr(lang, 'people')]: cell(s.people),
      [hdr(lang, 'totalHours')]: cell(s.totalHours)
    }));
  }

  function buildWorkbookBytes({ matched, needsReview, subtotals, summary, mappings, lang }) {
    const wb = XLSXLib.utils.book_new();
    XLSXLib.utils.book_append_sheet(wb, XLSXLib.utils.json_to_sheet(matchedToRows(matched, mappings, lang)), hdr(lang, 'sheetMatched'));
    XLSXLib.utils.book_append_sheet(wb, XLSXLib.utils.json_to_sheet(needsReviewToRows(needsReview, lang)), hdr(lang, 'sheetReview'));
    XLSXLib.utils.book_append_sheet(wb, XLSXLib.utils.json_to_sheet(subtotalsToRows(subtotals, lang)), hdr(lang, 'sheetSubtotals'));
    XLSXLib.utils.book_append_sheet(wb, XLSXLib.utils.json_to_sheet(summaryToRows(summary, lang)), hdr(lang, 'sheetSummary'));
    const out = XLSXLib.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Uint8Array(out);
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { buildWorkbookBytes, getExportFilename };
  } else {
    window.HrExporter = { buildWorkbookBytes, getExportFilename };
  }
})();