import { Link } from 'react-router-dom'
import { Arrow, Icon } from './Icon'

const variants = {
  primary: 'btn btn--primary',
  accent: 'btn btn--accent',
  secondary: 'btn btn--secondary',
  text: 'btn btn--text',
}

function classes({ variant = 'primary', size, block, className }) {
  return [variants[variant] || variants.primary, size === 'sm' && 'btn--sm', block && 'btn--block', className].filter(Boolean).join(' ')
}

/* Renders as <a>, <Link> or <button> depending on what it actually does.
   `arrow` appends the travelling arrow used by text buttons. */
export function Button({ to, href, variant, size, block, className, children, arrow, ...rest }) {
  const content = <>{children}{arrow && <Arrow />}</>
  const props = { className: classes({ variant, size, block, className }), ...rest }
  if (to) return <Link to={to} {...props}>{content}</Link>
  if (href) return <a href={href} {...props}>{content}</a>
  return <button type="button" {...props}>{content}</button>
}

export function IconButton({ icon, label, to, href, className, size = 20, children, ...rest }) {
  const props = { className: ['btn btn--icon', className].filter(Boolean).join(' '), 'aria-label': label, ...rest }
  const content = <>{icon && <Icon name={icon} size={size} />}{children}</>
  if (to) return <Link to={to} {...props}>{content}</Link>
  if (href) return <a href={href} {...props}>{content}</a>
  return <button type="button" {...props}>{content}</button>
}
