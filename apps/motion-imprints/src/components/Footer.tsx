import Link from "next/link";
import { primaryNav, services } from "@/lib/nav";
import { site } from "@/lib/site";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="site-footer on-dark">
      <div className="site-footer__grid">
        <div>
          <Logo variant="footer" />
          <p className="site-footer__statement">{site.description}</p>
        </div>
        <nav aria-label="Footer">
          <p className="site-footer__heading">Navigate</p>
          <ul>
            {primaryNav.map((item) => (
              <li key={item.href}>
                {item.external ? (
                  <a href={item.href}>
                    {item.label} <span aria-hidden="true">↗</span>
                  </a>
                ) : (
                  <Link href={item.href}>{item.label}</Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Services">
          <p className="site-footer__heading">Services</p>
          <ul>
            {services.map((item) => (
              <li key={item.slug}>
                <Link href={`/services/${item.slug}`}>{item.title}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <p className="site-footer__heading">Technologies</p>
          <a href={site.technologiesUrl}>
            {site.technologiesName} <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
      <p className="site-footer__legal">
        © {new Date().getFullYear()} {site.name} ·{" "}
        <Link href="/privacy">Privacy</Link>
      </p>
    </footer>
  );
}
