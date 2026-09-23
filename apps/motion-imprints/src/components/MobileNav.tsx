"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import type { NavItem } from "@/lib/nav";

type Props = {
  items: NavItem[];
};

export function MobileNav({ items }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  function openMenu() {
    dialogRef.current?.showModal();
    setOpen(true);
  }

  function closeMenu() {
    dialogRef.current?.close();
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        className="nav-toggle"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="mobile-menu"
        onClick={openMenu}
      >
        Menu
      </button>
      <dialog
        ref={dialogRef}
        id="mobile-menu"
        className="mobile-nav"
        aria-label="Menu"
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current) closeMenu();
        }}
      >
        <div className="mobile-nav__panel">
          <div className="mobile-nav__top">
            <p className="mobile-nav__label">Motion Imprints</p>
            <button type="button" className="nav-toggle" onClick={closeMenu}>
              Close
            </button>
          </div>
          {/* The header hides this action on phones, so the menu carries it. */}
          <Link
            className="btn btn--solid mobile-nav__cta"
            href="/contact"
            onClick={closeMenu}
          >
            Start a Project
          </Link>
          <nav aria-label="Primary">
            <ul>
              {items.map((item) => (
                <li key={item.href}>
                  {item.external ? (
                    <a href={item.href} onClick={closeMenu}>
                      {item.label} <span aria-hidden="true">↗</span>
                    </a>
                  ) : (
                    <Link href={item.href} onClick={closeMenu}>
                      {item.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </dialog>
    </>
  );
}
