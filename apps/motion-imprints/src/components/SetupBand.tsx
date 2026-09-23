import { site } from "@/lib/site";

const physical = [
  "Identity and logo",
  "Stationery and print",
  "Signage and fit-out graphics",
  "Packaging, uniforms and merchandise",
];

const digital = ["Business systems and POS", "Website", "Digital marketing"];

/**
 * The setup-to-growth story (owner decision OD-01): Motion Imprints sets a new
 * business up in the physical world, Motion Imprints Technologies sets up the
 * digital side. A contextual cross-link, not a competing service card.
 */
export function SetupBand() {
  return (
    <section className="setup-band" aria-labelledby="setup-band-title">
      <div className="container setup-band__inner">
        <div className="setup-band__intro">
          <p className="eyebrow">Starting a business?</p>
          <h2 id="setup-band-title" className="display">
            We set up the side customers can touch.
          </h2>
          <p>
            A new shop, office or product needs to look ready on the first day.
            Motion Imprints handles the physical setup, then{" "}
            {site.technologiesName} can take the same brand online.
          </p>
        </div>
        <ol className="setup-band__path">
          <li>
            <p className="setup-band__label">Motion Imprints</p>
            <ul>
              {physical.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </li>
          <li>
            <p className="setup-band__label">{site.technologiesName}</p>
            <ul>
              {digital.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <a className="textlink" href={site.technologiesUrl}>
              Visit Technologies <span aria-hidden="true">↗</span>
            </a>
          </li>
        </ol>
      </div>
    </section>
  );
}
