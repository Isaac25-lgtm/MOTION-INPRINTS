import { useState } from 'react'
import { Button, IconButton } from '../components/ui/Button'
import { Field, SelectField, ChoiceGroup, QuantityControl } from '../components/ui/Form'
import { Badge, ProductCard, ProjectCard, CategoryTile } from '../components/ui/Cards'
import { Frame, Figure, ImagePair, EditorialTrio } from '../components/ui/Media'
import { Price } from '../components/ui/Price'
import { EmptyState, ErrorState, LoadingState, SkeletonGrid } from '../components/ui/States'
import { Breadcrumbs, Pagination, Tabs, FilterBar } from '../components/ui/Navigation'
import { Drawer } from '../components/ui/Overlay'
import { Icon } from '../components/ui/Icon'

/* Internal reference for the design system. Registered only when
   import.meta.env.DEV is true, so it is absent from the production bundle and
   cannot be reached on Render. Sample records below are obviously synthetic and
   exist only to exercise components. */

const sampleProduct = { id: '1', slug: 'sample', name: 'Sample product', short_description: 'Short descriptor line', starting_price: 85000, currency: 'UGX', pricing_type: 'configurable' }
const quoteProduct = { id: '2', slug: 'sample-2', name: 'Quote-only product', short_description: 'Priced per job', pricing_type: 'quote_only', quote_required: true }
const sampleProject = { id: '1', slug: 'sample', title: 'Sample project', category_name: 'Signage', location: 'Kampala', completed_on: '2026-01-01' }
const sampleCategory = { id: '1', slug: 'signage', name: 'Signage' }

function Row({ title, note, children }) {
  return (
    <section className="section section--tight">
      <div className="section-head">
        <div className="section-head__text">
          <h2 className="t-h3">{title}</h2>
          {note && <p className="t-caption">{note}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

export function StylePreviewPage() {
  const [tab, setTab] = useState('one')
  const [filter, setFilter] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const [choice, setChoice] = useState('signage')
  const [drawer, setDrawer] = useState(false)

  return (
    <div className="container">
      <div className="page-head">
        <Badge tone="warning">Internal · development only</Badge>
        <h1 className="t-h1">Motion style preview</h1>
        <p className="t-body t-muted t-measure">
          Every type style, control and media treatment in one place. Not a customer route.
        </p>
      </div>

      <Row title="Typography">
        <div className="stack stack--lg">
          <p className="t-eyebrow">Eyebrow / kicker</p>
          <p className="t-display">Design. Print. Brand.</p>
          <h3 className="t-h1">Heading level one</h3>
          <h3 className="t-h2">Heading level two</h3>
          <h3 className="t-h3">Heading level three</h3>
          <h4 className="t-h4">Heading level four</h4>
          <p className="t-body-lg t-measure">Large body. Signage, commercial printing, promotional materials and branded apparel for businesses in Kampala.</p>
          <p className="t-body t-measure">Body. Keeping design, printing, fabrication and finishing together means quality and timing stay predictable.</p>
          <p className="t-body-sm t-measure">Small body, used for supporting detail and form hints.</p>
          <p className="t-caption">Caption — image credits and metadata.</p>
          <p className="t-editorial t-measure">Editorial serif, reserved for project captions and pull quotes.</p>
          <p className="t-meta">SKU MTN-0001 · Lead time 3–5 days</p>
        </div>
      </Row>

      <Row title="Buttons and links">
        <div className="stack stack--lg">
          <div className="cluster">
            <Button variant="primary">Primary action</Button>
            <Button variant="accent">Accent action</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="text" arrow>Text button</Button>
            <Button variant="primary" disabled>Disabled</Button>
          </div>
          <div className="cluster">
            <Button variant="primary" size="sm">Small primary</Button>
            <Button variant="secondary" size="sm">Small secondary</Button>
            <IconButton icon="search" label="Search" />
            <IconButton icon="cart" label="Cart" />
            <IconButton icon="menu" label="Menu" />
          </div>
          <p className="t-body">An inline <a className="link" href="#top">text link</a> inside a sentence.</p>
        </div>
      </Row>

      <Row title="Form fields">
        <div className="split">
          <div className="stack stack--lg">
            <Field label="Text field" placeholder="Placeholder" />
            <Field label="With hint" hint="Include sizes and quantities." optional />
            <Field label="With error" error="This field is required." defaultValue="" />
            <SelectField label="Select" options={[{ value: 'a', label: 'Option A' }, { value: 'b', label: 'Option B' }]} />
            <Field as="textarea" label="Textarea" placeholder="Describe the project" />
          </div>
          <div className="stack stack--lg">
            <QuantityControl value={quantity} onChange={setQuantity} />
            <ChoiceGroup
              legend="Choice group"
              name="preview-choice"
              value={choice}
              onChange={setChoice}
              options={[{ value: 'signage', label: 'Signage' }, { value: 'printing', label: 'Printing' }, { value: 'apparel', label: 'Apparel' }]}
            />
            <div className="cluster">
              <Badge>Default</Badge>
              <Badge tone="accent">In production</Badge>
              <Badge tone="success">Completed</Badge>
              <Badge tone="warning">Awaiting approval</Badge>
              <Badge tone="error">Cancelled</Badge>
            </div>
          </div>
        </div>
      </Row>

      <Row title="Navigation">
        <div className="stack stack--lg">
          <Breadcrumbs trail={[{ to: '/work', label: 'Our Work' }, { label: 'Project title' }]} />
          <Tabs tabs={[{ value: 'one', label: 'Overview' }, { value: 'two', label: 'Specifications' }]} value={tab} onChange={setTab} label="Preview tabs" />
          <FilterBar options={[{ value: null, label: 'All' }, { value: 'signage', label: 'Signage' }, { value: 'print', label: 'Print' }]} value={filter} onChange={setFilter} />
          <Pagination offset={0} limit={12} count={12} onChange={() => {}} />
          <div className="cluster">
            <Button variant="secondary" onClick={() => setDrawer(true)}>Open drawer</Button>
          </div>
        </div>
      </Row>

      <Row title="Price treatment" note="Quote-only items never display a number.">
        <div className="cluster" style={{ gap: 'var(--space-7)' }}>
          <Price amount={85000} pricingType="fixed" />
          <Price amount={85000} pricingType="configurable" />
          <Price pricingType="quote_only" quoteRequired />
        </div>
      </Row>

      <Row title="Image treatments" note="No source supplied, so each frame shows the development placeholder.">
        <div className="stack stack--lg">
          <div className="grid grid--trio">
            <Frame ratio="square" alt="Square" />
            <Frame ratio="portrait" alt="Portrait" />
            <Frame ratio="landscape" alt="Landscape" />
          </div>
          <Figure caption="Project caption set beneath the image" meta="Kampala · 2026">
            <Frame ratio="wide" alt="Wide" />
          </Figure>
          <ImagePair>
            <Frame ratio="landscape" alt="Pair left" />
            <Frame ratio="landscape" alt="Pair right" />
          </ImagePair>
          <EditorialTrio>
            <Frame ratio="portrait" alt="Trio one" />
            <Frame ratio="portrait" alt="Trio two" />
            <Frame ratio="portrait" alt="Trio three" />
          </EditorialTrio>
        </div>
      </Row>

      <Row title="Cards">
        <div className="grid grid--products">
          <ProductCard product={sampleProduct} />
          <ProductCard product={quoteProduct} />
          <ProjectCard project={sampleProject} />
          <CategoryTile category={sampleCategory} />
        </div>
      </Row>

      <Row title="States">
        <div className="stack stack--lg">
          <LoadingState />
          <SkeletonGrid count={4} />
          <EmptyState title="Nothing here yet" description="Empty states say so plainly rather than filling space with invented data." />
          <ErrorState description="Something went wrong loading this section." onRetry={() => {}} />
        </div>
      </Row>

      <Row title="Dividers and rhythm">
        <div className="stack stack--lg">
          <hr />
          <div className="detail-list">
            <div className="detail-list__row"><dt>Material</dt><dd>Acrylic</dd></div>
            <div className="detail-list__row"><dt>Finish</dt><dd>Matte</dd></div>
            <div className="detail-list__row"><dt>Installation</dt><dd>Included</dd></div>
          </div>
        </div>
      </Row>

      <Drawer open={drawer} onClose={() => setDrawer(false)} title="Drawer" footer={<Button variant="primary" block>Footer action</Button>}>
        <div className="stack">
          <p className="t-body">Drawer body content. Escape closes, focus is trapped and restored.</p>
          <Icon name="check" />
        </div>
      </Drawer>
    </div>
  )
}
