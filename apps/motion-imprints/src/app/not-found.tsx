import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { NotFoundBody } from "@/components/NotFoundBody";

/**
 * Root not-found: handles URLs that match no route at all. It renders outside
 * the (site) group, so it brings the site shell itself.
 */
export default function NotFound() {
  return (
    <>
      <Header />
      <main id="main" className="site-main">
        <NotFoundBody />
      </main>
      <Footer />
    </>
  );
}
