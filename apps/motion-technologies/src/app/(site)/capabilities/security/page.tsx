import type { Metadata } from "next";
import {
  Crumbs,
  CtaBand,
  NumberedTitle,
  PageBanner,
} from "@/components/Sections";
import { Img } from "@/components/media/Img";
import { device, photo } from "@/content/media";

const description =
  "The concrete security controls Motion Imprints Technologies designs into systems: roles, approvals, audit trails, encryption in transit, backups and careful handling of secrets.";

export const metadata: Metadata = {
  title: "Security",
  description,
  alternates: { canonical: "/capabilities/security" },
};

const controls = [
  {
    title: "Sign-in",
    text: "Individual accounts, strong password rules and lock-out after repeated failures. Two-factor sign-in where the project scopes it.",
  },
  {
    title: "Roles and permissions",
    text: "Each role sees and changes only what its work needs. Designed with you before the first release.",
  },
  {
    title: "Approvals",
    text: "A second person checks sensitive actions, such as loans, refunds or record changes, where the project scopes maker-checker.",
  },
  {
    title: "Audit trail",
    text: "Who created, changed or approved a record, and when, kept where the people it records cannot edit it.",
  },
  {
    title: "Encryption in transit",
    text: "HTTPS for every connection between users, the system and its database.",
  },
  {
    title: "Backups",
    text: "Automated backups on an agreed schedule, and a restore tested before launch.",
  },
  {
    title: "Least privilege",
    text: "Database and hosting accounts limited to what each part of the system needs.",
  },
  {
    title: "Secrets",
    text: "Passwords and keys kept in server configuration, never in code or in the browser.",
  },
  {
    title: "Safe demonstrations",
    text: "Demos and training use invented data, never real patients, members or students.",
  },
];

export default function SecurityPage() {
  return (
    <>
      <Crumbs items={[{ label: "Capabilities" }, { label: "Security" }]} />
      <PageBanner
        title="Security and control"
        lede="Security is a set of specific decisions about accounts, roles, approvals, records and backups. We make them with you at the start and write them down."
        img={photo("secure")}
        position="50% 35%"
      />

      <section className="section container intro" aria-labelledby="roles">
        <div className="intro__media">
          <Img
            img={device("laptop-security")}
            sizes="(min-width: 901px) 55vw, 100vw"
          />
        </div>
        <div className="intro__copy">
          <NumberedTitle n={1} id="roles">
            Roles and an audit trail you can read
          </NumberedTitle>
          <p>
            Who may create, approve or change a record is decided per role.
            Every change leaves a trace, and repeated failed sign-ins are
            blocked.
          </p>
          <p className="featured__note">
            On screen: our design, with invented sample data.
          </p>
        </div>
      </section>

      <section className="section container block" aria-labelledby="controls">
        <NumberedTitle n={2} id="controls">
          The controls we design in
        </NumberedTitle>
        <p className="kicker block__kicker">
          Scope-dependent controls are marked as such in every proposal
        </p>
        <ul className="modules">
          {controls.map((c) => (
            <li key={c.title}>
              <h3>{c.title}</h3>
              <p>{c.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="container mission" aria-labelledby="claims">
        <h2 id="claims" className="title">
          What we do not claim
        </h2>
        <p>
          We make no claim to ISO, SOC or similar certifications. Regulatory
          compliance depends on your obligations; we help you document how the
          system supports them. Security is shared: we build and host as agreed,
          and you manage who gets an account and the devices they use.
        </p>
      </section>

      <div style={{ height: "var(--section)" }} />
      <CtaBand
        title="Handling sensitive data?"
        text="Tell us what the system will hold and who will use it. We will propose controls to match, and say which ones are optional."
        img={photo("closing")}
        label="Discuss security needs"
      />
    </>
  );
}
