import Image from "next/image";
import Link from "next/link";
import { solutions } from "@/content/solutions";
import { contact } from "@/lib/contact";
import { site } from "@/lib/site";

export function Footer() {
  return (
    <footer className="site-footer dark">
      <div className="container">
        <div className="site-footer__top">
          <div className="site-footer__brand">
            <Image
              src="/brand/logo-trim.png"
              alt="Motion Imprints"
              width={1466}
              height={596}
            />
            <p className="site-footer__statement">
              {site.name}. {site.relationship}: systems, data and digital
              platforms built around real work.
            </p>
          </div>
          <nav aria-label="Solutions">
            <p className="site-footer__heading">Solutions</p>
            <ul>
              {solutions.map((s) => (
                <li key={s.slug}>
                  <Link href={`/solutions/${s.slug}`}>{s.name}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Company">
            <p className="site-footer__heading">Company</p>
            <ul>
              <li>
                <Link href="/about">About</Link>
              </li>
              <li>
                <Link href="/capabilities/integrations">Integrations</Link>
              </li>
              <li>
                <Link href="/capabilities/security">Security</Link>
              </li>
              <li>
                <Link href="/work">Work</Link>
              </li>
              <li>
                <Link href="/contact">Contact</Link>
              </li>
              <li>
                <Link href="/privacy">Privacy</Link>
              </li>
            </ul>
          </nav>
          <div>
            <p className="site-footer__heading">Contact</p>
            <ul>
              {contact.phone ? (
                <li>
                  <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}>
                    {contact.phone}
                  </a>
                </li>
              ) : null}
              {contact.email ? (
                <li>
                  <a href={`mailto:${contact.email}`}>{contact.email}</a>
                </li>
              ) : null}
              <li>
                <Link href="/contact">Send an inquiry</Link>
              </li>
            </ul>
            {contact.address ? (
              <p className="site-footer__statement">{contact.address}</p>
            ) : null}
            <p className="site-footer__heading" style={{ marginTop: 24 }}>
              Parent company
            </p>
            <a className="site-footer__parent" href={site.parentUrl}>
              {site.parentName} <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
        <div className="site-footer__legal">
          <p>
            © {new Date().getFullYear()} {site.name}. All rights reserved.
          </p>
          <p>
            Screens shown on devices are our designs with invented sample data.
          </p>
        </div>
      </div>
    </footer>
  );
}
