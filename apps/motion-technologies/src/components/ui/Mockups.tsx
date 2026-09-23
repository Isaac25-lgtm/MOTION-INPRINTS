/**
 * Original, code-native interface illustrations for Motion Imprints
 * Technologies. They are artwork, not screenshots of deployed systems:
 *
 * - every value, name and identifier is invented sample data;
 * - no client, facility, programme or real person is depicted;
 * - no third-party product interface is reproduced.
 *
 * They are rendered only on the development /screens page, captured, and
 * composited onto licensed device photographs by scripts/build-tech-assets.py.
 * Sizes are in em against a container-query font size, so a mock scales as
 * one picture.
 */
import type { CSSProperties, ReactNode } from "react";
import type { VisualKey } from "@/content/solutions";

function Window({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`ui-window ${className}`}>
      <div className="ui-window__bar">
        <i />
        <i />
        <i />
        <span>{title}</span>
      </div>
      <div className="ui-window__body">{children}</div>
    </div>
  );
}

function Side({ items, active }: { items: string[]; active: number }) {
  return (
    <ul className="ui-side">
      {items.map((item, i) => (
        <li key={item} className={i === active ? "is-active" : undefined}>
          {item}
        </li>
      ))}
    </ul>
  );
}

function Bars({
  values,
  max,
  highlight,
}: {
  values: number[];
  max: number;
  highlight?: number;
}) {
  return (
    <div className="ui-bars">
      {values.map((v, i) => (
        <i
          key={i}
          className={i === highlight ? "is-hi" : undefined}
          style={{ "--h": `${(v / max) * 100}%` } as CSSProperties}
        />
      ))}
    </div>
  );
}

function Line({
  points,
  target,
  flag,
}: {
  points: number[];
  target?: number;
  flag?: number;
}) {
  const w = 300;
  const h = 110;
  const max = Math.max(...points, target ?? 0) * 1.12;
  const x = (i: number) => (i / (points.length - 1)) * w;
  const y = (v: number) => h - (v / max) * h;
  const d = points.map((v, i) => `${i ? "L" : "M"}${x(i)} ${y(v)}`).join(" ");
  return (
    <svg
      className="ui-line"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
    >
      {target !== undefined ? (
        <line
          x1="0"
          x2={w}
          y1={y(target)}
          y2={y(target)}
          className="ui-line__target"
        />
      ) : null}
      <path d={`${d} L${w} ${h} L0 ${h} Z`} className="ui-line__area" />
      <path d={d} className="ui-line__path" />
      {flag !== undefined ? (
        <circle
          cx={x(flag)}
          cy={y(points[flag])}
          r="5"
          className="ui-line__flag"
        />
      ) : null}
    </svg>
  );
}

function Pill({ tone, children }: { tone: string; children: ReactNode }) {
  return <b className={`ui-pill ui-pill--${tone}`}>{children}</b>;
}

/* ---------------------------------------------------------------- health */

function HealthMock() {
  const queue = [
    ["A-014", "P-0412 · F · 34", "Consultation", "blue", "12 min"],
    ["A-015", "P-2290 · M · 7", "Triage", "cyan", "4 min"],
    ["A-016", "P-0877 · F · 61", "Laboratory", "amber", "25 min"],
    ["A-017", "P-3105 · M · 45", "Pharmacy", "green", "3 min"],
    ["A-018", "P-1932 · F · 28", "Registration", "grey", "1 min"],
  ];
  return (
    <Window title="Outpatient · Today" className="ui--health">
      <div className="ui-split">
        <Side
          items={[
            "Registration",
            "Queue",
            "Consultations",
            "Laboratory",
            "Pharmacy",
            "Reports",
          ]}
          active={1}
        />
        <div className="ui-main">
          <div className="ui-row ui-row--head">
            <span>Token</span>
            <span>Patient</span>
            <span>Stage</span>
            <span>Waiting</span>
          </div>
          {queue.map(([t, p, s, tone, w]) => (
            <div className="ui-row" key={t}>
              <span className="ui-mono">{t}</span>
              <span>{p}</span>
              <span>
                <Pill tone={tone}>{s}</Pill>
              </span>
              <span className="ui-mono">{w}</span>
            </div>
          ))}
        </div>
        <div className="ui-card ui-card--float">
          <p className="ui-k">Encounter · P-0412</p>
          <div className="ui-vitals">
            <span>
              BP <b>118/76</b>
            </span>
            <span>
              Temp <b>36.8°</b>
            </span>
            <span>
              Pulse <b>72</b>
            </span>
          </div>
          <p className="ui-k">Orders</p>
          <p className="ui-line-item">
            Full blood count <Pill tone="amber">Requested</Pill>
          </p>
          <p className="ui-line-item">
            Malaria RDT <Pill tone="green">Resulted</Pill>
          </p>
        </div>
      </div>
    </Window>
  );
}

/* -------------------------------------------------------------------- M&E */

function MeMock() {
  const rows = [
    ["1.1", "Households reached with safe water", 78, "ok"],
    ["1.2", "Water points functional at visit", 91, "ok"],
    ["2.1", "People trained in hygiene", 64, "warn"],
    ["2.3", "Schools with handwashing stations", 42, "flag"],
  ] as const;
  return (
    <Window title="Results framework · Q3" className="ui--me">
      <div className="ui-grid-2">
        <div className="ui-main">
          <div className="ui-row ui-row--head ui-row--me">
            <span>Code</span>
            <span>Indicator</span>
            <span>Target reached</span>
            <span>DQ</span>
          </div>
          {rows.map(([code, name, pct, dq]) => (
            <div className="ui-row ui-row--me" key={code}>
              <span className="ui-mono">{code}</span>
              <span>{name}</span>
              <span className="ui-progress">
                <i style={{ "--p": `${pct}%` } as CSSProperties} />
                <em>{pct}%</em>
              </span>
              <span>
                <b className={`ui-dot ui-dot--${dq}`} />
              </span>
            </div>
          ))}
        </div>
        <div className="ui-card">
          <p className="ui-k">Coverage by district</p>
          <div className="ui-map">
            {Array.from({ length: 24 }, (_, i) => (
              <i key={i} className={`ui-map__c ui-map__c--${(i * 7) % 4}`} />
            ))}
          </div>
          <p className="ui-note">3 records awaiting review</p>
        </div>
      </div>
    </Window>
  );
}

/* --------------------------------------------------------------- business */

function BusinessMock() {
  return (
    <Window title="Owner dashboard" className="ui--business">
      <div className="ui-tiles">
        <div className="ui-tile">
          <p className="ui-k">Sales today</p>
          <p className="ui-big">2,480,000</p>
          <p className="ui-sub">UGX · 3 branches</p>
        </div>
        <div className="ui-tile">
          <p className="ui-k">Stock value</p>
          <p className="ui-big">41.2M</p>
          <p className="ui-sub">UGX · 612 items</p>
        </div>
        <div className="ui-tile">
          <p className="ui-k">Debtors</p>
          <p className="ui-big">14</p>
          <p className="ui-sub">5 overdue</p>
        </div>
      </div>
      <div className="ui-grid-2">
        <div className="ui-card">
          <p className="ui-k">Sales by branch · last 7 days</p>
          <Bars values={[42, 58, 51, 66, 72, 61, 80]} max={90} highlight={6} />
        </div>
        <div className="ui-card">
          <p className="ui-k">Low stock</p>
          {[
            ["Cooking oil 3L", "8 left"],
            ["Sugar 1kg", "12 left"],
            ["Exercise books", "20 left"],
          ].map(([item, left]) => (
            <p className="ui-line-item" key={item}>
              {item} <Pill tone="amber">{left}</Pill>
            </p>
          ))}
        </div>
      </div>
    </Window>
  );
}

/* ------------------------------------------------------------------ SACCO */

function SaccoMock() {
  const cols = [
    ["Applied", ["L-2231 · 1.5M", "L-2234 · 800K", "L-2238 · 3.0M"]],
    ["Appraisal", ["L-2226 · 2.0M", "L-2229 · 600K"]],
    ["Approval", ["L-2219 · 4.5M"]],
    ["Disbursed", ["L-2210 · 1.2M", "L-2214 · 900K"]],
  ] as const;
  return (
    <Window title="Loans pipeline" className="ui--sacco">
      <div className="ui-kanban">
        {cols.map(([name, cards]) => (
          <div className="ui-kanban__col" key={name}>
            <p className="ui-k">
              {name} <em>{cards.length}</em>
            </p>
            {cards.map((c) => (
              <div className="ui-kanban__card" key={c}>
                <span className="ui-mono">{c.split(" · ")[0]}</span>
                <span>UGX {c.split(" · ")[1]}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="ui-card ui-audit">
        <p className="ui-k">L-2219 · approval trail</p>
        <p>
          <span className="ui-mono">09:14</span> Created by Officer A
        </p>
        <p>
          <span className="ui-mono">11:02</span> Guarantors verified
        </p>
        <p>
          <span className="ui-mono">14:30</span> Awaiting checker: Manager
        </p>
      </div>
    </Window>
  );
}

/* -------------------------------------------------------------- education */

function EducationMock() {
  return (
    <Window title="Term 2 · Fees and attendance" className="ui--education">
      <div className="ui-grid-2">
        <div className="ui-card">
          <p className="ui-k">Fees collected by class</p>
          <div className="ui-hbars">
            {[
              ["P.4", 86],
              ["P.5", 72],
              ["P.6", 91],
              ["P.7", 64],
              ["S.1", 58],
            ].map(([c, v]) => (
              <p key={c}>
                <span>{c}</span>
                <i style={{ "--p": `${v}%` } as CSSProperties} />
                <em>{v}%</em>
              </p>
            ))}
          </div>
        </div>
        <div className="ui-card">
          <p className="ui-k">Attendance · this week</p>
          <div className="ui-heat">
            {Array.from({ length: 35 }, (_, i) => (
              <i
                key={i}
                className={`ui-heat__c ui-heat__c--${(i * 5 + (i % 3)) % 4}`}
              />
            ))}
          </div>
          <p className="ui-note">Mon – Fri · 7 classes</p>
        </div>
      </div>
      <div className="ui-card ui-report">
        <p className="ui-k">Report card · Student S-1043</p>
        <div className="ui-report__grid">
          {[
            ["Mathematics", "78", "D2"],
            ["English", "71", "C3"],
            ["Science", "84", "D1"],
            ["Social Studies", "69", "C4"],
          ].map(([s, m, g]) => (
            <p key={s}>
              <span>{s}</span>
              <b className="ui-mono">{m}</b>
              <em>{g}</em>
            </p>
          ))}
        </div>
      </div>
    </Window>
  );
}

/* -------------------------------------------------------------------- POS */

function PosMock() {
  const items = [
    "Bread",
    "Milk 500ml",
    "Sugar 1kg",
    "Rice 2kg",
    "Soap bar",
    "Soda 500ml",
    "Eggs tray",
    "Tea leaves",
  ];
  return (
    <Window title="Counter 1 · Shift open" className="ui--pos">
      <div className="ui-pos">
        <div className="ui-pos__grid">
          {items.map((item, i) => (
            <div
              key={item}
              className={`ui-pos__item${i === 2 ? " is-hi" : ""}`}
            >
              {item}
            </div>
          ))}
        </div>
        <div className="ui-pos__cart">
          <p className="ui-k">Sale · #00482</p>
          {[
            ["Sugar 1kg × 2", "9,000"],
            ["Bread × 1", "4,500"],
            ["Milk 500ml × 3", "6,600"],
          ].map(([l, p]) => (
            <p className="ui-line-item" key={l}>
              {l} <span className="ui-mono">{p}</span>
            </p>
          ))}
          <p className="ui-total">
            Total <span className="ui-mono">UGX 20,100</span>
          </p>
          <div className="ui-pos__pay">
            <b>Cash</b>
            <b className="is-hi">Mobile money</b>
          </div>
        </div>
      </div>
    </Window>
  );
}

/* -------------------------------------------------------------------- web */

function WebMock() {
  return (
    <div className="ui-web">
      <Window title="yourbusiness.example" className="ui--web">
        <div className="ui-site">
          <div className="ui-site__nav">
            <b />
            <span />
            <span />
            <span />
            <i />
          </div>
          <div className="ui-site__hero">
            <div>
              <p className="ui-site__h">Fresh bakes, every morning</p>
              <p className="ui-site__p" />
              <p className="ui-site__p ui-site__p--short" />
              <b className="ui-site__btn">Order ahead</b>
            </div>
            <div className="ui-site__img" />
          </div>
          <div className="ui-site__cards">
            <i />
            <i />
            <i />
          </div>
        </div>
      </Window>
      <div className="ui-phone">
        <div className="ui-phone__screen">
          <div className="ui-site__img ui-site__img--phone" />
          <p className="ui-site__h ui-site__h--phone">Fresh bakes</p>
          <p className="ui-site__p" />
          <b className="ui-site__btn">WhatsApp us</b>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- marketing */

function MarketingMock() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const posts: Record<number, [string, string]> = {
    0: ["Opening week photos", "blue"],
    2: ["Meet the team", "cyan"],
    3: ["Offer: first order", "amber"],
    5: ["Customer moment", "green"],
  };
  return (
    <Window title="Launch plan · Week 1" className="ui--marketing">
      <div className="ui-cal">
        {days.map((d, i) => (
          <div className="ui-cal__day" key={d}>
            <p className="ui-k">{d}</p>
            {posts[i] ? <Pill tone={posts[i][1]}>{posts[i][0]}</Pill> : null}
          </div>
        ))}
      </div>
      <div className="ui-grid-2">
        <div className="ui-card">
          <p className="ui-k">Profiles set up</p>
          {["Search and maps listing", "Social pages", "WhatsApp Business"].map(
            (p) => (
              <p className="ui-line-item" key={p}>
                {p} <Pill tone="green">Done</Pill>
              </p>
            ),
          )}
        </div>
        <div className="ui-card">
          <p className="ui-k">From reach to enquiries</p>
          <div className="ui-funnel">
            <i style={{ "--w": "100%" } as CSSProperties}>Reached</i>
            <i style={{ "--w": "62%" } as CSSProperties}>Engaged</i>
            <i style={{ "--w": "28%" } as CSSProperties}>Enquired</i>
          </div>
        </div>
      </div>
    </Window>
  );
}

/* -------------------------------------------------------------- analytics */

function AnalyticsMock() {
  return (
    <Window title="Indicator trend · automated" className="ui--analytics">
      <div className="ui-grid-2 ui-grid-2--wide">
        <div className="ui-card">
          <p className="ui-k">
            Coverage, monthly <em className="ui-legend">— target</em>
          </p>
          <Line
            points={[41, 44, 47, 46, 52, 55, 38, 58, 61, 63, 66, 68]}
            target={65}
            flag={6}
          />
          <p className="ui-note">
            Month 7 flagged: value outside expected range
          </p>
        </div>
        <div className="ui-card">
          <p className="ui-k">Data quality</p>
          {[
            ["Missing age", "3", "amber"],
            ["Duplicate IDs", "0", "green"],
            ["Out of range", "1", "red"],
          ].map(([l, n, tone]) => (
            <p className="ui-line-item" key={l}>
              {l} <Pill tone={tone}>{n}</Pill>
            </p>
          ))}
          <p className="ui-k ui-k--gap">By sex</p>
          <Bars values={[54, 46]} max={60} highlight={0} />
        </div>
      </div>
    </Window>
  );
}

/* ----------------------------------------------------------------- custom */

function CustomMock() {
  const stages = ["Discovery", "Prototype", "Build", "Integrate", "Launch"];
  return (
    <Window title="Project board" className="ui--custom">
      <div className="ui-stages">
        {stages.map((s, i) => (
          <div
            key={s}
            className={`ui-stage${i < 2 ? " is-done" : i === 2 ? " is-now" : ""}`}
          >
            <b>{String(i + 1).padStart(2, "0")}</b>
            <span>{s}</span>
          </div>
        ))}
      </div>
      <div className="ui-grid-2">
        <div className="ui-card">
          <p className="ui-k">Approval flow · purchase request</p>
          <div className="ui-flow">
            <span>Request</span>
            <i />
            <span>Supervisor</span>
            <i />
            <span>Finance</span>
            <i />
            <span className="is-hi">Approved</span>
          </div>
        </div>
        <div className="ui-card">
          <p className="ui-k">Automations</p>
          {[
            ["Weekly report emailed", "Mon 08:00"],
            ["Reminder after 48h", "Active"],
            ["Sync to accounts", "Nightly"],
          ].map(([l, v]) => (
            <p className="ui-line-item" key={l}>
              {l} <span className="ui-mono">{v}</span>
            </p>
          ))}
        </div>
      </div>
    </Window>
  );
}

/* ----------------------------------------------------- integrations, security */

export function SecurityMock() {
  const roles = ["Clerk", "Officer", "Manager", "Auditor"];
  const perms = [
    ["Create record", [1, 1, 1, 0]],
    ["Approve", [0, 0, 1, 0]],
    ["Edit after approval", [0, 0, 0, 0]],
    ["View reports", [0, 1, 1, 1]],
    ["View audit log", [0, 0, 1, 1]],
  ] as const;
  return (
    <Window title="Roles and audit" className="ui--security">
      <div className="ui-matrix">
        <span />
        {roles.map((r) => (
          <span key={r} className="ui-k">
            {r}
          </span>
        ))}
        {perms.map(([p, row]) => (
          <div className="ui-matrix__row" key={p}>
            <span>{p}</span>
            {row.map((on, i) => (
              <b key={i} className={on ? "is-on" : "is-off"}>
                {on ? "✓" : "–"}
              </b>
            ))}
          </div>
        ))}
      </div>
      <div className="ui-card ui-audit">
        <p className="ui-k">Audit log</p>
        <p>
          <span className="ui-mono">10:41</span> Officer B updated record R-2207
        </p>
        <p>
          <span className="ui-mono">10:44</span> Manager approved R-2207
        </p>
        <p>
          <span className="ui-mono">10:52</span> Sign-in blocked: 5 failed
          attempts
        </p>
      </div>
    </Window>
  );
}

/* ----------------------------------------------------------- phone apps */

/** Field data collection on a phone (M&E). Invented sample data. */
export function PhoneFieldMock() {
  return (
    <div className="ui-app">
      <div className="ui-app__bar">
        <span>9:41</span>
        <b>Household visit</b>
        <span>2 / 5</span>
      </div>
      <div className="ui-app__progress">
        <i style={{ "--p": "40%" } as CSSProperties} />
      </div>
      <div className="ui-app__body">
        <p className="ui-k">Section B · Water access</p>
        <p className="ui-app__q">Main source of drinking water</p>
        {[
          "Piped into compound",
          "Protected borehole",
          "Unprotected well",
          "Surface water",
        ].map((o, i) => (
          <p key={o} className={`ui-app__opt${i === 1 ? " is-on" : ""}`}>
            <i />
            {o}
          </p>
        ))}
        <p className="ui-app__q">Minutes to collect water (round trip)</p>
        <p className="ui-app__input">25</p>
        <p className="ui-app__q">Household members</p>
        <div className="ui-app__steps">
          <b>−</b>
          <span>6</span>
          <b>+</b>
        </div>
        <p className="ui-app__gps">
          GPS captured · accuracy 4 m · saved offline
        </p>
      </div>
      <div className="ui-app__foot">
        <b>Back</b>
        <b className="is-hi">Next section</b>
      </div>
    </div>
  );
}

/** A shop owner's day on a phone (business / POS). Invented sample data. */
export function PhoneShopMock() {
  return (
    <div className="ui-app">
      <div className="ui-app__bar">
        <span>9:41</span>
        <b>Today</b>
        <span>3 shops</span>
      </div>
      <div className="ui-app__body">
        <p className="ui-k">Sales so far</p>
        <p className="ui-app__big">UGX 2,480,000</p>
        <p className="ui-app__delta">146 sales · 3 branches</p>
        <div className="ui-app__chart">
          <Bars
            values={[18, 26, 22, 35, 41, 38, 52, 47]}
            max={60}
            highlight={6}
          />
        </div>
        <p className="ui-k">Branches</p>
        {[
          ["Main street", "1,120,000"],
          ["Market branch", "860,000"],
          ["Station road", "500,000"],
        ].map(([b, v]) => (
          <p className="ui-line-item" key={b}>
            {b} <span className="ui-mono">{v}</span>
          </p>
        ))}
        <p className="ui-k ui-k--gap">Needs attention</p>
        <p className="ui-line-item">
          Cooking oil 3L <Pill tone="amber">8 left</Pill>
        </p>
        <p className="ui-line-item">
          Shift not closed <Pill tone="red">Market</Pill>
        </p>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- export */

const byKey: Record<VisualKey, () => React.JSX.Element> = {
  health: HealthMock,
  me: MeMock,
  business: BusinessMock,
  sacco: SaccoMock,
  education: EducationMock,
  pos: PosMock,
  web: WebMock,
  marketing: MarketingMock,
  analytics: AnalyticsMock,
  custom: CustomMock,
};

export function Mock({ visual }: { visual: VisualKey }) {
  const Component = byKey[visual];
  return <Component />;
}
