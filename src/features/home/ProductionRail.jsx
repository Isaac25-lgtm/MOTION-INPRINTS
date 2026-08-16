/* A narrow production rail between the header and the hero.
 *
 * The disciplines are STATIC. Nothing scrolls, nothing scrolls back. The only
 * thing that moves is a single small registration marker travelling left to
 * right, slowly, with a pause before it repeats — so the page is not perpetually
 * in motion in the corner of the eye.
 *
 * This is deliberately not a marquee. Text sliding across the top of a page
 * reads as a promotional ticker or a discount-store banner, which is the exact
 * register this site is trying not to occupy. Holding the words still and moving
 * one 6px mark keeps it a production reference rather than an advertisement.
 *
 * It is subordinate by construction: ~36px tall, caption-sized uppercase, warm
 * grey on paper. If it ever competes with "Design. Print. Brand." the fix is to
 * drop the marker, not to make the headline louder.
 *
 * Accessibility: the whole rail is decorative. The disciplines are already named
 * — as real links, with real descriptions — in the category section immediately
 * below, so announcing them here would duplicate content and add nothing. The
 * element is aria-hidden, which also keeps the moving marker unannounced.
 */

/* Every discipline carries a mark, so the row reads as a complete index rather
   than as four marked items and one that was forgotten. The last is a neutral
   stone rather than a fifth colour: four accents is already the whole palette,
   and another bright mark — blue least of all — would turn a quiet index into a
   row of dots competing with the headline. */
const DISCIPLINES = [
  { label: 'Signage', accent: 'terracotta' },
  { label: 'Commercial print', accent: 'blue' },
  { label: 'Apparel', accent: 'ochre' },
  { label: 'Display', accent: 'olive' },
  { label: 'Digital systems', accent: 'neutral' },
]

export function ProductionRail() {
  return (
    <div className="rail" aria-hidden="true">
      <div className="container rail__inner">
        <ul className="rail__list">
          {DISCIPLINES.map(({ label, accent }) => (
            <li className="rail__item" key={label}>
              <span className={`rail__mark rail__mark--${accent}`} />
              {label}
            </li>
          ))}
        </ul>
        {/* The one moving part. Absolutely positioned inside its own track, so
            it cannot shift a single pixel of layout as it travels. */}
        <div className="rail__track">
          <span className="rail__runner" />
        </div>
      </div>
    </div>
  )
}
