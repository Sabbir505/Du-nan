/* global HrParser, HrMatcher, HrExporter */
(function () {
  'use strict';

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
      hours:    /计薪|小时|工时|hours/i,
      bonus:    /绩效|奖金|bonus/i
    },
    company: {
      name:     /姓名|^name$/i,
      position: /岗位|position/i,
      hours:    /计薪|小时|工时|hours/i
    }
  };

  const REQUIRED = {
    factory: ['name', 'hours'],
    company: ['name', 'recruiter']
  };

  const $  = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  // ---------- Upload handling ----------
  function setupDropzone(zoneId, side) {
    const zone = $('#' + zoneId);
    const input = zone.querySelector('input[type="file"]');
    zone.addEventListener('click', () => input.click());
    zone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') input.click(); });
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('drag');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(side, e.dataTransfer.files[0]);
    });
    input.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) handleFile(side, e.target.files[0]);
    });
  }

  async function handleFile(side, file) {
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const parsed = HrParser.parseWorkbook(buf);
      if (!parsed.headers.length) throw new Error('No header row detected — is this a valid spreadsheet?');
      state[side] = { file, parsed, mappings: autoDetect(side, parsed) };
      renderDropzone(side);
      if (state.factory.parsed && state.company.parsed) {
        $('#mappings').hidden = false;
        populateMappingDropdowns();
      }
    } catch (err) {
      renderDropzoneError(side, err.message);
    }
  }

  function renderDropzone(side) {
    const zone = $('#dz-' + side);
    zone.classList.remove('error');
    zone.classList.add('loaded');
    zone.querySelector('.dz-status').textContent = 'Loaded';
    zone.querySelector('.dz-file').textContent =
      `${state[side].file.name} · ${state[side].parsed.rows.length} data rows`;
  }

  function renderDropzoneError(side, msg) {
    const zone = $('#dz-' + side);
    zone.classList.remove('loaded');
    zone.querySelector('.dz-status').textContent = 'Error';
    zone.querySelector('.dz-file').textContent = msg;
  }

  // ---------- Auto-detect mappings ----------
  function autoDetect(side, parsed) {
    const out = {};
    const rules = KEYWORDS[side] || {};
    for (const key of Object.keys(rules)) {
      const re = rules[key];
      const idx = parsed.headers.findIndex((h) => re.test(h));
      out[key] = idx >= 0 ? parsed.keys[idx] : '';
    }
    if (side === 'company' && !out.recruiter) {
      const coNameKey = out.name;
      const rec = HrParser.detectRecruiterColumn(parsed.keys, parsed.rows, coNameKey);
      if (rec) out.recruiter = rec;
    }
    return out;
  }

  // ---------- Mapping UI ----------
  function colLabel(parsed, i) {
    const h = parsed.headers[i];
    return h ? `${h}  (col ${i + 1})` : `(col ${i + 1})`;
  }

  function populateMappingDropdowns() {
    for (const side of ['factory', 'company']) {
      const parsed = state[side].parsed;
      const selects = $$(`select[data-side="${side}"]`);
      for (const sel of selects) {
        const key = sel.dataset.key;
        sel.innerHTML = '<option value="">— none —</option>' +
          parsed.keys.map((k, i) =>
            `<option value="${escapeHtml(k)}">${escapeHtml(colLabel(parsed, i))}</option>`).join('');
        sel.value = state[side].mappings[key] || '';
      }
    }
    validateMappings();
  }

  function validateMappings() {
    const errs = [];
    for (const side of Object.keys(REQUIRED)) {
      const label = side === 'factory' ? 'Factory' : 'Company';
      for (const key of REQUIRED[side]) {
        if (!state[side].mappings[key]) {
          errs.push(`${label}: ${key === 'recruiter' ? 'Recruiter' : key} is required`);
        }
      }
    }
    const errEl = $('#mapping-error');
    const btn = $('#btn-match');
    if (errs.length) {
      errEl.textContent = 'Missing: ' + errs.join(' · ');
      errEl.hidden = false;
      btn.disabled = true;
    } else {
      errEl.hidden = true;
      btn.disabled = false;
    }
  }

  // ---------- Matching ----------
  $('#btn-match').addEventListener('click', runMatch);

  function runMatch() {
    $$('select[data-side]').forEach((sel) => {
      state[sel.dataset.side].mappings[sel.dataset.key] = sel.value;
    });
    validateMappings();
    if ($('#btn-match').disabled) return;

    const f = state.factory.parsed;
    const c = state.company.parsed;
    const fm = state.factory.mappings;
    const cm = state.company.mappings;

    const { personRows, subtotalRows } = HrParser.classifyCompanyRows(c.rows, {
      name: cm.name, recruiter: cm.recruiter
    });

    const { matched, needsReview } = HrMatcher.matchByName(f.rows, personRows, {
      factory: { name: fm.name, dept: fm.dept, position: fm.position, hours: fm.hours, bonus: fm.bonus },
      company: { name: cm.name, recruiter: cm.recruiter, position: cm.position, hours: cm.hours }
    });

    const summary = buildSummary(matched, fm.hours);
    const subtotals = subtotalRows.map((r) => ({
      recruiter: String(r[cm.recruiter] || '').trim(),
      amount: pickSubtotalAmount(r)
    }));

    state.results = { matched, needsReview, subtotals, summary };
    renderResults();
    $('#results').hidden = false;
    $('#results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function pickSubtotalAmount(row) {
    const vals = Object.values(row).filter((v) => typeof v === 'number' && v > 0);
    return vals.length ? Math.max(...vals) : 0;
  }

  function buildSummary(matched, hoursKey) {
    const by = new Map();
    for (const m of matched) {
      const k = m.recruiter || '(unknown)';
      let hours = 0;
      for (const fr of m.matchedFactoryRows) hours += Number(fr[hoursKey]) || 0;
      const e = by.get(k) || { recruiter: k, people: 0, totalHours: 0 };
      e.people += 1;
      e.totalHours += hours;
      by.set(k, e);
    }
    return Array.from(by.values()).sort((a, b) => b.totalHours - a.totalHours);
  }

  // ---------- Rendering ----------
  function renderResults() {
    const r = state.results;
    const totalMatched = r.matched.filter((m) => m.status === 'matched').length;
    const totalDup = r.matched.filter((m) => m.status === 'duplicate').length;
    const totalHours = r.summary.reduce((s, x) => s + x.totalHours, 0);
    const totalPeople = r.matched.length + r.needsReview.length;

    $('#summary').innerHTML =
      statCard(totalPeople, 'Total people') +
      statCard(totalMatched, 'Matched') +
      statCard(totalDup, 'Duplicate — review') +
      statCard(r.needsReview.length, 'Needs review') +
      statCard(fmtNum(totalHours), 'Total factory hours');

    populateFilters();
    renderMatched();
    renderReview();
    renderSubtotals();
  }

  function statCard(v, label) {
    return `<div class="stat"><div class="v">${v}</div><div class="l">${label}</div></div>`;
  }

  function fmtNum(n) {
    return (Math.round(n * 10) / 10).toLocaleString('en-US', { maximumFractionDigits: 1 });
  }

  function populateFilters() {
    const depts = new Set();
    const recs = new Set();
    const deptKey = state.factory.mappings.dept;
    for (const m of state.results.matched) {
      if (m.recruiter) recs.add(m.recruiter);
      for (const fr of m.matchedFactoryRows) {
        const d = deptKey ? fr[deptKey] : null;
        if (d) depts.add(String(d));
      }
    }
    fillSelect($('#filter-dept'), depts);
    fillSelect($('#filter-rec'), recs);
  }

  function fillSelect(sel, items) {
    sel.innerHTML = '<option value="">All</option>' +
      Array.from(items).sort().map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  }

  function renderMatched() {
    const deptF = $('#filter-dept').value;
    const recF = $('#filter-rec').value;
    const statusF = $('#filter-status').value;
    const nameF = $('#filter-name').value.trim().toLowerCase();
    const fm = state.factory.mappings;
    const cm = state.company.mappings;

    const rows = [];
    for (const m of state.results.matched) {
      if (recF && m.recruiter !== recF) continue;
      const statusLabel = m.status === 'duplicate' ? 'Duplicate — review' : 'Matched';
      if (statusF && statusLabel !== statusF) continue;
      if (nameF && !String(m.name).toLowerCase().includes(nameF)) continue;

      for (const fr of m.matchedFactoryRows) {
        const dept = fm.dept ? fr[fm.dept] : '';
        if (deptF && String(dept) !== deptF) continue;
        const badge = m.status === 'duplicate'
          ? '<span class="badge warn">Duplicate — review</span>'
          : '<span class="badge ok">Matched</span>';
        rows.push(`<tr>
          <td>${escapeHtml(m.name)}</td>
          <td>${escapeHtml(m.recruiter)}</td>
          <td>${escapeHtml(dept)}</td>
          <td>${escapeHtml(fm.position ? fr[fm.position] : '')}</td>
          <td class="num">${escapeHtml(fm.hours ? fr[fm.hours] : '')}</td>
          <td class="num">${escapeHtml(fm.bonus ? fr[fm.bonus] : '')}</td>
          <td class="num">${escapeHtml(cm.hours ? m.company[cm.hours] : '')}</td>
          <td>${badge}</td>
        </tr>`);
      }
    }
    $('#table-matched tbody').innerHTML =
      rows.join('') || '<tr><td colspan="8" class="empty">No matches for the current filters</td></tr>';
  }

  function renderReview() {
    const rows = state.results.needsReview.map((n) => `<tr>
      <td>${escapeHtml(n.name)}</td>
      <td>${escapeHtml(n.recruiter)}</td>
      <td><span class="badge bad">${escapeHtml(n.reason)}</span></td>
    </tr>`);
    $('#table-review tbody').innerHTML =
      rows.join('') || '<tr><td colspan="3" class="empty">Nothing to review — all people matched</td></tr>';
  }

  function renderSubtotals() {
    const rows = state.results.subtotals.map((s) => `<tr>
      <td>${escapeHtml(s.recruiter)}</td>
      <td class="big-num">${escapeHtml(s.amount)}</td>
    </tr>`);
    $('#table-subtotals tbody').innerHTML =
      rows.join('') || '<tr><td colspan="2" class="empty">No recruiter subtotals found</td></tr>';
  }

  // ---------- Filters ----------
  ['filter-dept', 'filter-rec', 'filter-status', 'filter-name'].forEach((id) => {
    $('#' + id).addEventListener('input', renderMatched);
  });

  // ---------- Export ----------
  $('#btn-export').addEventListener('click', () => {
    const { matched, needsReview, subtotals, summary } = state.results;
    const bytes = HrExporter.buildWorkbookBytes({
      matched, needsReview, subtotals, summary,
      mappings: { factory: state.factory.mappings }
    });
    const blob = new Blob([bytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = HrExporter.getExportFilename();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // ---------- Boot ----------
  setupDropzone('dz-factory', 'factory');
  setupDropzone('dz-company', 'company');
})();