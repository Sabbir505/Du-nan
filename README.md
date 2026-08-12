# HR Hours Matching Tool

A local, browser-based tool for the HR department. It merges a **factory attendance sheet** with a **company income sheet** by person name, surfaces the authoritative hours worked from the factory, and keeps the recruiter information from the company side.

Everything runs **entirely in your browser** — no data is uploaded anywhere, and nothing is stored between sessions.

## What it does

1. **Upload the factory attendance sheet** (e.g. `7月由甲考勤.xlsx`): 序号 · 姓名 · 四级部门 · 岗位 · 计薪天数/小时 · 绩效奖金.
2. **Upload the company income sheet** (e.g. `6月溧阳由甲（每个人的收入）.xls`): person names plus the **recruiter** column (杨树海, 吴梦, 方经理 …).
3. The tool **auto-detects the column mapping** and shows dropdowns so you can confirm or override each one.
4. Click **Match & View** — every company person is matched by name to the factory sheet:
   - matched rows show recruiter, department, position, **factory hours**, bonus, and the company's own hours side-by-side;
   - people with duplicate names (e.g. `黄亚丽` matching both `黄亚丽1` and `黄亚丽2`) are flagged **Duplicate — review**;
   - people not found in the factory sheet land in **Needs Review** with their recruiter.
5. The company sheet's **recruiter subtotal rows** are kept in their own table.
6. **Export .xlsx** downloads a workbook with four tabs: `Matched`, `Needs Review`, `Subtotals`, `Summary` (by recruiter).

## How to run

No installation needed. Open **`index.html`** in any modern browser (Chrome, Edge, Firefox).

> Because the tool uses local file reading, on some browsers you may need to open `index.html` by double-clicking it (or via a tiny local server such as `python -m http.server`). Double-clicking normally works.

## File format expectations

- **Factory sheet**: clean tabular data, header row on top, one row per person. Duplicate names may be disambiguated with a trailing digit (`黄亚丽1`, `黄亚丽2`).
- **Company sheet**: person rows + per-recruiter subtotal rows (name empty, recruiter present) + blank separator rows. The tool automatically skips blanks and keeps subtotals separately.
- Both `.xlsx` and legacy `.xls` are supported, plus `.csv`.

## Column mapping

After both files are uploaded, the mapping panel appears. Columns are auto-detected from header keywords (姓名/Name, 部门/Department, 岗位/Position, 计薪/小时/Hours, 绩效/Bonus, 招聘/Recruiter). The company recruiter column is often **headerless** — the tool picks the most likely column automatically and highlights it. You can change any selection before matching.

## Testing

Unit + integration tests run with Node's built-in test runner (no dependencies to install):

```bash
npm test
```

The unit tests always run. The end-to-end integration test runs against the two real sample spreadsheets when they are present locally (`sample_factory.xls` / `sample_factory_attendance.xlsx`). Those samples contain real employee data and are deliberately **not** committed to the repo; the integration test skips cleanly when they're absent, so a fresh clone still passes.

## Privacy

All processing happens locally in your browser. Nothing is sent over the network, and no data is persisted between sessions — each open of the page is a clean slate.
