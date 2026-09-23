import Link from "next/link";
import { primaryNav } from "@/lib/nav";
import { Logo } from "./Logo";
import { MobileNav } from "./MobileNav";
import { QuoteLink } from "./quote/QuoteLink";

export function Header() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Logo priority />
        <nav className="nav-desktop" aria-label="Primary">
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
        <div className="site-header__end">
          <QuoteLink />
          <Link className="btn btn--solid" href="/contact">
            Start a Project
          </Link>
          <MobileNav items={primaryNav} />
        </div>
      </div>
    </header>
  );
}
