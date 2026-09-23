"use client";

/**
 * Attribution without tracking: the first landing page's UTM tags and
 * referrer are kept in sessionStorage for this visit only and sent with a
 * submission. No cookies, no third-party scripts, no identifiers.
 */
const KEY = "motion-tech-source-v1";

type Source = {
  path: string;
  referrer: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmTerm: string;
  utmContent: string;
};

export function captureLanding() {
  try {
    if (sessionStorage.getItem(KEY)) return;
    const q = new URLSearchParams(location.search);
    const external =
      document.referrer && new URL(document.referrer).host !== location.host
        ? document.referrer
        : "";
    const first: Omit<Source, "path"> = {
      referrer: external,
      utmSource: q.get("utm_source") ?? "",
      utmMedium: q.get("utm_medium") ?? "",
      utmCampaign: q.get("utm_campaign") ?? "",
      utmTerm: q.get("utm_term") ?? "",
      utmContent: q.get("utm_content") ?? "",
    };
    sessionStorage.setItem(KEY, JSON.stringify(first));
  } catch {
    // Storage blocked: attribution is simply absent.
  }
}

/** Attribution for a submission from the current page. */
export function currentSource(): Source {
  let first: Partial<Source> = {};
  try {
    first = JSON.parse(sessionStorage.getItem(KEY) ?? "{}");
  } catch {
    first = {};
  }
  return {
    path: location.pathname + location.search,
    referrer: first.referrer ?? "",
    utmSource: first.utmSource ?? "",
    utmMedium: first.utmMedium ?? "",
    utmCampaign: first.utmCampaign ?? "",
    utmTerm: first.utmTerm ?? "",
    utmContent: first.utmContent ?? "",
  };
}
