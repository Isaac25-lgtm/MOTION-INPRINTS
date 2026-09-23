"use client";

import { useEffect } from "react";
import { captureLanding } from "./source";

/** Records the landing page's campaign tags once per visit. Renders nothing. */
export function LandingCapture() {
  useEffect(() => {
    captureLanding();
  }, []);
  return null;
}
