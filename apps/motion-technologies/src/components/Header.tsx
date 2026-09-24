import Link from "next/link";
import { primaryNav } from "@/lib/nav";
import { Brand } from "./Brand";
import { MobileNav } from "./MobileNav";

export function Header() {
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Brand priority />
        <nav className="nav-desktop" aria-label="Primary">
          <ul>
            {primaryNav.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="site-header__end">
          <Link className="btn btn--dark" href="/contact">
            Discuss a Project
          </Link>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
