import { Icon } from '../../components/ui/Icon'

/* Order timeline (Prompt 9.2).

   Renders only what has actually happened plus the immediate next stage. A stage
   the order has not reached carries no date, because inventing a completion date
   is worse than showing none — a customer will plan around it. */

const formatWhen = (value) => (value
  ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  : null)

export function OrderTimeline({ stages = [] }) {
  if (!stages.length) return null
  return (
    <ol className="timeline">
      {stages.map(stage => (
        <li key={stage.code} className={`timeline__item timeline__item--${stage.state}`}>
          <span className="timeline__marker" aria-hidden="true">
            {stage.state === 'done' && <Icon name="check" size={12} />}
          </span>
          <div className="timeline__body">
            <p className="timeline__label">
              {stage.label}
              {stage.state === 'current' && <span className="visually-hidden"> — current stage</span>}
            </p>
            {stage.state !== 'upcoming' && stage.description && (
              <p className="t-caption">{stage.description}</p>
            )}
            {stage.at && <p className="t-meta">{formatWhen(stage.at)}</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}

/* One clear next action, or nothing. Surfacing an action that does not apply is
   worse than surfacing none (Prompt 9.1). */
export const ACTION_LABELS = {
  pay: { label: 'Pay for this order', tone: 'warning' },
  upload_artwork: { label: 'Upload artwork', tone: 'warning' },
  review_proof: { label: 'Review the proof', tone: 'accent' },
  collect: { label: 'Ready for collection', tone: 'success' },
  review_quote: { label: 'Review quote', tone: 'accent' },
}
