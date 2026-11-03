import { PDFDocument, PDFCheckBox, PDFTextField } from "pdf-lib";
import { AR_TEMPLATE, arCompute, arPdfValues } from "../src/lib/ar/engine";
import { fillAnnualReturnPdf } from "../src/lib/ar/pdf";

/** Expected figures are worked out by hand, not taken from the code. No database needed. */
let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => { const ok = JSON.stringify(got) === JSON.stringify(want); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`); if (!ok) failed++; };

const fin = (entry_date: string, category: string, original_currency: string, original_amount: number, usd_amount: number | null, lkr_amount: number | null, extra = {}) => ({ id: Math.random().toString(), entry_date, category, original_currency, original_amount, usd_amount, lkr_amount, description: category, ...extra });
const data: Record<string, any[]> = {
  fin_entries: [
    fin("2025-05-01", "Revenue", "USD", 1000, 1000, 300000, { country_region: "Singapore" }),
    fin("2025-06-01", "Revenue", "GBP", 790, 1000, 300000, { country_region: "Singapore" }),
    fin("2025-07-01", "Revenue", "LKR", 600000, 2000, 600000, { country_region: "India" }),
    fin("2025-03-31", "Revenue", "USD", 999, 999, null, { country_region: "Too early" }), // before the period
    fin("2026-04-01", "Revenue", "USD", 999, 999, null, { country_region: "Too late" }), // after the period
    fin("2025-08-01", "Capital expenditure", "USD", 0.1, 0.1, null),
    fin("2025-08-02", "Capital expenditure", "USD", 0.2, 0.2, null), // cents must add exactly: 0.30
    fin("2025-08-03", "Capital expenditure", "LKR", 3000, 10, 3000),
    fin("2025-08-04", "Capital expenditure", "EUR", 50, null, null), // no conversion: left out, and said so
    fin("2025-09-01", "Basic remuneration", "LKR", 1000, 3.33, 1000, { staff_group: "Sri Lankan" }),
    fin("2025-09-02", "Basic remuneration", "USD", 500, 500, 150000, { staff_group: "Non-Sri Lankan" }),
    fin("2025-09-03", "EPF payment", "LKR", 80, null, 80, { staff_group: "Sri Lankan" }),
    fin("2025-09-04", "Other staff benefits", "USD", 5, 5, null), // counts under "other" opex
    fin("2025-09-05", "Other operational expenditure", "USD", 7, 7, null),
    fin("2025-10-01", "Office rent", "USD", 100, 100, null, { office_id: "o1" }),
    fin("2025-10-02", "Office rent", "USD", 40, 40, null, { office_id: "o2" }),
    fin("2025-10-03", "Office rent", "USD", 9, 9, null), // not linked to an office
  ],
  investments: [
    { id: "i1", entry_date: "2025-05-05", source_name: "Confirmed equity", classification: "Equity investment", usd_amount: 1000, from_outside_sl: "Yes", review_status: "Confirmed" },
    { id: "i2", entry_date: "2025-05-06", source_name: "Unreviewed equity", classification: "Equity investment", usd_amount: 5000, from_outside_sl: "Yes", review_status: "Pending" },
    { id: "i3", entry_date: "2025-05-07", source_name: "Customer receipt", classification: "Service revenue or customer receipt", usd_amount: 7000, from_outside_sl: "Yes", review_status: "Confirmed" },
    { id: "i4", entry_date: "2025-05-08", source_name: "Confirmed debt", classification: "Intra-company debt", usd_amount: 250, from_outside_sl: "Yes", review_status: "Confirmed" },
  ],
  employees: [
    { id: "e1", start_date: "2024-01-01", nationality_group: "Sri Lankan", worker_type: "Employee", status: "Active" },
    { id: "e2", start_date: "2024-01-01", nationality_group: "Sri Lankan", worker_type: "Independent contractor", status: "Active" }, // contractor: excluded
    { id: "e3", start_date: "2026-04-01", nationality_group: "Sri Lankan", worker_type: "Employee", status: "Active" }, // starts after the date
    { id: "e4", start_date: "2024-01-01", end_date: "2026-03-30", nationality_group: "Sri Lankan", worker_type: "Employee", status: "Left" }, // left the day before
    { id: "e5", start_date: "2024-01-01", end_date: "2026-03-31", nationality_group: "Non-Sri Lankan", worker_type: "Employee", status: "On notice" }, // last day counts
    { id: "e6", start_date: "2026-01-01", nationality_group: "Non-Sri Lankan", worker_type: "Employee", status: "Offer accepted - not started" }, // excluded
  ],
  offices: [
    { id: "o1", name: "Inside", address: "1  Port\nCity", location: "Inside Colombo Port City", area_sqm: 100.5, status: "In use", designated_status: "Not applicable" },
    { id: "o2", name: "Outside", address: "2 Colombo", location: "Outside Colombo Port City", area_sqm: 50, status: "In use", designated_status: "Designated location (approved)" },
    { id: "o3", name: "Vacated", address: "3 Old", location: "Inside Colombo Port City", area_sqm: 999, status: "Vacated", in_use_to: "2025-01-01" },
  ],
  office_plans: [{ id: "p1", location: "Inside Colombo Port City", effective_date: "2028-01-01", required_sqm: 400 }, { id: "p2", location: "Inside Colombo Port City", effective_date: "2027-01-01", required_sqm: 9999 }],
  housing: [{ id: "h1", staff_group: "Non-Sri Lankan", from_date: "2025-01-01" }, { id: "h2", staff_group: "Non-Sri Lankan", from_date: "2020-01-01", to_date: "2025-03-31" }],
};
const st = { list: (t: string) => data[t] ?? [], get: (t: string, id: string) => (data[t] ?? []).find((x) => x.id === id) ?? null };
const ret = (m: string) => ({ period_start: "2025-04-01", period_end: "2026-03-31", headcount_as_at: "2026-03-31", office_as_at: "2026-03-31", currency_method: m });
const company = { name: "Test Co", licence_number: "AP-1", tin: "T1", operations_commenced: "Yes" };
const s = arCompute(st, ret("split"), company), b = arCompute(st, ret("both"), company);

eq("revenue groups by country and currency, inside the period only, largest first", JSON.parse(s.r_revenue.text), [{ country: "India", currency: "LKR", amount: 600000 }, { country: "Singapore", currency: "USD", amount: 2000 }]);
eq("split: USD line has USD and converted currencies, adds cents exactly", s.b_capex_usd.num, 0.3);
eq("split: LKR line has LKR transactions only", s.b_capex_lkr.num, 3000);
eq("split: a missing conversion is left out and reported", s.b_capex_usd.detail.excluded.length, 1);
eq("both: USD line is the full converted total", b.b_capex_usd.num, 10.3);
eq("opex includes EPF and rent under 'both' (LKR)", b.b_opex_lkr.num, 151080);
eq("'other' combines other opex and other staff benefits", s.b_other_usd.num, 12);
eq("FDI total counts only confirmed FDI classes", s.b_fdi_total.num, 1250);
eq("FDI equity excludes the unreviewed record", s.b_fdi_equity.num, 1000);
eq("FDI warns about records awaiting review", s.b_fdi_total.detail.warnings.some((w: string) => w.includes("awaiting review")), true);
eq("headcount: employees only, on the date (Sri Lankan)", s.m_emp_sl.num, 1);
eq("headcount: last day counts, not-started excluded (Non-Sri Lankan)", s.m_emp_nsl.num, 1);
eq("headcount warns that contractors were excluded", s.m_emp_sl.detail.warnings.some((w: string) => w.includes("contractor")), true);
eq("remuneration by staff group", [s.m_rem_lkr_sl.num, s.m_rem_usd_nsl.num], [1000, 500]);
eq("office space in use on the date, by location", [s.o_in_sqm.num, s.o_out_sqm.num], [100.5, 50]);
eq("rent linked by office location; unlinked left out and reported", [s.o_in_rent_usd.num, s.o_out_rent_usd.num, s.o_in_rent_usd.detail.warnings.some((w: string) => w.includes("not linked"))], [100, 40, true]);
eq("projection uses 2028 plans only", s.o_proj_sqm.num, 400);
eq("units held at any time in the period", s.m_units_nsl.num, 1);
eq("designated tick only for approved designation", [s.p_op_designated_1.text, s.p_op_designated_2.text], ["No", "Yes"]);
eq("address whitespace is tidied", s.p_op_address_1.text, "1 Port City");
eq("a third office slot is not applicable", s.p_op_address_3.status, "not_applicable");
eq("project status from the profile", s.p_project_status.text, "Operations Commenced");

(async () => {
  const lines = Object.fromEntries(Object.entries(s).map(([k, v]: [string, any]) => [k, { status: v.status, num: v.num ?? null, text: v.text ?? null }]));
  lines.e_outstanding = { status: "not_applicable", num: null, text: null };
  const vals = arPdfValues(lines);
  eq("PDF: amounts use two decimals", vals.values.p2_field_037, "0.30");
  eq("PDF: counts have no decimals", vals.values.p3_field_017, "1");
  eq("PDF: Nil-type status is written for the Commission", vals.values.p4_field_013, "N/A");
  eq("PDF: shared rent field holds both groups", vals.values.p3_field_025.startsWith("SL: "), true);
  eq("PDF: Non-Sri Lankan figures with no field are listed for manual entry", vals.manual.some(([a]) => a.includes("Non-Sri Lankan")), true);
  const { bytes, check } = await fillAnnualReturnPdf(lines as any);
  eq("PDF: read-back found no problems", check.problems, []);
  eq("PDF: 4 pages and all 116 fields kept", [check.pages, check.fields], [4, 116]);
  const form = (await PDFDocument.load(bytes)).getForm();
  const get = (n: string) => (form.getField(n) as PDFTextField).getText() ?? "";
  eq("PDF: figures are really in the saved file", [get("p1_field_001"), get("p2_field_037"), get("p4_field_004")], ["Test Co", "0.30", "100.50"]);
  eq("PDF: designated tick saved for office 2 only", [form.getCheckBox("p1_checkbox_01").isChecked(), form.getCheckBox("p1_checkbox_02").isChecked()], [false, true]);
  const never = (AR_TEMPLATE.neverFill as string[]).map((n) => { const f = form.getField(n); return f instanceof PDFCheckBox ? f.isChecked() : (f as PDFTextField).getText() ?? ""; });
  eq("PDF: declarations, signature and date stay blank", never.every((v) => v === false || v === ""), true);
  console.log(failed ? `\n${failed} FAILED` : "\nAll annual return checks passed");
  process.exit(failed ? 1 : 0);
})();
