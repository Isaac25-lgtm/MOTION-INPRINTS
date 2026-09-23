"use client";

import { useSyncExternalStore } from "react";
import {
  CART_KEY,
  addLine,
  parseStored,
  removeLine,
  updateLine,
  type CartLine,
  type NewLine,
} from "@/lib/quote/cart";

/**
 * Browser store for the guest quote list, shared by every component on the
 * page and kept in sync across tabs through the storage event.
 */

const EMPTY: CartLine[] = [];
let cache: CartLine[] | null = null;
const listeners = new Set<() => void>();

function read(): CartLine[] {
  if (cache) return cache;
  try {
    cache = parseStored(window.localStorage.getItem(CART_KEY));
  } catch {
    cache = [];
  }
  return cache;
}

function write(lines: CartLine[]) {
  cache = lines;
  try {
    window.localStorage.setItem(CART_KEY, JSON.stringify(lines));
  } catch {
    // Storage full or blocked: the list still works for this page view.
  }
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === CART_KEY) {
      cache = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function makeId() {
  return crypto.randomUUID();
}

export const quoteList = {
  add: (line: NewLine) => write(addLine(read(), line, makeId)),
  update: (id: string, patch: Partial<Pick<CartLine, "quantity" | "notes">>) =>
    write(updateLine(read(), id, patch)),
  remove: (id: string) => write(removeLine(read(), id)),
  clear: () => write([]),
};

/** Lines in the quote list. Empty during server render and hydration. */
export function useQuoteList() {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
