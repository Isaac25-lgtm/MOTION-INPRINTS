export function PlaceholderPage({ title }) {
  return <section className="page-placeholder" aria-labelledby="page-title">
    <h1 id="page-title">{title}</h1>
    <p>This area is prepared for the next implementation phase.</p>
  </section>
}
