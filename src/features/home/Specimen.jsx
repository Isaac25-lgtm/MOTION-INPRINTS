/* Specimens — designed fields that stand in for photography.

   Motion has supplied no product or project photography yet, and the site is
   image-led. A grey box with a word under it made the catalogue look broken
   rather than new, so each category gets a composed print-specimen instead: a
   sample sheet from a printer's book.

   Everything here is drawn with solid colour, hairlines and type. No gradients,
   no blobs, no fabricated product images — nothing that could be mistaken for a
   photograph of Motion's work.

   The moment a real image exists it replaces the specimen entirely; these are a
   floor, not a design goal. */

/* Per-category treatment. Keyed to the real seeded slugs, with a neutral default
   so a category added later still renders sensibly rather than breaking.

   `mark` is a large cropped letterform — the print-studio convention of showing
   a typeface by its shapes. `cue` names the production detail drawn behind it. */
const TREATMENTS = {
  printing: { tone: 'ink', mark: 'P', cue: 'sheets' },
  signage: { tone: 'brand', mark: 'S', cue: 'panel' },
  'promotional-display': { tone: 'paper', mark: 'B', cue: 'banner' },
  apparel: { tone: 'deep', mark: 'A', cue: 'weave' },
  decor: { tone: 'paper', mark: 'D', cue: 'frame' },
  design: { tone: 'brand', mark: 'G', cue: 'registration' },
  'digital-solutions': { tone: 'ink', mark: 'W', cue: 'screen' },
}

const DEFAULT_TREATMENT = { tone: 'paper', mark: '·', cue: 'registration' }

/* Corner crop marks — the trim guides on a press sheet. Purely decorative, so
   hidden from assistive technology. */
function CropMarks() {
  return (
    <span className="specimen__crops" aria-hidden="true">
      <span /><span /><span /><span />
    </span>
  )
}

/* The production cue behind the letterform. Each is built from solid blocks and
   hairlines, so it reads as a material rather than as an illustration. */
function Cue({ kind }) {
  if (kind === 'sheets') {
    // Stacked sheet edges, as seen from the side of a print run.
    return <span className="specimen__cue specimen__cue--sheets" aria-hidden="true"><i /><i /><i /><i /></span>
  }
  if (kind === 'panel') {
    // A mounted sign face with its standoff fixings.
    return <span className="specimen__cue specimen__cue--panel" aria-hidden="true"><i /><i /></span>
  }
  if (kind === 'banner') {
    // Pull-up banner: a tall face on a base bar.
    return <span className="specimen__cue specimen__cue--banner" aria-hidden="true"><i /></span>
  }
  if (kind === 'weave') {
    // Garment weave, drawn as ruled threads rather than a texture image.
    return <span className="specimen__cue specimen__cue--weave" aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>
  }
  if (kind === 'frame') {
    // A mounted wall piece: outer frame, inner mount.
    return <span className="specimen__cue specimen__cue--frame" aria-hidden="true"><i /></span>
  }
  if (kind === 'screen') {
    // Desktop and mobile viewports side by side.
    return <span className="specimen__cue specimen__cue--screen" aria-hidden="true"><i /><i /></span>
  }
  // Registration target — the alignment mark on every colour separation.
  return <span className="specimen__cue specimen__cue--registration" aria-hidden="true"><i /><i /></span>
}

/**
 * A category specimen field.
 *
 * Decorative by design: the category name and descriptor are real text beside
 * it, so nothing here needs to be announced. The whole tile is one link, and
 * that link carries the accessible name.
 */
export function CategorySpecimen({ slug }) {
  const treatment = TREATMENTS[slug] || DEFAULT_TREATMENT
  return (
    <span className={`specimen specimen--${treatment.tone}`} aria-hidden="true">
      <CropMarks />
      <Cue kind={treatment.cue} />
      <span className="specimen__mark">{treatment.mark}</span>
    </span>
  )
}

/**
 * The hero field, shown only while no CMS photograph exists.
 *
 * Deliberately does NOT describe itself as a photograph of Motion's work — that
 * would be a false statement to anyone using a screen reader, and the point of
 * the placeholder system is that development media can never pass as real. It
 * announces itself as a placeholder and says what will replace it.
 */
export function HeroSpecimen() {
  return (
    <div
      className="hero-specimen"
      role="img"
      aria-label="Placeholder: Motion's own photography will appear here once supplied."
    >
      <span className="specimen__crops" aria-hidden="true"><span /><span /><span /><span /></span>

      {/* A press colour bar — the strip printers use to check ink density.
          Solid swatches from the brand ramp, no gradient. */}
      <span className="hero-specimen__bar" aria-hidden="true">
        <i /><i /><i /><i /><i />
      </span>

      <span className="hero-specimen__body" aria-hidden="true">
        <span className="hero-specimen__eyebrow">Specimen</span>
        <span className="hero-specimen__type">Aa</span>
        <span className="hero-specimen__meta">Archivo · Motion Blue · UGX</span>
      </span>

      {/* Stated plainly, in the visual as well as to assistive technology. */}
      <span className="hero-specimen__note">
        Photography pending — this space is reserved for Motion's own work
      </span>
    </div>
  )
}
