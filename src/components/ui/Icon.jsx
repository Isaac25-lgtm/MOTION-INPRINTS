/* Line icons drawn inline: no icon package, no emoji, one consistent 1.5px stroke.
   Icons appear only where they carry meaning that a word cannot carry more briefly. */

const paths = {
  arrowRight: 'M4 12h16M14 6l6 6-6 6',
  arrowLeft: 'M20 12H4M10 18l-6-6 6-6',
  arrowUpRight: 'M7 17 17 7M8 7h9v9',
  search: 'M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16ZM21 21l-4.35-4.35',
  account: 'M20 21a8 8 0 1 0-16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  cart: 'M3 4h2.5l2.2 11.2a1.6 1.6 0 0 0 1.6 1.3h8.4a1.6 1.6 0 0 0 1.6-1.3L21 7H6M9 21h.01M18 21h.01',
  menu: 'M3 6h18M3 12h18M3 18h18',
  close: 'M6 6l12 12M18 6 6 18',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  phone: 'M6.5 3h3l1.5 4-2 1.5a12 12 0 0 0 5.5 5.5L16 12l4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 3 6.2 2 2 0 0 1 5 4Z',
  whatsapp: 'M3.5 20.5 5 16a7.8 7.8 0 1 1 3 3Z',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  pin: 'M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11ZM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
  check: 'M4 12.5 9 17.5 20 6.5',
  chevronDown: 'M6 9l6 6 6-6',
}

export function Icon({ name, size = 20, className, ...rest }) {
  const d = paths[name]
  if (!d) return null
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...rest}
    >
      {d.split('M').filter(Boolean).map((segment, index) => <path key={index} d={`M${segment}`} />)}
    </svg>
  )
}

/* The inline arrow used by text buttons and hovered captions. */
export function Arrow({ size = 16 }) {
  return <Icon name="arrowRight" size={size} className="arrow" />
}
