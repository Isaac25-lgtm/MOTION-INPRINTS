/**
 * Motion Imprints Technologies solution families.
 *
 * Truthfulness rules (master handoff §3, §9.4–9.6, §10):
 * - These are solution families that are configured per project, not claims
 *   that one finished product already contains every feature. Scope-dependent
 *   features say so ("where scoped", "configurable").
 * - National systems (DHIS2, eHMIS and similar) are described as integration
 *   possibilities where the client is authorised, never as existing access.
 * - No clients, deployments, certifications, compliance, results or metrics.
 * - Digital Marketing is an owner addition (OD-01, after the Codex handoff),
 *   aimed at newly established businesses.
 */

export type VisualKey =
  | "health"
  | "me"
  | "business"
  | "sacco"
  | "education"
  | "pos"
  | "web"
  | "marketing"
  | "analytics"
  | "custom";

export type Block =
  | {
      kind: "workflow";
      eyebrow: string;
      title: string;
      steps: { title: string; text: string }[];
    }
  | {
      kind: "modules";
      eyebrow: string;
      title: string;
      intro?: string;
      items: { title: string; text: string }[];
    }
  | {
      kind: "contrast";
      eyebrow: string;
      title: string;
      before: string[];
      after: string[];
    }
  | {
      kind: "questions";
      eyebrow: string;
      title: string;
      items: { q: string; a: string }[];
    };

export type Solution = {
  slug: string;
  name: string;
  /** One line for cards and menus. */
  summary: string;
  headline: string;
  lede: string;
  /** Primary action label, e.g. "Discuss a Health System". */
  cta: string;
  visual: VisualKey;
  /** The problem this family exists to solve, in the buyer's words. */
  problem: string;
  blocks: Block[];
  roles: { role: string; does: string }[];
  integrations: { items: string[]; note: string };
  data: string[];
  related: string[];
};

export const solutions: Solution[] = [
  {
    slug: "health",
    name: "Health systems",
    summary:
      "Configurable systems for clinics and hospitals: patient flow, records, reporting.",
    headline: "Health systems built around how a facility actually runs",
    lede: "Patient registration, encounters, the lab, the pharmacy and management reporting, configured for your facility's workflow rather than forced into someone else's.",
    cta: "Discuss a Health System",
    visual: "health",
    problem:
      "Most facilities already have a way of working: registers, forms and handovers that staff know. The risk with a new system is that it breaks that flow. We start from the patient's path through your facility and build the system around it.",
    blocks: [
      {
        kind: "workflow",
        eyebrow: "The patient's path",
        title: "One record, from the front desk to the report",
        steps: [
          {
            title: "Registration",
            text: "Find or create the patient once, with the identifiers your facility uses.",
          },
          {
            title: "Triage and consultation",
            text: "Vitals, findings, diagnoses and orders recorded at the point of care.",
          },
          {
            title: "Lab and pharmacy",
            text: "Requests and results, prescriptions and dispensing, where these modules are in scope.",
          },
          {
            title: "Billing and discharge",
            text: "Charges, payments and discharge summaries tied to the same visit.",
          },
          {
            title: "Reporting",
            text: "Service counts and management summaries built from the records, not re-typed.",
          },
        ],
      },
      {
        kind: "modules",
        eyebrow: "Configurable modules",
        title: "Start with what you need",
        intro:
          "A small clinic and a hospital need different things. Modules are scoped per facility.",
        items: [
          {
            title: "Patient records",
            text: "Demographics, visit history and clinical notes.",
          },
          {
            title: "Outpatient and inpatient",
            text: "Queues, admissions, ward rounds and transfers.",
          },
          {
            title: "Laboratory",
            text: "Test catalogue, requests, results and validation.",
          },
          {
            title: "Pharmacy and stores",
            text: "Stock, dispensing, expiry and reorder levels.",
          },
          {
            title: "Billing",
            text: "Tariffs, invoices, receipts and insurance schemes where applicable.",
          },
          {
            title: "Management dashboard",
            text: "Attendance, services and stock at a glance for managers.",
          },
        ],
      },
      {
        kind: "questions",
        eyebrow: "Before you commit",
        title: "Questions facilities ask",
        items: [
          {
            q: "What if the internet is unreliable?",
            a: "Connectivity is part of the design conversation. Depending on the facility, options range from a local server to offline-capable capture that syncs when a connection returns.",
          },
          {
            q: "Can it report to DHIS2 or eHMIS?",
            a: "Reporting can be designed to match national formats, and automated exchange can be built where the facility or programme is authorised to connect. We never assume access to national systems.",
          },
          {
            q: "Who owns the data?",
            a: "The facility. Hosting, access and backups are agreed at the start and written down.",
          },
        ],
      },
    ],
    roles: [
      {
        role: "Records and front desk",
        does: "Registration, queues and appointments",
      },
      {
        role: "Clinicians",
        does: "Consultations, orders and clinical notes",
      },
      {
        role: "Lab and pharmacy",
        does: "Results, dispensing and stock",
      },
      {
        role: "Accounts",
        does: "Billing, payments and reconciliation",
      },
      {
        role: "Management",
        does: "Dashboards and reports, without editing records",
      },
    ],
    integrations: {
      items: [
        "DHIS2 / eHMIS reporting formats",
        "HL7 FHIR where required",
        "Laboratory equipment exports",
        "Mobile money and payment references",
        "Excel and CSV imports",
      ],
      note: "Integrations are scoped per project and built only where the facility is authorised to connect.",
    },
    data: [
      "Role-based access so each person sees only what their work needs",
      "An audit trail of who created or changed a record, and when",
      "Encrypted connections, with hosting and backups agreed in writing",
      "Demonstrations use synthetic patients, never real records",
    ],
    related: ["monitoring-evaluation", "analytics", "custom-software"],
  },

  {
    slug: "monitoring-evaluation",
    name: "Monitoring and evaluation",
    summary:
      "From results framework to field data to the report the donor reads.",
    headline: "M&E platforms that turn field data into decisions",
    lede: "Results frameworks, indicators, field collection, data-quality checks, analysis and reporting in one place, so the quarterly report is the output of the system and not a scramble.",
    cta: "Discuss an M&E Platform",
    visual: "me",
    problem:
      "Programme data often lives in five places: survey tools, spreadsheets, partner reports, email attachments and someone's memory. Reporting becomes a manual merge every quarter, and data quality is checked too late to fix. An M&E platform should make the framework the backbone and let every number trace back to its source.",
    blocks: [
      {
        kind: "contrast",
        eyebrow: "What changes",
        title: "From quarterly scramble to a running picture",
        before: [
          "Indicators defined in a document nobody opens",
          "Survey exports merged by hand in Excel",
          "Errors found after the report is due",
          "Partner figures arrive in different formats",
        ],
        after: [
          "Indicators, targets and disaggregations defined in the system",
          "Kobo, ODK or Excel data imported on a schedule",
          "Data-quality rules flag problems as data arrives",
          "Partners submit through the same structured forms",
        ],
      },
      {
        kind: "modules",
        eyebrow: "The platform",
        title: "Built on your results framework",
        items: [
          {
            title: "Results framework",
            text: "Goals, outcomes, outputs and indicators with definitions and targets.",
          },
          {
            title: "Data collection",
            text: "Web and mobile forms, or imports from Kobo, ODK and spreadsheets.",
          },
          {
            title: "Data quality",
            text: "Range, completeness and consistency rules with a review queue.",
          },
          {
            title: "Analysis",
            text: "Targets against actuals, trends and disaggregation by sex, age, location or partner.",
          },
          {
            title: "Maps",
            text: "Results by district or site where locations are captured.",
          },
          {
            title: "Reporting",
            text: "Scheduled summaries and exports in the formats funders ask for.",
          },
        ],
      },
      {
        kind: "workflow",
        eyebrow: "How it is set up",
        title: "Framework first, screens second",
        steps: [
          {
            title: "Map the framework",
            text: "Indicators, definitions, sources and reporting periods agreed with the M&E team.",
          },
          {
            title: "Connect the sources",
            text: "Forms built or existing tools connected, with test data run through.",
          },
          {
            title: "Set the checks",
            text: "Data-quality rules written with the people who know the data.",
          },
          {
            title: "Train and hand over",
            text: "Field staff, partners and managers trained on their own screens.",
          },
        ],
      },
    ],
    roles: [
      { role: "Enumerators and partners", does: "Collect and submit data" },
      { role: "M&E officers", does: "Review quality and approve data" },
      { role: "Programme managers", does: "Track progress against targets" },
      {
        role: "Leadership and funders",
        does: "Read-only dashboards and reports",
      },
    ],
    integrations: {
      items: [
        "KoboToolbox",
        "ODK",
        "DHIS2 where authorised",
        "Excel and CSV",
        "Existing databases",
      ],
      note: "Connections to external platforms are built with the programme's own credentials and permissions.",
    },
    data: [
      "Personal data collected only where the indicator needs it",
      "Partner users see their own data; programme staff see the whole",
      "Every approval and edit is logged",
      "Public dashboards show aggregates only",
    ],
    related: ["analytics", "health", "custom-software"],
  },

  {
    slug: "business",
    name: "Business management systems",
    summary: "Sales, stock, customers, expenses and branches in one system.",
    headline: "One system for the business you actually run",
    lede: "Sales, inventory, customers, expenses, staff and branches in one place, with reports the owner can read at the end of the day.",
    cta: "Discuss a Business System",
    visual: "business",
    problem:
      "A growing business outgrows exercise books and scattered spreadsheets quickly. Stock goes missing without anyone noticing, debtors are chased from memory, and the owner cannot see yesterday's numbers without calling someone. The fix is not more paperwork; it is one system that records the work as it happens.",
    blocks: [
      {
        kind: "modules",
        eyebrow: "Configurable modules",
        title: "Pick the parts your business needs",
        items: [
          {
            title: "Sales and invoicing",
            text: "Quotes, invoices, receipts and credit sales.",
          },
          {
            title: "Inventory",
            text: "Stock in, stock out, transfers, counts and reorder alerts.",
          },
          {
            title: "Customers and suppliers",
            text: "Balances, statements and purchase history.",
          },
          {
            title: "Expenses",
            text: "Categorised spending with approvals where needed.",
          },
          {
            title: "Branches and users",
            text: "Each branch and each person with their own permissions.",
          },
          {
            title: "Owner's dashboard",
            text: "Today's sales, stock value and debtors from a phone.",
          },
        ],
      },
      {
        kind: "contrast",
        eyebrow: "What changes",
        title: "From guesswork to a daily picture",
        before: [
          "Stock counted only when something is missing",
          "Debtors kept in a notebook",
          "Branch sales reported by phone",
        ],
        after: [
          "Stock levels move with every sale and delivery",
          "Balances and statements for every customer",
          "Every branch visible on one dashboard",
        ],
      },
    ],
    roles: [
      { role: "Owner", does: "Everything, including reports across branches" },
      { role: "Branch manager", does: "Their branch's sales, stock and staff" },
      { role: "Sales staff", does: "Sales and receipts only" },
      { role: "Accounts", does: "Expenses, payments and reconciliation" },
    ],
    integrations: {
      items: [
        "Mobile money references",
        "Accounting exports",
        "Excel and CSV",
        "POS at the counter",
      ],
      note: "Payment and accounting connections depend on the providers you use and are scoped per project.",
    },
    data: [
      "Staff see only their branch and their tasks",
      "Deleted or edited transactions leave a trace",
      "Daily backups, with the schedule agreed in writing",
    ],
    related: ["pos-retail", "analytics", "websites"],
  },

  {
    slug: "sacco",
    name: "SACCO and finance systems",
    summary:
      "Members, savings, loans and repayments with approvals and an audit trail.",
    headline: "Member savings and loans, with every shilling accounted for",
    lede: "Member records, savings and shares, loan applications, approvals, repayments, arrears and statements, with permissions and an audit trail designed in from the start.",
    cta: "Discuss a SACCO System",
    visual: "sacco",
    problem:
      "A SACCO runs on trust. Members need accurate statements, the board needs to see arrears early, and officers need to know that every change to a balance can be traced. Paper ledgers and general spreadsheets make all three harder than they should be.",
    blocks: [
      {
        kind: "workflow",
        eyebrow: "A loan, end to end",
        title: "From application to the last repayment",
        steps: [
          {
            title: "Application",
            text: "The member applies; eligibility is checked against savings and history.",
          },
          {
            title: "Guarantors",
            text: "Guarantors recorded and their exposure checked, where your policy uses them.",
          },
          {
            title: "Approval",
            text: "Committee or officer approval, with maker-checker where scoped.",
          },
          {
            title: "Disbursement",
            text: "Recorded once, reflected in the member's statement.",
          },
          {
            title: "Repayment and arrears",
            text: "Schedules, reminders and arrears ageing that the board can see.",
          },
        ],
      },
      {
        kind: "modules",
        eyebrow: "Configurable modules",
        title: "Built around your by-laws",
        intro:
          "Products, interest methods and approval rules follow your SACCO's policies.",
        items: [
          {
            title: "Members",
            text: "Registration, next of kin and membership status.",
          },
          {
            title: "Savings and shares",
            text: "Deposits, withdrawals and share capital.",
          },
          {
            title: "Loans",
            text: "Products, schedules, penalties and top-ups.",
          },
          {
            title: "Statements",
            text: "Member statements on demand.",
          },
          {
            title: "Reports",
            text: "Portfolio, arrears and cash-flow summaries for the board.",
          },
        ],
      },
    ],
    roles: [
      { role: "Tellers", does: "Deposits, withdrawals and repayments" },
      { role: "Loan officers", does: "Applications and appraisals" },
      { role: "Credit committee", does: "Approvals and rejections" },
      { role: "Manager and board", does: "Reports and oversight" },
      { role: "Auditor", does: "Read-only access to transactions and logs" },
    ],
    integrations: {
      items: [
        "Mobile money collections",
        "SMS notifications",
        "Accounting exports",
        "Excel migration of existing records",
      ],
      note: "Mobile money and SMS connections depend on agreements with those providers.",
    },
    data: [
      "No single person can create and approve the same loan, where maker-checker is scoped",
      "Every balance change is traceable to a user and a time",
      "Members' personal details visible only to roles that need them",
      "This is a management system; it does not claim regulatory approval",
    ],
    related: ["business", "analytics", "custom-software"],
  },

  {
    slug: "education",
    name: "School management systems",
    summary: "Admissions, fees, attendance, exams and reports in one place.",
    headline: "School management from admission to report card",
    lede: "Admissions, fees, attendance, examinations and report cards in one system, with portals for parents and teachers where the school wants them.",
    cta: "Request a School System Demo",
    visual: "education",
    problem:
      "Schools lose hours every term to fee reconciliation, mark sheets and report cards assembled by hand. Parents call to ask balances; teachers re-enter the same marks twice. A school system should remove the re-typing and give the bursar and head teacher an accurate picture any day of the term.",
    blocks: [
      {
        kind: "modules",
        eyebrow: "Configurable modules",
        title: "The term, in one system",
        items: [
          {
            title: "Admissions",
            text: "Applications, enrolment and class allocation.",
          },
          {
            title: "Fees",
            text: "Fee structures, invoices, payments, balances and bursaries.",
          },
          {
            title: "Attendance",
            text: "Daily registers with absence follow-up.",
          },
          {
            title: "Examinations",
            text: "Mark entry, grading rules and positions.",
          },
          {
            title: "Report cards",
            text: "Generated from the marks, with comments.",
          },
          {
            title: "Portals",
            text: "Parent and teacher access, where scoped.",
          },
        ],
      },
      {
        kind: "questions",
        eyebrow: "Common questions",
        title: "What schools ask first",
        items: [
          {
            q: "Can it follow our grading system?",
            a: "Grading scales, subjects and report layouts are configured per school.",
          },
          {
            q: "Can parents pay by mobile money?",
            a: "Payments can be reconciled against mobile money references; direct collection depends on an agreement with the provider.",
          },
          {
            q: "What about our existing records?",
            a: "Student lists and balances can usually be imported from spreadsheets during setup.",
          },
        ],
      },
    ],
    roles: [
      { role: "Head teacher", does: "Whole-school overview and reports" },
      { role: "Bursar", does: "Fees, payments and balances" },
      { role: "Teachers", does: "Attendance and marks for their classes" },
      { role: "Parents", does: "Their own children's balances and results" },
    ],
    integrations: {
      items: [
        "Mobile money references",
        "SMS to parents",
        "Excel imports",
        "Printable report cards",
      ],
      note: "Messaging and payment connections depend on the school's providers.",
    },
    data: [
      "Children's information visible only to staff who teach or support them",
      "Parents see only their own children",
      "Mark changes after approval are logged",
      "Demonstrations use invented students",
    ],
    related: ["analytics", "websites", "business"],
  },

  {
    slug: "pos-retail",
    name: "POS and retail",
    summary: "A fast counter, with stock and sales visible behind it.",
    headline: "A fast counter with the whole shop behind it",
    lede: "Point of sale that keeps the queue moving, and behind it the stock, customers, expenses and branch reports that tell the owner how the shop is really doing.",
    cta: "Discuss a POS",
    visual: "pos",
    problem:
      "At the counter, speed is everything. Behind the counter, the owner needs to know what sold, what is running out and whether the cash matches. A POS should do both without making the cashier's job harder.",
    blocks: [
      {
        kind: "workflow",
        eyebrow: "At the counter",
        title: "Scan, pay, print, done",
        steps: [
          {
            title: "Find the item",
            text: "Barcode, search or quick buttons for the items that sell most.",
          },
          {
            title: "Take payment",
            text: "Cash, mobile money reference or card terminal reference; split payments.",
          },
          {
            title: "Receipt",
            text: "Printed or sent, with your branding.",
          },
          {
            title: "Close the shift",
            text: "Cash counted against the system, differences recorded.",
          },
        ],
      },
      {
        kind: "modules",
        eyebrow: "Behind the counter",
        title: "What the owner sees",
        items: [
          {
            title: "Stock",
            text: "Levels, deliveries, transfers and low-stock alerts.",
          },
          {
            title: "Sales reports",
            text: "By day, item, cashier and branch.",
          },
          {
            title: "Customers",
            text: "Credit accounts and purchase history where used.",
          },
          {
            title: "Expenses",
            text: "Shop spending recorded against the day's takings.",
          },
        ],
      },
    ],
    roles: [
      { role: "Cashier", does: "Sales and receipts" },
      { role: "Supervisor", does: "Voids, refunds and shift closing" },
      { role: "Stock keeper", does: "Deliveries, counts and transfers" },
      { role: "Owner", does: "Reports across shops" },
    ],
    integrations: {
      items: [
        "Barcode scanners",
        "Receipt printers",
        "Mobile money references",
        "Accounting exports",
      ],
      note: "Hardware compatibility is confirmed against the devices you use or plan to buy.",
    },
    data: [
      "Voids and refunds need a supervisor",
      "Every sale is tied to a cashier and a shift",
      "Offline selling where scoped, syncing when the connection returns",
    ],
    related: ["business", "digital-marketing", "websites"],
  },

  {
    slug: "websites",
    name: "Websites and digital platforms",
    summary: "Company sites, portals and web applications that do real work.",
    headline: "Websites that do a job, not just sit online",
    lede: "Company and institutional websites, online catalogues, portals and web applications, designed to be found, fast on a phone, and easy for your team to keep up to date.",
    cta: "Start a Web Project",
    visual: "web",
    problem:
      "Many websites are built once and forgotten: slow on phones, invisible on search, and out of date within months. A website should bring enquiries, answer the questions your team answers every day, and connect to the systems behind the business.",
    blocks: [
      {
        kind: "contrast",
        eyebrow: "What good looks like",
        title: "The standard we build to",
        before: [
          "Slow pages that lose mobile visitors",
          "Contact forms that go nowhere",
          "Content only the developer can change",
        ],
        after: [
          "Fast on a phone on a normal connection",
          "Enquiries stored and sent to the right person",
          "Content your team can update",
        ],
      },
      {
        kind: "modules",
        eyebrow: "What we build",
        title: "From a first website to a platform",
        items: [
          {
            title: "Company websites",
            text: "Clear, fast sites that explain what you do and bring enquiries.",
          },
          {
            title: "Institutional sites",
            text: "Structured content for schools, NGOs, facilities and associations.",
          },
          {
            title: "Catalogues and ordering",
            text: "Products with enquiry or order requests, and payment where scoped.",
          },
          {
            title: "Portals",
            text: "Logged-in areas for members, partners, staff or clients.",
          },
          {
            title: "Web applications",
            text: "Tools that run part of your operation in the browser.",
          },
        ],
      },
    ],
    roles: [
      { role: "Visitors", does: "Find you, understand you, contact you" },
      { role: "Your team", does: "Update content and answer enquiries" },
      {
        role: "Members or clients",
        does: "Use the portal, where there is one",
      },
    ],
    integrations: {
      items: [
        "Enquiry forms to email or WhatsApp",
        "Business and school systems",
        "Analytics without invasive tracking",
        "Payment providers where scoped",
      ],
      note: "Third-party services are chosen with you and paid for in your name.",
    },
    data: [
      "HTTPS everywhere, with secrets kept on the server",
      "Forms validated on the server and protected against spam",
      "Only the personal data an enquiry needs",
    ],
    related: ["digital-marketing", "business", "custom-software"],
  },

  {
    slug: "digital-marketing",
    name: "Digital marketing",
    summary:
      "For new businesses: get found, look credible online, turn attention into enquiries.",
    headline: "Digital marketing for businesses that have just opened",
    lede: "A new business needs to be found before it can be chosen. We set up the digital side: the profiles, the content and the campaigns that bring the first customers through the door.",
    cta: "Plan Your Launch",
    visual: "marketing",
    problem:
      "A new business has a name, a sign and a lot of hope, but no reviews, no followers and no search presence. Money spent on advertising before the basics are in place is mostly wasted. The first job is to be findable and credible; the second is to reach the right people consistently.",
    blocks: [
      {
        kind: "workflow",
        eyebrow: "From opening day",
        title: "Set up, then grow",
        steps: [
          {
            title: "Get found",
            text: "Business profiles on search and maps, with correct hours, location and photos.",
          },
          {
            title: "Look credible",
            text: "Social profiles and a simple website that match the identity Motion Imprints produced.",
          },
          {
            title: "Publish consistently",
            text: "A content plan and a calendar your team can actually keep.",
          },
          {
            title: "Reach people",
            text: "Targeted campaigns on the platforms your customers use, with a budget you control.",
          },
          {
            title: "Learn and adjust",
            text: "Monthly review of what brought enquiries, and what to change.",
          },
        ],
      },
      {
        kind: "modules",
        eyebrow: "What we do",
        title: "Services for a first year",
        items: [
          {
            title: "Profiles and listings",
            text: "Search, maps and social profiles set up and completed properly.",
          },
          {
            title: "Content",
            text: "Photos, graphics and posts in your brand, ready for every channel.",
          },
          {
            title: "Campaigns",
            text: "Paid social and search campaigns planned around a clear goal.",
          },
          {
            title: "Enquiry handling",
            text: "WhatsApp and website enquiries routed so none are missed.",
          },
          {
            title: "Reporting",
            text: "Plain monthly reports: spend, reach and enquiries.",
          },
        ],
      },
      {
        kind: "questions",
        eyebrow: "Straight answers",
        title: "What new owners ask",
        items: [
          {
            q: "How much should we spend on ads?",
            a: "It depends on the business and the goal. We agree a budget with you, you pay the platforms directly, and nothing is spent without your approval.",
          },
          {
            q: "Can you guarantee results?",
            a: "No one honestly can. We commit to a plan, clear reporting and adjusting based on what the numbers show.",
          },
          {
            q: "Do we need a website first?",
            a: "Not always. Many businesses start with complete profiles and WhatsApp; a website follows when it will earn its keep.",
          },
        ],
      },
    ],
    roles: [
      { role: "Owner", does: "Approves plans, budgets and content" },
      { role: "Your staff", does: "Answer enquiries and share daily moments" },
      { role: "Motion team", does: "Plans, produces, runs and reports" },
    ],
    integrations: {
      items: [
        "Search and maps listings",
        "Social platforms",
        "WhatsApp Business",
        "Website enquiry forms",
      ],
      note: "Accounts are created in your business's name and remain yours.",
    },
    data: [
      "You own every account and page; we work with delegated access",
      "No purchased contact lists or unsolicited bulk messaging",
      "Reports show real platform figures, never inflated numbers",
    ],
    related: ["websites", "pos-retail", "business"],
  },

  {
    slug: "analytics",
    name: "Data, analytics and dashboards",
    summary:
      "Automated analysis, dashboards and reports built into the workflow.",
    headline: "Analysis built into the system, not bolted on at year end",
    lede: "Dashboards, automated summaries, indicators, trends, maps and data-quality flags that update as data arrives, with the statistical method stated and appropriate to the data.",
    cta: "Discuss an Analytics Solution",
    visual: "analytics",
    problem:
      "Organisations collect data diligently and then analyse it rarely. When analysis happens, it is a manual exercise that one person knows how to repeat. The better approach is to decide the questions up front and let the system calculate the answers every time new data arrives.",
    blocks: [
      {
        kind: "contrast",
        eyebrow: "What changes",
        title: "From a yearly exercise to a live picture",
        before: [
          "Analysis done once a year by one person",
          "Figures that differ between reports",
          "Definitions kept in someone's head",
        ],
        after: [
          "Indicators recalculated as data arrives",
          "One definition per indicator, written down",
          "Every figure traceable to its source records",
        ],
      },
      {
        kind: "modules",
        eyebrow: "What the system can calculate",
        title: "The questions, answered continuously",
        items: [
          {
            title: "Descriptive summaries",
            text: "Counts, proportions, rates and averages, with denominators shown.",
          },
          {
            title: "Targets and trends",
            text: "Progress against targets and change over time.",
          },
          {
            title: "Disaggregation",
            text: "By sex, age, location, site or any captured grouping.",
          },
          {
            title: "Maps",
            text: "Results by area where locations are recorded.",
          },
          {
            title: "Data-quality flags",
            text: "Missing values, outliers and inconsistencies highlighted for review.",
          },
          {
            title: "Automated reports",
            text: "Scheduled summaries sent to the people who need them.",
          },
        ],
      },
      {
        kind: "questions",
        eyebrow: "Method, stated plainly",
        title: "How we treat numbers",
        items: [
          {
            q: "Do you offer forecasting?",
            a: "Only where the data supports it and the method can be defended. Most organisations are better served first by accurate descriptive analysis.",
          },
          {
            q: "Can we see how a figure was calculated?",
            a: "Yes. Indicator definitions, numerators and denominators are documented in the system.",
          },
          {
            q: "Can analytics work with our existing data?",
            a: "Usually. Spreadsheets, databases and exports from survey tools can be brought in and cleaned.",
          },
        ],
      },
    ],
    roles: [
      { role: "Data officers", does: "Clean, review and publish data" },
      { role: "Managers", does: "Dashboards and scheduled reports" },
      { role: "Board and funders", does: "Summary views, read only" },
    ],
    integrations: {
      items: [
        "Existing databases",
        "Excel and CSV",
        "KoboToolbox and ODK",
        "DHIS2 where authorised",
        "Scheduled PDF and spreadsheet exports",
      ],
      note: "Data sources are connected with the owner's permission and credentials.",
    },
    data: [
      "Small groups suppressed in public views to protect individuals",
      "Access to record-level data limited by role",
      "Every published figure traceable to its source data",
    ],
    related: ["monitoring-evaluation", "health", "business"],
  },

  {
    slug: "custom-software",
    name: "Custom software and automation",
    summary: "For needs that do not fit a box: discovery, build, support.",
    headline: "When your process does not fit a box",
    lede: "Custom systems and automations for work no off-the-shelf product handles well, built through a disciplined process from discovery to support.",
    cta: "Discuss Your Requirements",
    visual: "custom",
    problem:
      "Some organisations have a process that is genuinely their own: an approval chain, a field operation, a reporting duty. Forcing it into generic software creates workarounds. Custom work makes sense when it is scoped carefully, built in stages and supported after launch.",
    blocks: [
      {
        kind: "workflow",
        eyebrow: "How a project runs",
        title: "Discovery to support, in stages",
        steps: [
          {
            title: "Discovery",
            text: "We map the current process, the people and the pain points.",
          },
          {
            title: "Prototype",
            text: "Clickable screens you can test before anything is built.",
          },
          {
            title: "Build in stages",
            text: "Working releases you can use and give feedback on.",
          },
          {
            title: "Integrate and test",
            text: "Connected to your other systems and tested with real scenarios.",
          },
          {
            title: "Train and launch",
            text: "Users trained on their own tasks; launch planned with you.",
          },
          {
            title: "Support",
            text: "Fixes, improvements and hosting under an agreed arrangement.",
          },
        ],
      },
      {
        kind: "modules",
        eyebrow: "Automation",
        title: "Remove the repetitive work",
        items: [
          {
            title: "Approvals",
            text: "Requests routed to the right person, with reminders.",
          },
          {
            title: "Scheduled reports",
            text: "Figures compiled and sent without anyone assembling them.",
          },
          {
            title: "Data movement",
            text: "Information copied between systems automatically, not re-typed.",
          },
          {
            title: "Notifications",
            text: "SMS, email or WhatsApp alerts when something needs attention.",
          },
        ],
      },
    ],
    roles: [
      {
        role: "Process owner",
        does: "Defines the requirement and accepts each stage",
      },
      { role: "Users", does: "Test prototypes and releases" },
      { role: "Motion team", does: "Designs, builds, tests and supports" },
    ],
    integrations: {
      items: [
        "REST APIs",
        "Existing databases",
        "Email, SMS and WhatsApp",
        "Excel and CSV",
      ],
      note: "Every connection is documented so it can be maintained later.",
    },
    data: [
      "Requirements and data flows written down before build",
      "Access designed by role from the first release",
      "Source code and documentation handed over as agreed",
    ],
    related: ["analytics", "business", "websites"],
  },
];

/** The device photograph that carries each solution's screen design. */
export const visualDevice: Record<VisualKey, string> = {
  health: "laptop-health",
  me: "laptop-me",
  business: "laptop-business",
  sacco: "laptop-sacco",
  education: "laptop-education",
  pos: "laptop-pos",
  web: "laptop-web",
  marketing: "laptop-marketing",
  analytics: "laptop-analytics",
  custom: "laptop-custom",
};

/** A photograph that sets the scene for each solution's page banner. */
export const bannerPhoto: Record<string, { img: string; position: string }> = {
  health: { img: "health", position: "50% 20%" },
  "monitoring-evaluation": { img: "data", position: "50% 45%" },
  business: { img: "retail", position: "60% 45%" },
  sacco: { img: "finance", position: "50% 55%" },
  education: { img: "education", position: "50% 45%" },
  "pos-retail": { img: "retail", position: "60% 45%" },
  websites: { img: "who-we-are", position: "50% 35%" },
  "digital-marketing": { img: "digital", position: "50% 25%" },
  analytics: { img: "data", position: "50% 45%" },
  "custom-software": { img: "approach", position: "50% 40%" },
};

export function getSolution(slug: string) {
  return solutions.find((s) => s.slug === slug) ?? null;
}

/** Groups for navigation and the solutions index. */
export const solutionGroups: { title: string; slugs: string[] }[] = [
  {
    title: "Sector systems",
    slugs: ["health", "monitoring-evaluation", "sacco", "education"],
  },
  { title: "Running a business", slugs: ["business", "pos-retail"] },
  { title: "Growing online", slugs: ["websites", "digital-marketing"] },
  { title: "Data and custom work", slugs: ["analytics", "custom-software"] },
];
