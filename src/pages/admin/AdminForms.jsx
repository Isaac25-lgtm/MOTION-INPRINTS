import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Field, SelectField } from '../../components/ui/Form'
import { LoadingState, ErrorState } from '../../components/ui/States'
import { AdminNav } from './AdminPages'
import { useToast } from '../../components/ToastProvider'
import { useResource } from '../../hooks/useResource'
import { adminService } from '../../services/adminService'
import { categoryService } from '../../services/categoryService'

/* Create and edit screens for the catalogue and portfolio (Prompts 10.2, 10.5).
 *
 * Each form posts to an endpoint already guarded by `requireAdmin` and validated
 * by its Zod schema, so the browser is not the thing deciding what is allowed —
 * it decides only what is convenient to type. Server rejections are surfaced
 * field by field rather than as one opaque failure.
 *
 * Changing a price here never alters a past order or an accepted quote: those
 * hold their own snapshots, and the database refuses to change accepted figures. */

const slugify = (value) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function FormShell({ title, description, children }) {
  return (
    <div className="container container--wide">
      <div className="page-head">
        <h1 className="t-h2 page-head__title">{title}</h1>
        {description && <p className="t-body-sm t-muted t-measure">{description}</p>}
      </div>
      <AdminNav />
      <div className="section section--tight container--narrow" style={{ paddingInline: 0 }}>{children}</div>
    </div>
  )
}

/** Maps a server validation envelope onto per-field messages. */
const fieldErrors = (error) => (error?.details
  ? Object.fromEntries(Object.entries(error.details).map(([key, value]) => [key, Array.isArray(value) ? value[0] : String(value)]))
  : {})

export function AdminProductFormPage() {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const notify = useToast()
  const categories = useResource(({ signal }) => categoryService.list({ signal }), [])
  const existing = useResource(({ signal }) => adminService.products({ limit: 200 }, { signal }), [], { enabled: editing })

  const current = editing ? (existing.data || []).find(row => row.id === id) : null
  const [form, setForm] = useState(null)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  const values = form || {
    name: current?.name || '',
    slug: current?.slug || '',
    categoryId: current?.category_id || '',
    shortDescription: current?.short_description || '',
    description: current?.description || '',
    pricingType: current?.pricing_type || 'quote_only',
    startingPrice: current?.starting_price ?? '',
    isConfigurable: current?.is_configurable ?? false,
    status: current?.status || 'draft',
  }

  const set = (name) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
    setForm({ ...values, [name]: value, ...(name === 'name' && !editing && !values.slug ? { slug: slugify(value) } : {}) })
  }

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true); setErrors({})
    // quoteRequired must agree with pricingType; the database enforces the same
    // pairing, so deriving it here prevents a guaranteed rejection.
    const body = {
      name: values.name,
      slug: values.slug || slugify(values.name),
      categoryId: values.categoryId || null,
      shortDescription: values.shortDescription || null,
      description: values.description || null,
      pricingType: values.pricingType,
      startingPrice: values.pricingType === 'quote_only' ? null : (values.startingPrice === '' ? null : Number(values.startingPrice)),
      isConfigurable: Boolean(values.isConfigurable),
      quoteRequired: values.pricingType === 'quote_only',
      status: values.status,
    }
    try {
      if (editing) await adminService.updateProduct(id, body)
      else await adminService.createProduct(body)
      notify(editing ? 'Product updated.' : 'Product created.', 'success')
      navigate('/manager/products')
    } catch (error) {
      setErrors(fieldErrors(error))
      notify(error.message || 'That could not be saved.', 'error')
    } finally { setBusy(false) }
  }

  if (editing && existing.loading) return <FormShell title="Product"><LoadingState label="Loading product" /></FormShell>
  if (editing && !current && !existing.loading) return <FormShell title="Product"><ErrorState title="That product was not found" /></FormShell>

  return (
    <FormShell
      title={editing ? `Edit ${current?.name}` : 'New product'}
      description="Changing a price here never alters a past order or an accepted quote — both keep their own recorded figures."
    >
      <form className="stack stack--lg" onSubmit={submit} noValidate>
        <Field label="Product name" value={values.name} onChange={set('name')} error={errors.name} required />
        <Field label="Web address" hint="Lowercase words separated by hyphens." value={values.slug} onChange={set('slug')} error={errors.slug} required />
        <SelectField
          label="Category"
          value={values.categoryId}
          onChange={set('categoryId')}
          error={errors.categoryId}
          options={[{ value: '', label: 'No category' }, ...(categories.data || []).map(row => ({ value: row.id, label: row.name }))]}
        />
        <Field label="Short descriptor" hint="One line, shown under the name in listings." value={values.shortDescription} onChange={set('shortDescription')} optional />
        <Field as="textarea" label="Full description" value={values.description} onChange={set('description')} optional />

        <SelectField
          label="How is this priced?"
          value={values.pricingType}
          onChange={set('pricingType')}
          error={errors.pricingType}
          options={[
            { value: 'fixed', label: 'Fixed price' },
            { value: 'configurable', label: 'Configurable — price depends on options' },
            { value: 'quote_only', label: 'Quoted individually' },
          ]}
        />
        {values.pricingType !== 'quote_only' && (
          <Field
            label={values.pricingType === 'configurable' ? 'Starting price (UGX)' : 'Price (UGX)'}
            type="number" min="0" inputMode="numeric"
            value={values.startingPrice}
            onChange={set('startingPrice')}
            error={errors.startingPrice}
            hint="Whole shillings."
            required
          />
        )}

        <label className="choice">
          <input type="checkbox" checked={Boolean(values.isConfigurable)} onChange={set('isConfigurable')} />
          <span className="t-body-sm">Customers choose options for this product</span>
        </label>

        <SelectField
          label="Visibility"
          value={values.status}
          onChange={set('status')}
          options={[
            { value: 'draft', label: 'Draft — not on the site' },
            { value: 'published', label: 'Published — on the site' },
            { value: 'archived', label: 'Archived — withdrawn' },
          ]}
        />

        <div className="cluster">
          <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create product'}</Button>
          <Button to="/manager/products" variant="text">Cancel</Button>
        </div>
      </form>
    </FormShell>
  )
}

export function AdminCategoryFormPage() {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const notify = useToast()
  const categories = useResource(({ signal }) => adminService.categories({ signal }), [])
  const current = editing ? (categories.data || []).find(row => row.id === id) : null

  const [form, setForm] = useState(null)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  const values = form || {
    name: current?.name || '', slug: current?.slug || '', parentId: current?.parent_id || '',
    description: current?.description || '', sortOrder: current?.sort_order ?? 0, isPublished: current?.is_published ?? false,
  }
  const set = (name) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
    setForm({ ...values, [name]: value, ...(name === 'name' && !editing && !values.slug ? { slug: slugify(value) } : {}) })
  }

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true); setErrors({})
    const body = {
      name: values.name, slug: values.slug || slugify(values.name),
      parentId: values.parentId || null, description: values.description || null,
      sortOrder: Number(values.sortOrder) || 0, isPublished: Boolean(values.isPublished),
    }
    try {
      if (editing) await adminService.updateCategory(id, body)
      else await adminService.createCategory(body)
      notify(editing ? 'Category updated.' : 'Category created.', 'success')
      navigate('/manager/categories')
    } catch (error) {
      setErrors(fieldErrors(error)); notify(error.message || 'That could not be saved.', 'error')
    } finally { setBusy(false) }
  }

  return (
    <FormShell title={editing ? `Edit ${current?.name || 'category'}` : 'New category'}>
      <form className="stack stack--lg" onSubmit={submit} noValidate>
        <Field label="Category name" value={values.name} onChange={set('name')} error={errors.name} required />
        <Field label="Web address" value={values.slug} onChange={set('slug')} error={errors.slug} required />
        <SelectField
          label="Sits under"
          value={values.parentId}
          onChange={set('parentId')}
          options={[
            { value: '', label: 'Top level' },
            ...(categories.data || []).filter(row => !row.parent_id && row.id !== id).map(row => ({ value: row.id, label: row.name })),
          ]}
        />
        <Field as="textarea" label="Description" value={values.description} onChange={set('description')} optional />
        <Field label="Display order" type="number" min="0" value={values.sortOrder} onChange={set('sortOrder')} hint="Lower numbers appear first." />
        <label className="choice">
          <input type="checkbox" checked={Boolean(values.isPublished)} onChange={set('isPublished')} />
          <span className="t-body-sm">Show this category on the site</span>
        </label>
        <div className="cluster">
          <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create category'}</Button>
          <Button to="/manager/categories" variant="text">Cancel</Button>
        </div>
      </form>
    </FormShell>
  )
}

export function AdminProjectFormPage() {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const notify = useToast()
  const categories = useResource(({ signal }) => categoryService.list({ signal }), [])
  const projects = useResource(({ signal }) => adminService.projects({ limit: 200 }, { signal }), [], { enabled: editing })
  const current = editing ? (projects.data || []).find(row => row.id === id) : null

  const [form, setForm] = useState(null)
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  const values = form || {
    title: current?.title || '', slug: current?.slug || '', categoryId: current?.category_id || '',
    clientName: current?.client_name || '', location: current?.location || '',
    description: current?.description || '', completedOn: current?.completed_on?.slice(0, 10) || '',
    isFeatured: current?.is_featured ?? false, isPublished: current?.is_published ?? false,
  }
  const set = (name) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value
    setForm({ ...values, [name]: value, ...(name === 'title' && !editing && !values.slug ? { slug: slugify(value) } : {}) })
  }

  const submit = async (event) => {
    event.preventDefault()
    setBusy(true); setErrors({})
    const body = {
      title: values.title, slug: values.slug || slugify(values.title),
      categoryId: values.categoryId || null, clientName: values.clientName || null,
      location: values.location || null, description: values.description || null,
      completedOn: values.completedOn || null,
      isFeatured: Boolean(values.isFeatured), isPublished: Boolean(values.isPublished),
    }
    try {
      if (editing) await adminService.updateProject(id, body)
      else await adminService.createProject(body)
      notify(editing ? 'Project updated.' : 'Project created.', 'success')
      navigate('/manager/projects')
    } catch (error) {
      setErrors(fieldErrors(error)); notify(error.message || 'That could not be saved.', 'error')
    } finally { setBusy(false) }
  }

  return (
    <FormShell
      title={editing ? `Edit ${current?.title || 'project'}` : 'New project'}
      description="A client's name stays private unless you explicitly publish it."
    >
      <form className="stack stack--lg" onSubmit={submit} noValidate>
        <Field label="Project title" value={values.title} onChange={set('title')} error={errors.title} required />
        <Field label="Web address" value={values.slug} onChange={set('slug')} error={errors.slug} required />
        <SelectField
          label="Service"
          value={values.categoryId}
          onChange={set('categoryId')}
          options={[{ value: '', label: 'No service' }, ...(categories.data || []).map(row => ({ value: row.id, label: row.name }))]}
        />
        <Field label="Client" value={values.clientName} onChange={set('clientName')} optional hint="Recorded internally. It is only shown publicly if you turn that on separately." />
        <Field label="Location" value={values.location} onChange={set('location')} optional />
        <Field as="textarea" label="Description" value={values.description} onChange={set('description')} optional />
        <Field label="Completed on" type="date" value={values.completedOn} onChange={set('completedOn')} optional />
        <label className="choice">
          <input type="checkbox" checked={Boolean(values.isFeatured)} onChange={set('isFeatured')} />
          <span className="t-body-sm">Feature this project on the homepage</span>
        </label>
        <label className="choice">
          <input type="checkbox" checked={Boolean(values.isPublished)} onChange={set('isPublished')} />
          <span className="t-body-sm">Show this project on the site</span>
        </label>
        <div className="cluster">
          <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create project'}</Button>
          <Button to="/manager/projects" variant="text">Cancel</Button>
        </div>
      </form>
    </FormShell>
  )
}
