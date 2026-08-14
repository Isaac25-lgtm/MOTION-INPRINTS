/* Media art direction. Every image on the site goes through Frame, so ratio,
   lazy loading, decoding and placeholder behaviour stay consistent.

   No fabricated photography exists in this codebase. When an image is missing,
   Frame renders a hatched, dashed, labelled placeholder that could not be
   mistaken for Motion's work — that is the point of it. */

const ratios = {
  square: 'frame--square',
  portrait: 'frame--portrait',
  landscape: 'frame--landscape',
  wide: 'frame--wide',
  tall: 'frame--tall',
}

export function Frame({ src, alt = '', ratio = 'landscape', zoom = true, sharp, priority, label = 'Image pending', sizes, srcSet, className }) {
  const classNames = ['frame', ratios[ratio], zoom && src && 'frame--zoom', sharp && 'frame--sharp', !src && 'frame--placeholder', className].filter(Boolean).join(' ')
  if (!src) {
    return (
      <div className={classNames} role="img" aria-label={alt || label}>
        <span>{label}</span>
      </div>
    )
  }
  return (
    <div className={classNames}>
      <img
        src={src}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        /* Only the hero preloads; everything below the fold defers. */
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding={priority ? 'sync' : 'async'}
      />
    </div>
  )
}

/* A photograph with its caption set beneath it on the page — never typeset
   across the image, which is what makes overlay text unreadable. */
export function Figure({ children, caption, meta }) {
  return (
    <figure className="stack stack--sm">
      {children}
      {(caption || meta) && (
        <figcaption className="cluster" style={{ gap: 'var(--space-3)' }}>
          {caption && <span className="t-body-sm">{caption}</span>}
          {meta && <span className="t-meta">{meta}</span>}
        </figcaption>
      )}
    </figure>
  )
}

/* Two images side by side, equal weight. */
export function ImagePair({ children }) {
  return <div className="grid grid--pair">{children}</div>
}

/* Three-image editorial composition: the centre image drops to create a
   deliberate horizon break rather than a flat row of thirds. */
export function EditorialTrio({ children }) {
  return (
    <div className="grid grid--trio editorial-trio">{children}</div>
  )
}

/* Full-bleed band for installation photography. */
export function FullBleed({ children }) {
  return <div className="bleed">{children}</div>
}
