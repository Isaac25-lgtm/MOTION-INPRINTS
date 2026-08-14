import { Link } from 'react-router-dom'
import logoLockup from '../assets/motion-logo.png'
import logoWordmark from '../assets/motion-wordmark.png'

/* Motion's actual logo, reconstructed from the supplied `motion logo.pdf`
   (indexed-CMYK artwork plus its soft mask) so the badge gradient and letterforms
   are the original artwork rather than a redraw.

   Two crops:
   - `wordmark`  — "Motion" and the badge, used in the header where the strapline
                   would render around 6px tall and be illegible. The strapline is
                   set as live text beside it instead.
   - `lockup`    — the complete logo including DESIGN · PRINT · BRAND, used where
                   there is room for it to be read.

   Both carry transparency and are intended for light backgrounds. A knockout
   version is still needed before the logo is placed on a dark ground. */
export function Wordmark({ to = '/', variant = 'wordmark', showTagline = true }) {
  const lockup = variant === 'lockup'
  const source = lockup ? logoLockup : logoWordmark

  return (
    <Link to={to} className="wordmark" aria-label="Motion — Design, Print, Brand. Home">
      <img
        className={lockup ? 'wordmark__logo wordmark__logo--lockup' : 'wordmark__logo'}
        src={source}
        alt="Motion"
        width={lockup ? 720 : 560}
        height={lockup ? 293 : 197}
        decoding="async"
      />
      {!lockup && showTagline && <span className="wordmark__tag">Design · Print · Brand</span>}
    </Link>
  )
}
