/* global HrParser, HrMatcher, HrExporter */
(function () {
  'use strict';

  // ---------------- i18n ----------------
  const I18N = {
    zh: {
      title: 'HR工时匹配工具',
      subtitle: '上传工厂考勤表与本公司收入表，按姓名自动匹配工时与招聘人。',
      dzFactoryTitle: '1. 工厂考勤表',
      dzCompanyTitle: '2. 公司收入表',
      dzHint: '.xls · .xlsx · .csv',
      dzIdle: '拖拽文件到此处，或点击选择',
      dzLoaded: '已加载',
      dzError: '加载失败',
      dzFileRows: (name, n) => `${name} · ${n} 行数据`,
      mappingTitle: '列映射',
      mappingHint: '已自动识别列。请确认或修改下拉选择 —— 带 * 的为必填列。',
      factoryLegend: '工厂考勤表',
      companyLegend: '公司收入表',
      colName: '姓名',
      colFactoryName: '工厂名称',
      colDept: '四级部门',
      colPosition: '岗位',
      colHours: '计薪天数/小时',
      colBonus: '绩效奖金',
      colRecruiter: '招聘人',
      colNone: '— 无 —',
      colLabel: (h, i) => h ? `${h}（第${i + 1}列）` : `（第${i + 1}列）`,
      btnMatch: '匹配并查看',
      btnExport: '导出 .xlsx',
      fDept: '部门',
      fRecruiter: '招聘人',
      fStatus: '状态',
      fSearch: '搜索',
      fSearchPh: '姓名…',
      fAll: '全部',
      hMatched: '已匹配',
      hMissing: '缺失名单',
      hMissingHint: '以下姓名只存在于其中一份文件中 —— 请核对并补全。',
      hSubtotals: '招聘人小计',
      themeLight: '浅色',
      themeDark: '深色',
      thName: '姓名',
      thRecruiter: '招聘人',
      thFactory: '工厂',
      thDept: '部门',
      thPosition: '岗位',
      thFactoryHours: '工厂工时',
      thBonus: '绩效奖金',
      thCompanyHours: '公司工时',
      thStatus: '状态',
      thReason: '原因',
      thSubtotal: '小计金额',
      thMissingFrom: '缺失于',
      statusMatched: '已匹配',
      statusDuplicate: '重复 — 待处理',
      badgeMatched: '已匹配',
      badgeDuplicate: '重复 — 待处理',
      badgeMissingFactory: '工厂表缺失',
      badgeMissingCompany: '公司表缺失',
      missingFromFactory: '工厂表',
      missingFromCompany: '公司表',
      emptyMatched: '当前筛选条件下无匹配结果',
      emptyReview: '无缺失项 —— 两份文件名单一致',
      emptySubtotals: '未找到招聘人小计',
      statTotalPeople: '总人数',
      statMatched: '已匹配',
      statDuplicate: '重复 — 待处理',
      statReview: '缺失名单',
      statTotalHours: '工厂工时合计',
      reasonNotFound: '工厂表中未找到',
      reasonNotFoundCompany: '公司表中未找到',
      reqMissing: (side, key) => `${side === 'factory' ? '工厂表' : '公司表'}：${key === 'recruiter' ? '招聘人' : '姓名/工时'} 为必填`,
      fileErr: (side, msg) => `${side === 'factory' ? '工厂表' : '公司表'} 文件错误：${msg}`,
      noHeader: '未检测到表头 —— 请确认文件是有效的表格',
      footer: '所有处理均在浏览器本地完成，数据不会上传到任何服务器。',
      recUnknown: '（未知）',
      factoryFromFile: (name) => `（文件名：${name}）`
    },
    en: {
      title: 'HR Hours Matching Tool',
      subtitle: 'Upload the factory attendance sheet and your company income sheet to merge people by name.',
      dzFactoryTitle: '1. Factory attendance sheet',
      dzCompanyTitle: '2. Company income sheet',
      dzHint: '.xls · .xlsx · .csv',
      dzIdle: 'Drag file here or click to browse',
      dzLoaded: 'Loaded',
      dzError: 'Error',
      dzFileRows: (name, n) => `${name} · ${n} data rows`,
      mappingTitle: 'Column mapping',
      mappingHint: 'Columns were auto-detected. Confirm or change each dropdown — required columns are marked *.',
      factoryLegend: 'Factory attendance sheet',
      companyLegend: 'Company income sheet',
      colName: 'Name',
      colFactoryName: 'Factory name',
      colDept: 'Department',
      colPosition: 'Position',
      colHours: 'Billable days/hours',
      colBonus: 'Bonus',
      colRecruiter: 'Recruiter',
      colNone: '— none —',
      colLabel: (h, i) => h ? `${h}  (col ${i + 1})` : `(col ${i + 1})`,
      btnMatch: 'Match & View',
      btnExport: 'Export .xlsx',
      fDept: 'Department',
      fRecruiter: 'Recruiter',
      fStatus: 'Status',
      fSearch: 'Search',
      fSearchPh: 'Name…',
      fAll: 'All',
      hMatched: 'Matched',
      hMissing: 'Missing Names',
      hMissingHint: 'These names appear in only one of the two files — please verify and complete.',
      hSubtotals: 'Recruiter Subtotals',
      themeLight: 'Light',
      themeDark: 'Dark',
      thName: 'Name',
      thRecruiter: 'Recruiter',
      thFactory: 'Factory',
      thDept: 'Department',
      thPosition: 'Position',
      thFactoryHours: 'Factory hours',
      thBonus: 'Bonus',
      thCompanyHours: 'Company hours',
      thStatus: 'Status',
      thReason: 'Reason',
      thSubtotal: 'Subtotal Amount',
      thMissingFrom: 'Missing from',
      statusMatched: 'Matched',
      statusDuplicate: 'Duplicate — review',
      badgeMatched: 'Matched',
      badgeDuplicate: 'Duplicate — review',
      badgeMissingFactory: 'Missing — factory sheet',
      badgeMissingCompany: 'Missing — company sheet',
      missingFromFactory: 'Factory sheet',
      missingFromCompany: 'Company sheet',
      emptyMatched: 'No matches for the current filters',
      emptyReview: 'Nothing missing — both lists align',
      emptySubtotals: 'No recruiter subtotals found',
      statTotalPeople: 'Total people',
      statMatched: 'Matched',
      statDuplicate: 'Duplicate — review',
      statReview: 'Missing names',
      statTotalHours: 'Total factory hours',
      reasonNotFound: 'Not found in factory sheet',
      reasonNotFoundCompany: 'Not found in company sheet',
      reqMissing: (side, key) => `${side === 'factory' ? 'Factory' : 'Company'}: ${key === 'recruiter' ? 'Recruiter' : 'Name/Hours'} is required`,
      fileErr: (side, msg) => `${side === 'factory' ? 'Factory' : 'Company'} file error: ${msg}`,
      noHeader: 'No header row detected — is this a valid spreadsheet?',
      footer: 'All processing happens locally in your browser. No data is uploaded anywhere.',
      recUnknown: '(unknown)',
      factoryFromFile: (name) => `(from file: ${name})`
    }
  };

  let lang = 'zh'; // Chinese is the primary language
  const t = (key) => {
    const v = I18N[lang][key];
    return typeof v === 'function' ? v : (v == null ? key : v);
  };

  // Theme: 'light' | 'dark'. Persisted in localStorage; falls back to the OS
  // preference on first visit.
  const THEME_KEY = 'hr-theme';
  function getInitialTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
    return (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  }
  let theme = getInitialTheme();

  function applyTheme() {
    document.documentElement.dataset.theme = theme;
    $$('[data-theme-btn]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.themeBtn === theme);
    });
  }

  // ---------------- state ----------------
  const state = {
    factory: { file: null, parsed: null, mappings: {} },
    company: { file: null, parsed: null, mappings: {} },
    results: null
  };

  const KEYWORDS = {
    factory: {
      name:     /姓名|^name$/i,
      factoryName: /工厂|厂名|company|factory/i,
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

  // Apply the active language to static DOM: [data-i18n] text and [data-i18n-ph] placeholders.
  function applyI18n() {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    $$('[data-i18n]').forEach((el) => {
      const key = el.dataset.i18n;
      if (key && I18N[lang][key] != null) el.textContent = t(key);
    });
    $$('[data-i18n-ph]').forEach((el) => {
      el.placeholder = t(el.dataset.i18nPh);
    });
    $$('#lang-zh, #lang-en').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });
    // Re-render dynamic parts if results exist
    if (state.results) {
      renderResults();
    }
    // Re-render dropzone statuses that contain translations
    ['factory', 'company'].forEach((side) => {
      if (state[side].file) renderDropzone(side);
    });
    // Re-populate mapping dropdowns so the "— none —" placeholder is localized
    // (populateMappingDropdowns restores selection from state.mappings)
    if (state.factory.parsed && state.company.parsed) {
      populateMappingDropdowns();
    }
  }

  // ---------------- upload handling ----------------
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
      if (!parsed.headers.length) throw new Error(t('noHeader'));
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
    zone.querySelector('.dz-status').textContent = t('dzLoaded');
    zone.querySelector('.dz-file').textContent =
      t('dzFileRows')(state[side].file.name, state[side].parsed.rows.length);
  }

  function renderDropzoneError(side, msg) {
    const zone = $('#dz-' + side);
    zone.classList.remove('loaded');
    zone.querySelector('.dz-status').textContent = t('dzError');
    zone.querySelector('.dz-file').textContent = msg;
  }

  // ---------------- auto-detect mappings ----------------
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

  // ---------------- mapping UI ----------------
  function populateMappingDropdowns() {
    for (const side of ['factory', 'company']) {
      const parsed = state[side].parsed;
      const selects = $$(`select[data-side="${side}"]`);
      for (const sel of selects) {
        const key = sel.dataset.key;
        sel.innerHTML = `<option value="">${escapeHtml(t('colNone'))}</option>` +
          parsed.keys.map((k, i) =>
            `<option value="${escapeHtml(k)}">${escapeHtml(t('colLabel')(parsed.headers[i], i))}</option>`).join('');
        sel.value = state[side].mappings[key] || '';
      }
    }
    validateMappings();
  }

  function validateMappings() {
    const errs = [];
    for (const side of Object.keys(REQUIRED)) {
      for (const key of REQUIRED[side]) {
        if (!state[side].mappings[key]) errs.push(t('reqMissing')(side, key));
      }
    }
    const errEl = $('#mapping-error');
    const btn = $('#btn-match');
    if (errs.length) {
      errEl.textContent = errs.join(' · ');
      errEl.hidden = false;
      btn.disabled = true;
    } else {
      errEl.hidden = true;
      btn.disabled = false;
    }
  }

  // ---------------- matching ----------------
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
      const k = m.recruiter || t('recUnknown');
      let hours = 0;
      for (const fr of m.matchedFactoryRows) hours += Number(fr[hoursKey]) || 0;
      const e = by.get(k) || { recruiter: k, people: 0, totalHours: 0 };
      e.people += 1;
      e.totalHours += hours;
      by.set(k, e);
    }
    return Array.from(by.values()).sort((a, b) => b.totalHours - a.totalHours);
  }

  // ---------------- rendering ----------------
  function renderResults() {
    const r = state.results;
    const totalMatched = r.matched.filter((m) => m.status === 'matched').length;
    const totalDup = r.matched.filter((m) => m.status === 'duplicate').length;
    const totalHours = r.summary.reduce((s, x) => s + x.totalHours, 0);
    const totalPeople = r.matched.length + r.needsReview.length;

    $('#summary').innerHTML =
      statCard(totalPeople, t('statTotalPeople')) +
      statCard(totalMatched, t('statMatched')) +
      statCard(totalDup, t('statDuplicate')) +
      statCard(r.needsReview.length, t('statReview')) +
      statCard(fmtNum(totalHours), t('statTotalHours'));

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
    sel.innerHTML = `<option value="">${escapeHtml(t('fAll'))}</option>` +
      Array.from(items).sort().map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  }

  function translateStatus(m) {
    return m.status === 'duplicate' ? t('statusDuplicate') : t('statusMatched');
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
      const statusLabel = translateStatus(m);
      if (statusF && statusLabel !== statusF) continue;
      if (nameF && !String(m.name).toLowerCase().includes(nameF)) continue;

      for (const fr of m.matchedFactoryRows) {
        const dept = fm.dept ? fr[fm.dept] : '';
        if (deptF && String(dept) !== deptF) continue;
        const badge = m.status === 'duplicate'
          ? `<span class="badge warn">${escapeHtml(t('badgeDuplicate'))}</span>`
          : `<span class="badge ok">${escapeHtml(t('badgeMatched'))}</span>`;
        rows.push(`<tr>
          <td>${escapeHtml(m.name)}</td>
          <td>${escapeHtml(m.recruiter)}</td>
          <td>${escapeHtml(factoryNameFor(fr))}</td>
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
      rows.join('') || `<tr><td colspan="9" class="empty">${escapeHtml(t('emptyMatched'))}</td></tr>`;
  }

  // The factory a row belongs to: the mapped 工厂名称 column if present,
  // otherwise the uploaded factory file's name (without extension).
  function factoryNameFor(fr) {
    const fm = state.factory.mappings;
    if (fm.factoryName && fr[fm.factoryName] != null && String(fr[fm.factoryName]).trim()) {
      return String(fr[fm.factoryName]).trim();
    }
    const fname = state.factory.file ? state.factory.file.name : '';
    return fname ? fname.replace(/\.[^.]+$/, '') : '';
  }

  function renderReview() {
    const rows = state.results.needsReview.map((n) => {
      // side: 'factory' = name exists in company sheet but not in factory sheet;
      //        'company' = name exists in factory sheet but not in company sheet.
      const fromFactory = n.side !== 'company';
      const badge = fromFactory
        ? `<span class="badge bad">${escapeHtml(t('badgeMissingFactory'))}</span>`
        : `<span class="badge warn">${escapeHtml(t('badgeMissingCompany'))}</span>`;
      const reason = fromFactory ? t('reasonNotFound') : t('reasonNotFoundCompany');
      return `<tr>
        <td>${escapeHtml(n.name)}</td>
        <td>${badge}</td>
        <td>${escapeHtml(n.recruiter)}</td>
        <td>${escapeHtml(reason)}</td>
      </tr>`;
    });
    $('#table-review tbody').innerHTML =
      rows.join('') || `<tr><td colspan="4" class="empty">${escapeHtml(t('emptyReview'))}</td></tr>`;
  }

  function renderSubtotals() {
    const rows = state.results.subtotals.map((s) => `<tr>
      <td>${escapeHtml(s.recruiter)}</td>
      <td class="big-num">${escapeHtml(s.amount)}</td>
    </tr>`);
    $('#table-subtotals tbody').innerHTML =
      rows.join('') || `<tr><td colspan="2" class="empty">${escapeHtml(t('emptySubtotals'))}</td></tr>`;
  }

  // ---------------- filters ----------------
  ['filter-dept', 'filter-rec', 'filter-status', 'filter-name'].forEach((id) => {
    $('#' + id).addEventListener('input', renderMatched);
  });

  // ---------------- language switch ----------------
  ['lang-zh', 'lang-en'].forEach((id) => {
    $('#' + id).addEventListener('click', () => {
      lang = id === 'lang-zh' ? 'zh' : 'en';
      applyI18n();
    });
  });

  // ---------------- theme switch ----------------
  $$('[data-theme-btn]').forEach((btn) => {
    btn.addEventListener('click', () => {
      theme = btn.dataset.themeBtn;
      localStorage.setItem(THEME_KEY, theme);
      applyTheme();
    });
  });

  // ---------------- export ----------------
  $('#btn-export').addEventListener('click', () => {
    const { matched, needsReview, subtotals, summary } = state.results;
    const bytes = HrExporter.buildWorkbookBytes({
      matched, needsReview, subtotals, summary,
      mappings: { factory: state.factory.mappings },
      factoryNameFallback: state.factory.file ? state.factory.file.name.replace(/\.[^.]+$/, '') : '',
      lang
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

  // ---------------- boot ----------------
  setupDropzone('dz-factory', 'factory');
  setupDropzone('dz-company', 'company');
  applyTheme();
  applyI18n();
})();