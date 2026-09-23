import { NotFoundBody } from "@/components/NotFoundBody";

/**
 * Not-found boundary for routes inside the (site) group. The group layout
 * already provides the header, main landmark and footer.
 */
export default function SiteNotFound() {
  return <NotFoundBody />;
}
