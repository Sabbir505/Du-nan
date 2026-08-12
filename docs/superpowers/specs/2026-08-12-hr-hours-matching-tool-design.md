# HR Hours-Matching Tool — Design Spec

**Date:** 2026-08-12
**Author:** HR Department (via brainstorming session)
**Status:** Approved (pending user review)

## Purpose

A local, browser-based tool for the HR department. Each month, HR works with two spreadsheets:

- **Sheet 1 (factory attendance — "工厂考勤"):** from the factory. Lists, per individual: sequence number, name, four-level department (四级部门), position (岗位), billable days/hours (计薪天数/小时), and performance bonus (绩效奖金). This is the authoritative source of hours worked.
- **Sheet 2 (company income — "公司收入"):** from our company. Lists, per individual: name, position, join date, billable days/hours, fee model, fee amount, deductions, and crucially **who recruited them** (the recruiter column — e.g. 杨树海, 吴梦, 方经理).

HR needs to combine these: for every person in Sheet 2, pull their **department** and **authoritative hours worked** from Sheet 1, producing a single view that ties recruiter → person → department → hours. The recruiter column is the essential piece only the company sheet has; the hours must come from the factory sheet. Result is viewed on screen and exportable.

## Real File Structures (confirmed from samples)

### Sheet 1 — Factory attendance (`7月由甲考勤.xlsx`)
Single sheet, clean tabular format, header row 1:
| 序号 | 姓名 | 四级部门 | 岗位 | 计薪天数/小时 | 绩效奖金 |
- One row per person, no subtotals, no blank rows.
- Duplicate names disambiguated with a numeric suffix: `黄亚丽1`, `黄亚丽2`, `贾椒娟1`, `罗文梁1`.
- 70 data rows in sample.

### Sheet 2 — Company income (`6月溧阳由甲（每个人的收入）.xls`)
Single sheet, **non-uniform layout** with subtotals interleaved. Header row 0:
| 序号 | 姓名 | 岗位 | 入职时间 | 计薪天数/小时 | 费用模式 | 费用金额 | 住宿亏损 | 住宿亏损承担 | 费用金额 | **recruiter (unnamed col K)** | (blank) | (blank) |
- Person rows have a name in 姓名 (col B) AND a recruiter in col K.
- **Subtotal rows**: name empty, recruiter present, an amount in col J — one per recruiter group (e.g. row 42: 方经理 | 5312.0).
- Fully blank separator rows between groups.
- Col K has no header — the tool must still map it as the recruiter column.
- 46 person rows + 7 subtotal rows in sample.
- Legacy `.xls` format (BIFF8) — SheetJS handles this, but the tool must accept both `.xls` and `.xlsx`.

## Goals

- Match people across the two sheets by name and surface authoritative hours worked from the factory sheet.
- Preserve the recruiter (only available from the company sheet) in the output.
- Handle real-world messiness: unmatched people, duplicate/suffixed names, subtotal rows, blank separators, headerless columns.
- Keep all data on the user's machine — nothing uploaded to any server (HR data privacy).
- Require no installation beyond opening a web page.

## Non-Goals

- No persistent storage / history. Each session is fresh; reload = blank slate.
- No multi-user or online hosting. Local-only.
- No fuzzy/approximate name matching beyond the agreed suffix rule (see Matching Logic).
- No editing of source data — read-only merge + export.

## Architecture

Single-page application running **entirely client-side** in the browser. No backend, no database, no network calls.

```
[Browser]
  ├── index.html            (page structure, upload zones, mapping UI, result tables)
  ├── styles.css            (layout + table styling)
  ├── app.js                (orchestration: upload → parse → map → match → render → export)
  ├── parser.js             (parse .xls/.xlsx → rows; classify rows as person/subtotal/blank)
  ├── matcher.js            (name matching + duplicate detection logic)
  ├── exporter.js           (build .xlsx export with tabs)
  └── vendor/xlsx.full.min.js   (SheetJS library, local copy — parses .xls and .xlsx, writes .xlsx)
```

The user opens `index.html` directly (double-click or `file://`). All libraries are vendored locally so no internet dependency exists.

## Data Flow

1. **Upload Sheet 1 (factory).** User drags/selects the `.xlsx`/`.xls` file. SheetJS parses to row arrays.
2. **Upload Sheet 2 (company).** Same parsing. Legacy `.xls` is supported.
3. **Column mapping.** The tool auto-detects columns by header keyword and presents dropdowns for confirmation:
   - Sheet 1: Name, Department (四级部门), Position, Hours (计薪天数/小时), Bonus (绩效奖金).
   - Sheet 2: Name, Recruiter (col K — headerless), Position, Company Hours (its own 计薪天数/小时), Fee Amount.
   - Detection heuristics (case-insensitive, substring, Chinese-aware):
     - Name: `姓名`, `name`, `员工`
     - Department: `部门`, `department`, `dept`
     - Position: `岗位`, `职位`, `position`
     - Hours: `计薪`, `天数`, `小时`, `hours`
     - Bonus: `绩效`, `奖金`, `bonus`
     - Recruiter: `招`, `推荐`, `recruiter`, `referrer` — **but the real Sheet 2 col K is headerless**, so the auto-detect falls back to "first unnamed column to the right of the data with non-empty values on person rows" and flags it for user confirmation.
   - User can override any mapping before matching.
4. **Parse & classify rows (parser.js).**
   - Sheet 1: every row with a non-empty Name is a person row. No subtotals to filter.
   - Sheet 2: classify each row as:
     - **person** — Name non-empty (has a name AND typically a recruiter).
     - **subtotal** — Name empty but Recruiter non-empty (group total row).
     - **blank** — both empty (separator).
   - Person rows → matching. Subtotal rows → kept in a separate "Subtotals" collection for the summary/export. Blank rows → discarded.
5. **Match (matcher.js).** For each person in Sheet 2, find rows in Sheet 1 by Name. See Matching Logic below.
6. **Render.** Tables on screen (see Output).
7. **Export.** Button downloads a `.xlsx` with tabs mirroring the on-screen sections.

## Matching Logic

Normalization before comparison: `trim()`. Comparison is **case-insensitive** for any Latin characters; Chinese names compared as-is after trim.

**Suffix rule (agreed):** The factory disambiguates duplicate names with a trailing digit (`黄亚丽1`, `黄亚丽2`). When the company sheet has a plain name `黄亚丽`:
- Collect all factory rows whose name **equals the plain name OR equals the plain name + trailing digits**.
  - `黄亚丽` matches `黄亚丽` and `黄亚丽1` and `黄亚丽2`.
- If **exactly one** match → matched row.
- If **two or more** matches → all rows shown in the main table, each tagged with a **duplicate warning badge** (status: "Duplicate — review"). The user resolves in the export.
- If **zero** matches → goes to "Needs Review" with reason "Name not found in factory sheet".

**No-match cases** also land in Needs Review, e.g. a company-sheet name that has no factory counterpart at all (plain or suffixed).

**Same-name across sheets with no suffix:** if Sheet 2 itself has the same name twice with different recruiters, both rows are kept and matched independently.

## Output

### On-screen — three sections

**1. Summary stats** (top of page)
- Total people (company sheet), matched count, duplicate-flagged count, unmatched count.
- Total hours (sum of factory hours across matched people).
- Breakdown by recruiter: people count + total hours.
- Breakdown by department: people count + total hours.

**2. Matched table** — one row per matched person:
| 姓名 Name | Recruiter | 四级部门 Dept | 岗位 Position | 计薪天数/小时 (Factory) | 绩效奖金 Bonus | Company 计薪天数/小时 | Status |
- Status values: `Matched`, `Duplicate — review`.
- Features: click column header to sort; filter dropdowns (department, recruiter, status).

**3. Needs Review table** — people not matched:
| 姓名 Name | Recruiter | Reason |

**4. Subtotals table** (from Sheet 2, kept separately as requested):
| Recruiter | Subtotal Amount |

### Export
Downloads `hours-report-YYYY-MM-DD.xlsx` with four tabs:
- **Matched** (full columns incl. both hours columns for cross-check)
- **Needs Review**
- **Subtotals**
- **Summary** (recruiter + department breakdowns)

## Error Handling

- **Unparseable file** (corrupt / not a spreadsheet): inline error on the upload zone, no crash. User retries.
- **Required column missing or unmapped** (e.g. no Name mapped): disable Match button with a tooltip.
- **Empty sheet / zero person rows**: warn, disable matching.
- **Headerless recruiter column** (the real Sheet 2 case): auto-detect picks the best candidate and highlights it for user confirmation rather than guessing silently.
- **Non-numeric hours cell** (e.g. text): displayed as-is; treated as 0 in totals; row still shown so the user sees the raw value.
- **Duplicate names**: not an error — surfaced as a warning badge, all rows retained.

## Components & Responsibilities

### parser.js — Parsing & Row Classification
- Input: raw file (File object).
- Output: `{ headers: [...], rows: [{...}], personRows, subtotalRows, blankCount }`.
- Uses SheetJS to read `.xls`/`.xlsx`. Classifies Sheet 2 rows by the person/subtotal/blank rule. Pure logic, no DOM.

### matcher.js — Matching Logic
- Input: Sheet 1 person rows, Sheet 2 person rows, column mappings.
- Output: `{ matched: [...], needsReview: [...], duplicates: [...] }`.
- Implements normalization + suffix rule. Pure functions, no DOM — independently testable.

### exporter.js — Export
- Input: matched, needsReview, subtotals, summary.
- Output: triggers `.xlsx` download via SheetJS `writeFile`. Pure data → workbook transform.

### app.js — Orchestration
- Wires file inputs, drag-drop, mapping UI, match button, export button.
- Holds parsed data + mappings in memory. Calls parser/matcher/exporter, renders DOM.
- Thin glue over tested logic.

### vendor/xlsx.full.min.js — SheetJS
- Local copy. Parses `.xls` and `.xlsx`; writes `.xlsx`.

## Testing

- **parser.js**: given the two real sample files, produces correct header lists, person/subtotal/blank classification (46 persons, 7 subtotals on Sheet 2; 70 persons on Sheet 1).
- **matcher.js** (core, pure functions):
  - Exact single match → matched.
  - Suffix rule: `黄亚丽` matches `黄亚丽1` + `黄亚丽2` → both returned, flagged duplicate.
  - Plain name with exactly one suffixed match → matched (not flagged).
  - No match → needsReview.
  - Case/whitespace insensitivity.
  - Empty inputs → empty results, no crash.
- **exporter.js**: sample inputs → workbook with four correctly-named tabs and correct row counts.
- **app.js**: verified manually — upload both samples, confirm auto-mapping, match, inspect tables, export, reopen export to verify content.

## Open Questions / Assumptions

- **Assumed:** Sheet 2 col K is always the recruiter column even when headerless. The auto-detect + confirm step guards this; if a future template moves it, the user re-maps via dropdown.
- **Assumed:** Factory sheet hours (计薪天数/小时) is the authoritative "hours worked" — confirmed by user.
- **Assumed:** Numeric suffixes on factory duplicate names are always trailing digits (1, 2, ...). If a different disambiguation scheme appears, it falls through to strict-exact and lands in Needs Review.
- **Not yet known:** Whether the factory ever sends a Sheet 1 in legacy `.xls` (sample was `.xlsx`). Tool supports both regardless.
