// js/exporter.js
const XLSX = require('../vendor/xlsx.full.min.js');

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

// matched items: { name, recruiter, company, matchedFactoryRows, status }
// mappings.factory holds the column keys for dept/position/hours/bonus.
function matchedToRows(matched, mappings) {
  const rows = [];
  const { dept, position, hours, bonus } = mappings.factory;
  for (const m of matched) {
    for (const f of m.matchedFactoryRows) {
      rows.push({
        '姓名': cell(m.name),
        'Recruiter': cell(m.recruiter),
        '四级部门': cell(dept ? f[dept] : ''),
        '岗位': cell(position ? f[position] : ''),
        '计薪天数/小时(工厂)': cell(hours ? f[hours] : ''),
        '绩效奖金': cell(bonus ? f[bonus] : ''),
        'Status': m.status === 'duplicate' ? 'Duplicate — review' : 'Matched'
      });
    }
  }
  return rows;
}

function needsReviewToRows(needsReview) {
  return needsReview.map(n => ({
    '姓名': cell(n.name),
    'Recruiter': cell(n.recruiter),
    'Reason': cell(n.reason)
  }));
}

function subtotalsToRows(subtotals) {
  return subtotals.map(s => ({
    'Recruiter': cell(s.recruiter),
    'Subtotal Amount': cell(s.amount)
  }));
}

function summaryToRows(summary) {
  return summary.map(s => ({
    'Recruiter': cell(s.recruiter),
    'People': cell(s.people),
    'Total Hours': cell(s.totalHours)
  }));
}

function buildWorkbookBytes({ matched, needsReview, subtotals, summary, mappings }) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(matchedToRows(matched, mappings)), 'Matched');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(needsReviewToRows(needsReview)), 'Needs Review');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(subtotalsToRows(subtotals)), 'Subtotals');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryToRows(summary)), 'Summary');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(out);
}

module.exports = { buildWorkbookBytes, getExportFilename };