"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { primaryNav } from "@/lib/nav";

export function MobileNav() {
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
            <p className="kicker">Technologies</p>
            <button type="button" className="nav-toggle" onClick={closeMenu}>
              Close
            </button>
          </div>
          <Link
            className="btn btn--dark mobile-nav__cta"
            href="/contact"
            onClick={closeMenu}
          >
            Discuss a Project
          </Link>
          <nav aria-label="Primary">
            <ul>
              {primaryNav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} onClick={closeMenu}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </dialog>
    </>
  );
}
