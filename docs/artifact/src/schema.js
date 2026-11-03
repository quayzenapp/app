/* ===== schema.js ===== */
/* Register definitions, lists and reference data.
   Ported from the server version (app/models.py, app/seed.py). Every register
   is declared once here; the declaration drives forms, lists, imports, exports
   and restricted-field handling. */


const YES_NO = ["Yes", "No"], YES_NO_TBC = ["Yes", "No", "To be confirmed"], YES_NO_NA = ["Yes", "No", "Not applicable"];

const LOOKUPS = {
  designation_types: ["Authorised Person only", "Primary BSI", "Secondary BSI", "Duty Free BSI"],
  legalforms: ["Private Company with Limited Liability", "Public Company with Limited Liability", "Company Limited by Guarantee", "Offshore Company", "Branch of an Overseas Company", "Partnership", "Other"],
  request_statuses: ["New", "In Progress", "Under Review", "Approved", "Submitted", "Closed"],
  request_categories: ["Annual return", "Employee information", "Investment and FDI", "Office space and location",
    "Licence and approvals", "Business plan update", "Beneficial ownership", "General information"],
  staff_categories: ["Management", "Professional", "Technical", "Administrative", "Support"],
  employment_types: ["Full-time permanent", "Fixed-term contract", "Part-time", "Secondment", "Internship"],
  fund_relationships: ["Parent company", "Shareholder", "Group entity", "Unrelated investor", "Customer",
    "Bank or lender", "The company itself (retained profits)", "Other"],
  fund_classes: ["Pending review", "Equity investment", "Reinvested earnings", "Intra-company debt",
    "Other investment", "Service revenue or customer receipt", "Other funding"],
  ar_categories: ["Revenue", "Capital expenditure", "Basic remuneration", "Allowance payments", "Bonus payments",
    "Staff accommodation", "Health insurance", "Transportation", "Office rent", "Other staff benefits",
    "Other operational expenditure", "EPF payment", "ETF payment", "Gratuity payment"],
  licence_types: ["Authorised Person licence", "BSI designation", "Designated location approval",
    "Regulatory licence (other authority)", "Agreement", "Gazette or regulation", "Other approval"],
  obligation_types: ["Licence condition", "Agreement condition", "Law or regulation", "Commission request",
    "BSI performance indicator (KPI)", "Investment commitment", "Employment commitment", "Reporting deadline",
    "Business plan projection", "Internal control"],
  visa_categories: ["Residence visa - Port City Colombo (PCC residence)", "Residence visa - Port City Colombo (PCC business)",
    "Residence visa - Employee", "Residence visa - Investor", "Business visa", "Dependant visa", "Other (record details in notes)"],
  visa_statuses: ["Not started", "Documents being prepared", "Submitted through the Commission",
    "Submitted to Department of Immigration and Emigration", "Approved", "Rejected", "Expired", "Cancelled"],
  document_categories: ["Application documents", "Business plans", "AP and BSI approvals", "Annual returns",
    "Commission requests and responses", "Audited financial statements", "UBO declarations", "ROC filings",
    "Investment evidence", "Office agreements", "Visa and permit documents", "Board resolutions",
    "Constitutional documents", "Passports and IDs", "Other"],
};
const RESTRICTED_DOC_CATS = ["UBO declarations", "Passports and IDs", "Visa and permit documents"];

/* Field helper: F(name, label, type, opts) */
function F(name, label, type = "text", o = {}) { return Object.assign({ name, label, type }, o); }
function money(required = true) {
  const g = "Amount and currency";
  return [
    F("original_amount", "Original amount", "money", { required, group: g }),
    F("original_currency", "Original currency", "currency", { required, group: g, help: "Three letters, e.g. USD, LKR, GBP, SGD." }),
    F("usd_rate", "Rate to USD (units of original currency per 1 USD)", "rate", { group: g, help: "If 1 USD = 0.79 GBP, enter 0.79. Leave blank for USD amounts." }),
    F("usd_amount", "USD amount", "money", { group: g, help: "Worked out from the rate if left blank. You can type the bank's actual USD figure instead." }),
    F("lkr_rate", "Rate to LKR (LKR per 1 unit of original currency)", "rate", { group: g, help: "If 1 USD = 300 LKR and the amount is in USD, enter 300." }),
    F("lkr_amount", "LKR amount", "money", { group: g }),
    F("rate_date", "Exchange rate date", "date", { group: g }),
    F("rate_source", "Exchange rate source", "text", { group: g, help: "E.g. Central Bank indicative rate, bank advice." }),
    F("conversion_method", "Conversion method", "text", { readonly: true, group: g }),
  ];
}

const REG = {};
function reg(key, def) { def.key = key; def.fmap = {}; def.fields.forEach(f => def.fmap[f.name] = f); def.title = def.title || def.fields[0].name; REG[key] = def; }

reg("people", { label: "Director or shareholder", plural: "Directors and shareholders", module: "company", importable: true,
  fields: [
    F("full_name", "Full name (person or company)", "text", { required: true }),
    F("person_type", "Type", "choice", { choices: ["Individual", "Corporate"], required: true }),
    F("role", "Role", "choice", { required: true, choices: ["Director", "Shareholder", "Director and shareholder", "Company secretary", "Authorised signatory"] }),
    F("nationality", "Nationality / country of incorporation"),
    F("shareholding_pct", "Shareholding (%)", "decimal"),
    F("appointed_date", "Appointed / acquired on", "date"),
    F("ceased_date", "Ceased on", "date"),
    F("notes", "Notes", "textarea"),
  ], list: ["full_name", "person_type", "role", "nationality", "shareholding_pct", "ceased_date"] });

reg("ubo", { label: "Beneficial owner", plural: "Beneficial owners (UBO)", module: "company",
  intro: "Fields follow the Beneficial Ownership Declaration Form (Form_UBO). Identifying details are visible only to roles with UBO access. The system does not sign the declaration.",
  fields: [
    F("full_name", "Full name (as per NIC / passport)", "text", { required: true }),
    F("previous_name", "Previous full name (if any)", "text", { sensitive: "ubo" }),
    F("date_of_birth", "Date of birth", "date", { sensitive: "ubo" }),
    F("place_of_birth", "Place of birth", "text", { sensitive: "ubo" }),
    F("nationality", "Nationality"),
    F("country_of_residence", "Country of residence", "text", { sensitive: "ubo" }),
    F("residential_address", "Residential address", "textarea", { sensitive: "ubo" }),
    F("business_address", "Business address", "textarea", { sensitive: "ubo" }),
    F("postal_address", "Postal address", "textarea", { sensitive: "ubo" }),
    F("email", "Email address", "text", { sensitive: "ubo" }),
    F("mobile", "Contact number (mobile)", "text", { sensitive: "ubo" }),
    F("nic_number", "National identity number (with country of issue)", "text", { sensitive: "ubo" }),
    F("tin", "Tax identification number (with country of issue)", "text", { sensitive: "ubo" }),
    F("passport_number", "Passport number (with country of issue)", "text", { sensitive: "ubo" }),
    F("ownership_pct", "Ownership or control (%)", "decimal"),
    F("nature_extent", "Statement describing nature and extent of beneficial ownership", "textarea", { sensitive: "ubo" }),
    F("declaration_status", "Declaration status", "choice", { choices: ["Not prepared", "Draft prepared - awaiting signature", "Signed copy on file"], dflt: "Not prepared" }),
  ], list: ["full_name", "nationality", "ownership_pct", "declaration_status"] });

reg("requests", { label: "Commission request", plural: "Commission requests", module: "requests",
  fields: [
    F("title", "Title", "text", { required: true }),
    F("category", "Category", "choice", { lookup: "request_categories" }),
    F("description", "Short description", "textarea"),
    F("authority", "Requesting authority", "text", { dflt: "Colombo Port City Economic Commission" }),
    F("contact_name", "Contact person"),
    F("contact_email", "Contact email"),
    F("received_date", "Date received", "date", { required: true }),
    F("deadline", "Deadline", "date"),
    F("period_or_date", "Reporting period or date the request relates to"),
    F("responsible", "Responsible person", "user"),
    F("status", "Status", "choice", { lookup: "request_statuses", dflt: "New", readonly: true }),
    F("required_info", "Information and documents requested", "textarea"),
    F("original_request", "Original email or request text", "textarea", { group: "Correspondence" }),
    F("follow_up", "Follow-up actions", "textarea", { group: "Follow-up" }),
    F("follow_up_due", "Follow-up due", "date", { group: "Follow-up" }),
    F("notes", "Notes", "textarea", { group: "Follow-up" }),
  ], list: ["title", "category", "received_date", "deadline", "responsible", "status"] });

reg("templates", { label: "Response template", plural: "Response templates", module: "requests",
  fields: [F("title", "Template name", "text", { required: true }), F("category", "Request category", "choice", { lookup: "request_categories" }),
    F("body", "Template text", "textarea", { required: true, help: "Placeholders: {company_name}, {licence_number}, {as_at}, {today}, {signatory}, {contact_name}." })],
  list: ["title", "category"] });

reg("positions", { label: "Position", plural: "Positions", module: "workforce", importable: true, title: "title",
  fields: [
    F("ref", "Position reference", "text", { required: true }),
    F("title", "Job title", "text", { required: true }),
    F("staff_category", "Staff category", "choice", { lookup: "staff_categories" }),
    F("min_qualifications", "Minimum required qualifications", "textarea", { help: "The position's requirement, not the qualifications of the person holding it." }),
    F("min_experience_years", "Minimum years of experience", "decimal"),
    F("languages", "Language requirements"),
    F("planned_headcount", "Planned number of people", "int"),
    F("status", "Status", "choice", { choices: ["Active", "Open - recruiting", "Closed"], dflt: "Active" }),
  ], list: ["ref", "title", "staff_category", "min_experience_years", "languages", "status"] });

reg("employees", { label: "Person", plural: "Workforce register", module: "workforce", importable: true, title: "ref",
  intro: "Employees and independent contractors are kept separate. Annual return headcounts count employees only.",
  fields: [
    F("ref", "Employee or position reference", "text", { required: true }),
    F("full_name", "Name", "text", { sensitive: "personal" }),
    F("position_id", "Position", "ref", { ref: "positions" }),
    F("job_title", "Job title", "text", { required: true }),
    F("staff_category", "Staff category", "choice", { lookup: "staff_categories" }),
    F("nationality", "Nationality", "text", { required: true }),
    F("nationality_group", "Reporting group", "choice", { choices: ["Sri Lankan", "Non-Sri Lankan"], help: "Filled from nationality if left blank." }),
    F("worker_type", "Employee or contractor", "choice", { choices: ["Employee", "Independent contractor"], required: true, dflt: "Employee" }),
    F("employment_type", "Employment type", "choice", { lookup: "employment_types" }),
    F("status", "Employment status", "choice", { choices: ["Active", "On notice", "Left", "Offer accepted - not started"], dflt: "Active" }),
    F("start_date", "Start date", "date", { required: true }),
    F("end_date", "End date", "date"),
    F("office_id", "Office location", "ref", { ref: "offices" }),
    F("residency", "Tax residency (for adviser review)", "choice", { choices: ["Resident", "Non-resident", "To be confirmed"], help: "For information only. The system does not decide tax treatment." }),
    F("pay_currency", "Pay currency", "currency", { sensitive: "pay", group: "Remuneration (restricted)" }),
    F("monthly_basic", "Monthly basic pay", "money", { sensitive: "pay", group: "Remuneration (restricted)" }),
    F("monthly_allowances", "Monthly allowances", "money", { sensitive: "pay", group: "Remuneration (restricted)" }),
    F("notes", "Notes", "textarea"),
  ], list: ["ref", "full_name", "job_title", "nationality_group", "worker_type", "status", "start_date", "office_id"] });

reg("policies", { label: "Benefit or policy", plural: "Policies and benefits", module: "workforce",
  fields: [
    F("policy_type", "Type", "choice", { required: true, choices: ["Accommodation", "Health insurance", "Travel and relocation", "Other benefit", "Allowance", "Facility"] }),
    F("title", "Policy name", "text", { required: true }),
    F("description", "What is provided", "textarea"),
    F("eligibility", "Eligibility", "textarea"),
    F("coverage_limit", "Coverage or limit"),
    F("applies_to", "Applies to", "choice", { choices: ["All staff", "Selected staff categories", "Sri Lankan staff only", "Non-Sri Lankan staff only"], dflt: "All staff" }),
    F("categories", "Staff categories (if selected)"),
    F("effective_from", "Effective from", "date"),
    F("effective_to", "Effective to", "date"),
  ], list: ["policy_type", "title", "applies_to", "coverage_limit", "effective_from"], title: "title" });

reg("investments", { label: "Investment or funding record", plural: "Investment and funding register", module: "investment", importable: true, money: true, reviewable: true,
  title: "source_name", intro: "Foreign receipts are not treated as FDI automatically. A reviewer confirms each classification.",
  fields: [
    F("entry_date", "Date received / recorded", "date", { required: true }),
    F("source_name", "Source (who provided the funds)", "text", { required: true }),
    F("source_country", "Source country"),
    F("relationship", "Relationship to the company", "choice", { lookup: "fund_relationships" }),
    F("description", "Description", "textarea"),
    ...money(),
    F("bank_reference", "Bank reference", "text", { sensitive: "bank" }),
    F("from_outside_sl", "Funds raised from outside Sri Lanka?", "choice", { choices: YES_NO_TBC, help: "The Technical Evaluation Form defines FDI as funds raised from outside Sri Lanka." }),
    F("classification", "Funding classification (proposed)", "choice", { lookup: "fund_classes", dflt: "Pending review", help: "Only confirmed records count in FDI totals." }),
    F("review_notes", "Review notes", "textarea"),
  ], list: ["entry_date", "source_name", "source_country", "original_amount", "original_currency", "usd_amount", "classification"] });

reg("offices", { label: "Office", plural: "Office register", module: "offices", importable: true,
  fields: [
    F("name", "Office name", "text", { required: true }),
    F("address", "Address", "textarea", { required: true }),
    F("location", "Location", "choice", { required: true, choices: ["Inside Colombo Port City", "Outside Colombo Port City"] }),
    F("designated_status", "Designated location status", "choice", { dflt: "Not applicable", choices: ["Not applicable", "Designated location (approved)", "Designation requested", "Not designated"] }),
    F("designation_ref", "Designation approval reference"),
    F("floor_area", "Floor area (as measured)", "decimal", { required: true }),
    F("area_unit", "Unit", "choice", { choices: ["sqm", "sqft"], required: true, dflt: "sqm" }),
    F("area_sqm", "Floor area (sqm)", "decimal", { readonly: true }),
    F("area_sqft", "Floor area (sqft)", "decimal", { readonly: true }),
    F("measurement_basis", "Measurement", "choice", { choices: ["Exact", "Approximate"], dflt: "Exact" }),
    F("seats", "Number of seats", "int"),
    F("status", "Status", "choice", { choices: ["In use", "Planned", "Vacated"], dflt: "In use" }),
    F("in_use_from", "In use from", "date"),
    F("in_use_to", "In use to", "date"),
    F("lease_start", "Lease / rental start", "date", { group: "Lease" }),
    F("lease_end", "Lease / rental end", "date", { group: "Lease" }),
    F("rent_amount", "Rent amount", "money", { group: "Lease" }),
    F("rent_currency", "Rent currency", "currency", { group: "Lease" }),
    F("rent_frequency", "Rent is per", "choice", { choices: ["Month", "Quarter", "Year"], group: "Lease" }),
    F("present_count", "People physically present (optional)", "int", { group: "Physical presence", help: "Only if you count it." }),
    F("present_date", "Date counted", "date", { group: "Physical presence" }),
  ], list: ["name", "location", "designated_status", "area_sqm", "area_sqft", "seats", "status"] });

reg("office_plans", { label: "Planned office requirement", plural: "Planned office requirements", module: "offices", title: "effective_date",
  fields: [
    F("effective_date", "Required from", "date", { required: true }),
    F("location", "Location", "choice", { choices: ["Inside Colombo Port City", "Outside Colombo Port City"], required: true }),
    F("required_sqm", "Space required (sqm)", "decimal", { required: true }),
    F("required_seats", "Seats required", "int"),
    F("basis", "Basis for this estimate", "text", { help: "E.g. Business plan v2, Year 3 headcount" }),
    F("annual_rent_usd", "Expected annual rent (USD)", "money"),
    F("annual_rent_lkr", "Expected annual rent (LKR)", "money"),
  ], list: ["effective_date", "location", "required_sqm", "required_seats", "basis"] });

reg("rent_options", { label: "Premises option", plural: "Premises options for rent comparison", module: "offices", importable: true, title: "name",
  intro: "Premises you are considering, inside Colombo Port City or at a designated location. Refundable deposits are kept separate from rent cost.",
  fields: [
    F("name", "Option name", "text", { required: true }),
    F("location", "Location type", "choice", { required: true, choices: ["Inside Colombo Port City", "Designated location outside Port City", "Outside Port City (not designated)"] }),
    F("address", "Address", "textarea"),
    F("designation_note", "Designation position (designated locations only)", "text", { help: "Regulation 15 of Regulations No. 1 of 2023 allowed designated locations outside Port City up to 26 May 2026. Confirm the current position with the Commission." }),
    F("floor_area", "Floor area", "decimal", { required: true }), F("area_unit", "Unit", "choice", { choices: ["sqm", "sqft"], required: true, dflt: "sqm" }),
    F("area_sqm", "Floor area (sqm)", "decimal", { readonly: true }), F("area_sqft", "Floor area (sqft)", "decimal", { readonly: true }),
    F("seats", "Seats it can take", "int"), F("available_from", "Available from", "date"),
    F("currency", "Currency", "currency", { required: true, group: "Rent and charges" }),
    F("rent_basis", "Rent is quoted as", "choice", { required: true, group: "Rent and charges", choices: ["Total per month", "Per sqm per month", "Per sqft per month"], dflt: "Per sqm per month" }),
    F("rent_rate", "Rent amount or rate", "money", { required: true, group: "Rent and charges" }),
    F("service_charge", "Service charge per month", "money", { group: "Rent and charges" }),
    F("escalation_pct", "Yearly rent increase (%)", "decimal", { group: "Rent and charges", dflt: 0 }),
    F("lease_years", "Lease term (years)", "decimal", { group: "Rent and charges", required: true, dflt: 3 }),
    F("deposit_months", "Refundable deposit (months of rent)", "decimal", { group: "Deposits and upfront costs", help: "Or type the deposit amount below." }),
    F("deposit_amount", "Refundable deposit (amount)", "money", { group: "Deposits and upfront costs", help: "Overrides the months figure if filled." }),
    F("advance_months", "Advance rent paid upfront (months)", "decimal", { group: "Deposits and upfront costs", help: "Prepaid rent. Counts as cost, not as a deposit." }),
    F("fitout_cost", "Fit-out and set-up cost (one-off)", "money", { group: "Deposits and upfront costs" }),
    F("notes", "Notes", "textarea"),
  ], list: ["name", "location", "area_sqm", "seats", "currency", "rent_rate", "rent_basis", "lease_years"] });

reg("fin_entries", { label: "Financial record", plural: "Financial records for returns", module: "returns", importable: true, money: true, reviewable: true, title: "description",
  intro: "Enter totals or individual transactions for each annual return category, or import them from an Excel export of your accounts. Amounts keep their original currency.",
  fields: [
    F("entry_date", "Date (or period end)", "date", { required: true }),
    F("category", "Annual return category", "choice", { lookup: "ar_categories", required: true }),
    F("country_region", "Customer country / region (revenue only)"),
    F("staff_group", "Staff group (staff costs only)", "choice", { choices: ["Not applicable", "Sri Lankan", "Non-Sri Lankan"], dflt: "Not applicable" }),
    F("office_id", "Office (rent only)", "ref", { ref: "offices" }),
    F("description", "Description", "text", { required: true }),
    ...money(),
    F("reference", "Invoice / voucher / ERP reference"),
    F("pre_operating", "Pre-operating transaction?", "choice", { choices: YES_NO, dflt: "No" }),
  ], list: ["entry_date", "category", "description", "staff_group", "original_amount", "original_currency", "usd_amount", "lkr_amount"] });

reg("housing", { label: "Residential unit", plural: "Staff residential units", module: "returns", title: "description",
  fields: [
    F("description", "Unit description", "text", { required: true }),
    F("staff_group", "Used by", "choice", { choices: ["Sri Lankan", "Non-Sri Lankan"], required: true }),
    F("tenure", "Leased or purchased", "choice", { choices: ["Leased", "Purchased"], required: true }),
    F("from_date", "From", "date", { required: true }),
    F("to_date", "To", "date"),
  ], list: ["description", "staff_group", "tenure", "from_date", "to_date"] });

reg("licences", { label: "Licence or approval", plural: "Licences, designations and agreements", module: "obligations", title: "title",
  fields: [
    F("licence_type", "Type", "choice", { lookup: "licence_types", required: true }),
    F("title", "Title", "text", { required: true }),
    F("number", "Number / reference"),
    F("issuing_authority", "Issued by", "text", { dflt: "Colombo Port City Economic Commission" }),
    F("issue_date", "Issue date", "date"),
    F("expiry_date", "Expiry date", "date"),
    F("status", "Status", "choice", { choices: ["Pending", "Active", "Expired", "Suspended", "Cancelled", "Surrendered"], dflt: "Active" }),
    F("designation_category", "Designation / category (if any)"),
    F("approved_activities", "Approved business activities", "textarea"),
    F("conditions", "Conditions stated in the licence or approval", "textarea", { help: "Add each condition under Obligations so it can be tracked. Conditions apply only as stated in your own licence." }),
    F("renewal_notice_days", "Remind me this many days before expiry", "int", { dflt: 60, help: "Fees Regulations No. 2 of 2024: renewal fee payable two months before expiry." }),
    F("renewal_fee_usd", "Renewal fee (USD)", "money"),
    F("responsible", "Responsible person", "user"),
    F("notes", "Notes", "textarea"),
  ], list: ["licence_type", "title", "number", "issue_date", "expiry_date", "status"] });

reg("obligations", { label: "Obligation or condition", plural: "Obligations and conditions", module: "obligations", title: "title",
  intro: "Record only conditions that apply to this company. Business plan projections are not treated as commitments unless a licence, approval or agreement says so.",
  fields: [
    F("title", "Obligation / condition", "text", { required: true }),
    F("description", "Description", "textarea"),
    F("obligation_type", "Type", "choice", { lookup: "obligation_types", required: true }),
    F("basis", "Why it applies to us", "choice", { required: true, choices: ["Stated in our licence, approval or agreement",
      "General law or regulation - applicability confirmed", "General law or regulation - applicability to be confirmed",
      "Requested by the Commission", "Business plan projection (not a commitment unless confirmed)", "Internal good practice"] }),
    F("source_document", "Source document and clause", "text", { required: true }),
    F("target", "Target (if any)"),
    F("deadline", "Deadline / next due date", "date"),
    F("recurrence", "Repeats", "choice", { choices: ["One-off", "Monthly", "Quarterly", "Annually"], dflt: "One-off" }),
    F("responsible", "Responsible person", "user"),
    F("status", "Status", "choice", { dflt: "Not started", choices: ["Not started", "In progress", "Met", "Not met", "Not applicable", "Under review"] }),
    F("needs_review", "Needs adviser review", "choice", { choices: YES_NO, dflt: "No" }),
    F("evidence", "Evidence and notes", "textarea"),
  ], list: ["title", "obligation_type", "basis", "deadline", "responsible", "status", "needs_review"] });

reg("visas", { label: "Visa or permit", plural: "Visas and permits", module: "visas", title: "person_name",
  intro: "Tracking only. The system does not apply for, submit or grant visas.",
  fields: [
    F("person_name", "Name", "text", { required: true, sensitive: "personal" }),
    F("person_type", "Person type", "choice", { choices: ["Employee", "Director", "Shareholder", "Consultant", "Dependant", "Other"], required: true }),
    F("nationality", "Nationality", "text", { required: true }),
    F("role", "Role / relationship"),
    F("visa_category", "Visa or permit category", "choice", { lookup: "visa_categories", required: true }),
    F("application_status", "Application status", "choice", { lookup: "visa_statuses", dflt: "Not started" }),
    F("passport_number", "Passport number", "text", { sensitive: "id" }),
    F("passport_expiry", "Passport expiry date", "date", { sensitive: "id" }),
    F("application_date", "Application date", "date"),
    F("approval_date", "Approval date", "date"),
    F("expiry_date", "Visa / permit expiry date", "date"),
    F("dependants", "Dependants (names and visa expiry)", "textarea", { sensitive: "personal" }),
    F("responsible", "Responsible person", "user"),
    F("notes", "Notes", "textarea"),
  ], list: ["person_name", "nationality", "visa_category", "application_status", "expiry_date", "responsible"] });

reg("fx_rates", { label: "Exchange rate", plural: "Exchange rates", module: "settings", importable: true, title: "currency",
  intro: "A reference table used to suggest rates. Each record still keeps its own rate, date and source.",
  fields: [F("rate_date", "Rate date", "date", { required: true }), F("currency", "Currency", "currency", { required: true }),
    F("per_usd", "Units of this currency per 1 USD", "rate"), F("lkr_per_unit", "LKR per 1 unit of this currency", "rate"),
    F("source", "Source", "text", { required: true })],
  list: ["rate_date", "currency", "per_usd", "lkr_per_unit", "source"] });

/* ---------------- Roles and permissions (same as server version) ---------------- */
const ROLES = { admin: "Administrator", compliance: "Compliance / administration officer", hr: "HR user",
  finance: "Finance user", reviewer: "Management reviewer", adviser: "External adviser (limited)" };
const MODULES = ["dashboard", "company", "bplan", "requests", "workforce", "investment", "offices",
  "returns", "obligations", "visas", "documents", "reports", "settings", "audit", "budget"];
const P = { n: "none", r: "read", w: "write", a: "approve" };
const PERM_CODES = { admin: "aaaaaaaaaaaaaaa", compliance: "rwwwrrwwwwwrrrr", hr: "rrrwwnwrrwwrnnn",
  finance: "rrwwrawwrnwrrna", reviewer: "rraararaarrrrra", adviser: "rrrrnrrrrnrrnnr" };
const SENSITIVE_ACCESS = { admin: ["personal", "id", "pay", "ubo", "bank"], compliance: ["personal", "id", "ubo", "bank"],
  hr: ["personal", "id", "pay"], finance: ["pay", "bank"], reviewer: ["personal", "pay", "ubo", "bank"], adviser: [] };
const SENSITIVE_LABELS = { personal: "Names and personal details", id: "Passport and identity details", pay: "Individual pay",
  ubo: "Beneficial ownership details", bank: "Bank and payment references" };

/* ---------------- Reference libraries (from the supplied documents) ---------------- */
const OBLIGATION_LIBRARY = [
  ["Submit the Annual Return when requested by the Commission", "Reporting deadline", "Annual Return Submission Form 2026", "All Authorised Persons asked to submit", "Annually", "Confirm the due date given in the Commission's request."],
  ["Pay the annual licence renewal fee two months before expiry", "Law or regulation", "Fees Regulations No. 2 of 2024, items 04-06 (Gazette 2387/38)", "All licensed APs", "Annually", "Amount depends on licence type."],
  ["File tax returns under the Inland Revenue Act", "Law or regulation", "Section 52C, inserted by Amendment Act No. 1 of 2026", "All Authorised Persons", "Annually", "Confirm filing dates with the tax adviser."],
  ["Obtain and keep other regulatory licences before starting regulated activities", "Agreement condition", "Annexure I - AP Declaration", "Companies with regulated activities", "One-off", "Only if an activity is regulated under other law."],
  ["Do not relocate Sri Lankan business into Port City without prior approval", "Agreement condition", "Annexure I - AP Declaration", "Applicants who signed the declaration", "One-off", ""],
  ["Earn more than half of revenue from persons other than Sri Lankan residents (if authorised to deal with residents)", "Law or regulation", "Regulations No. 1 of 2023, reg. 7(b) (Gazette 2339/31)", "Only APs authorised under reg. 6", "Annually", "Check whether the company holds such an authorisation."],
  ["Review position of designated location outside Port City", "Law or regulation", "Act s. 64; Regulations No. 1 of 2023, reg. 15 (Gazette 2339/31)", "APs operating from a designated location outside Port City", "One-off", "Reg. 15 allowed this up to 26 May 2026. Confirm the current position."],
  ["Meet approved BSI key performance indicators", "BSI performance indicator (KPI)", "Sections 52A-52B, inserted by Amendment Act No. 1 of 2026", "Businesses of Strategic Importance only", "Annually", "Record the KPIs stated in your own BSI approval."],
  ["Keep beneficial ownership information up to date", "Reporting deadline", "Annual Return Form 2026 (supporting document 2); Form_UBO", "All APs", "Annually", ""],
  ["Seek adviser review of staff income tax treatment", "Law or regulation", "Section 35 as replaced by Amendment Act No. 1 of 2026", "All APs with employees", "One-off", "The system records licence dates only; tax advice is needed."],
];

const LEGAL_REFS = [
  ["CPCEC Act No. 11 of 2021", "2021-05-27", "AP registration and licensing (Part VI); licence validity and conditions (s. 31); single window for visas (s. 33); BSI (s. 52); designated locations (s. 64)."],
  ["CPCEC (Amendment) Act No. 1 of 2026", "2026-01-20", "Replaced s. 35 (staff employment and income tax - for adviser review); s. 52A-52E (BSI KPI monitoring, every AP files tax returns); offshore banking."],
  ["AP Engaged in Business Regulations No. 1 of 2023 (Gazette 2339/31)", "2023-07-07", "LKR payments; business with Sri Lankan residents; interim designated locations up to 26 May 2026."],
  ["Fees Regulations No. 2 of 2024 (Gazette 2387/38)", "2024-06-05", "Processing fees and annual renewal fees payable two months before expiry."],
  ["Immigrants and Emigrants Regulations amendment (Gazette 2360/24)", "2023-11-07", "Visa types including Port City Colombo (PCC) residence / business."],
  ["Duty Free BSI Guidelines (Gazettes 2381/24, 2475/28)", "2024-04-22", "Duty-free BSI only."],
  ["Offshore Banking Regulations (Gazettes 2394/66, 2394/67)", "2024-07-26", "Offshore banking only."],
  ["Registration of Offshore Companies Regulations No. 1 of 2022 (Gazette 2306/54)", "2022-11-16", "Offshore company registration."],
  ["Development Control Regulations and amendments (Gazettes 2334/47, 2358/70, 2469/02)", "2023-06-02", "Planning within Port City."],
  ["Community Rules No. 1 of 2025 (Gazette 2466/27)", "2025-12-11", "Owners and occupiers in Port City."],
  ["Condominium Property Regulations No. 3 of 2024 (Gazette 2394/68)", "2024-07-26", "Condominium management."],
  ["Foreign Exchange (Investments in Port City) Regulations No. 1 of 2022 (Gazette 2282/59)", "2022-05-31", "Foreign exchange permission for Port City investments."],
];

const RESPONSE_TEMPLATES = [
  ["Employee information response", "Employee information", "Dear Sir / Madam,\n\nRe: Employee information - {company_name} (Licence {licence_number})\n\nFurther to your request, please find attached the requested information on our employees as at {as_at}, covering job titles and nationalities, minimum qualifications and experience for each position, language requirements, accommodation, health insurance, travel and relocation, and other benefits.\n\nPlease let us know if you need anything further.\n\nYours faithfully,\n\n{signatory}\n{company_name}"],
  ["Cover note - annual return", "Annual return", "Dear Sir / Madam,\n\nRe: Annual Return - {company_name} (Licence {licence_number})\n\nPlease find attached our completed Annual Return in the original fillable PDF format, together with the supporting documents listed in the form.\n\nYours faithfully,\n\n{signatory}\n{company_name}"],
  ["General acknowledgement", "General information", "Dear {contact_name},\n\nThank you for your request dated [date]. We are gathering the information and will respond by [date].\n\nKind regards,\n\n{signatory}\n{company_name}"],
];

/* Business plan reference: the plan the company submitted with its licence application (or a later revised plan).
   It is recorded as a reference for comparison only. Year-by-year fields follow the Technical Evaluation Form. */
const BP_SECTIONS = [
  ["background", "Company background", "Who the company is, where incorporated, group structure."],
  ["ownership", "Shareholders and directors", "Ownership and management."],
  ["activities", "Business activities and services", "What the company will do from Port City."],
  ["operating_model", "Operating model", "How the business will operate."],
  ["customers", "Target customers and markets", "Customers and the countries served."],
  ["implementation", "Implementation and operations plan", "Key steps and timing."],
  ["investment", "Investment and funding plan", "How the investment will be funded."],
  ["projections", "Revenue and expenditure projections", "Main assumptions behind the projections."],
  ["employment", "Employment and recruitment plans", "Hiring plan, local and foreign staff."],
  ["office", "Office space requirements", "Space needed and where."],
  ["other", "Other information", "Anything else the Commission should know."],
];
const BP_YEAR_FIELDS = [
  ["revenue_usd", "Projected revenue (USD)", "num"], ["expenses_usd", "Projected expenses (USD)", "num"],
  ["net_income_usd", "Projected net income (USD)", "num"], ["local_employees", "Local employees", "int"],
  ["foreign_employees", "Foreign employees", "int"], ["local_remuneration_usd", "Remuneration - local (USD)", "num"],
  ["foreign_remuneration_usd", "Remuneration - foreign (USD)", "num"], ["office_sqm", "Office floor space (sqm)", "num"],
  ["fdi_usd", "FDI (USD) - funds raised outside Sri Lanka", "num"], ["lkr_land_lease", "Investment in LKR (land lease)", "num"],
  ["funding_source", "Source of funding", "choice"], ["funding_details", "Details of funding source (max 75 words)", "text"],
  ["funding_evidence", "Evidence of funding submitted", "yn"],
];
const FUNDING_SOURCES = ["Equity", "Debt", "Equity and Debt", "Other"];

