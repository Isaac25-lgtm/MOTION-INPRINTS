import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { NotFoundBody } from "@/components/NotFoundBody";
import "@/styles/pages.css";
import "@/styles/forms.css";

/** Root 404 for addresses outside the site shell: brings its own shell. */
export default function RootNotFound() {
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
