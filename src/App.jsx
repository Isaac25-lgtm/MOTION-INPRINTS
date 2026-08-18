import { Route, Routes, Navigate } from 'react-router-dom'
import { AdminLayout, CustomerLayout, PublicLayout } from './layouts/Layouts'
import { RequireOwner, RequireAuth } from './auth/RouteGuards'
import { NotFoundPage } from './pages/NotFoundPage'
import { HomePage } from './pages/HomePage'
import { ShopPage, ProductDetailPage } from './pages/ShopPage'
import { ServicesPage, ServiceDetailPage } from './pages/ServicesPage'
import { WorkPage, ProjectDetailPage } from './pages/WorkPage'
import { AboutPage } from './pages/AboutPage'
import { ContactPage } from './pages/ContactPage'
import { CustomProjectPage } from './pages/CustomProjectPage'
import { LegalPage } from './pages/LegalPage'
import { CartPage } from './pages/CartPage'
import { CheckoutPage, OrderConfirmedPage } from './pages/CheckoutPage'
import { QuoteViewPage } from './pages/QuoteViewPage'
import { AccountQuotesPage } from './pages/AccountQuotesPage'
import { StylePreviewPage } from './pages/StylePreviewPage'
import {
  AccountOverviewPage, AccountOrdersPage, AccountOrderDetailPage,
  AccountReorderPage, AccountProfilePage,
} from './pages/account/AccountPages'
import {
  AdminDashboardPage, AdminOrdersPage, AdminOrderDetailPage,
  AdminCustomersPage, AdminCustomerDetailPage, AdminReportsPage, AdminSectionPage,
} from './pages/admin/AdminPages'
import { adminService } from './services/adminService'
import { ManagerSignInPage } from './pages/ManagerSignInPage'
import { TrackOrderPage } from './pages/TrackOrderPage'
import { SignInPage, SignUpPage, ResetPasswordPage } from './pages/AuthPages'
import { AdminContentPage, AdminFilesPage, AdminSettingsPage } from './pages/admin/AdminManagePages'
import { AdminProductFormPage, AdminCategoryFormPage, AdminProjectFormPage } from './pages/admin/AdminForms'

/* Legal pages render owner-published CMS content, or say plainly that it has not
   been published. Registered so the footer's links resolve rather than 404. */
const legalRoutes = [
  ['/privacy', 'Privacy policy', 'privacy'],
  ['/terms', 'Terms and conditions', 'terms'],
]
/* Admin sections that are list views over an existing service. Kept declarative
   so each one is a data description rather than another near-identical page. */
const adminSections = [
  {
    path: '/manager/products', title: 'Products', description: 'Catalogue and pricing.',
    load: (options) => adminService.products({ limit: 100 }, options),
    columns: [{ key: 'name', label: 'Name' }, { key: 'slug', label: 'Slug' }, { key: 'status', label: 'Status' }],
    newPath: '/manager/products/new', editPath: (row) => `/manager/products/${row.id}/edit`,
  },
  {
    path: '/manager/categories', title: 'Categories', description: 'Service taxonomy and shop structure.',
    load: (options) => adminService.categories(options),
    columns: [{ key: 'name', label: 'Name' }, { key: 'slug', label: 'Slug' },
      { key: 'is_published', label: 'Published', render: (row) => (row.is_published ? 'Yes' : 'No') }],
    newPath: '/manager/categories/new', editPath: (row) => `/manager/categories/${row.id}/edit`,
  },
  {
    path: '/manager/quotes', title: 'Quotes', description: 'Quotation pipeline.',
    load: (options) => adminService.quotes({ limit: 100 }, options),
    columns: [{ key: 'request_number', label: 'Reference' }, { key: 'contact_name', label: 'Customer' },
      { key: 'status_code', label: 'Status' }],
  },
  {
    path: '/manager/projects', title: 'Work', description: 'Portfolio projects.',
    load: (options) => adminService.projects({ limit: 100 }, options),
    columns: [{ key: 'title', label: 'Title' }, { key: 'slug', label: 'Slug' },
      { key: 'is_published', label: 'Published', render: (row) => (row.is_published ? 'Yes' : 'No') }],
    newPath: '/manager/projects/new', editPath: (row) => `/manager/projects/${row.id}/edit`,
  },
]

export function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/shop" element={<ShopPage />} />
        <Route path="/shop/:category" element={<ShopPage />} />
        <Route path="/product/:slug" element={<ProductDetailPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/order-confirmed/:reference" element={<OrderConfirmedPage />} />
        <Route path="/quote/:id" element={<QuoteViewPage />} />
        <Route path="/services" element={<ServicesPage />} />
        <Route path="/services/:slug" element={<ServiceDetailPage />} />
        <Route path="/work" element={<WorkPage />} />
        <Route path="/work/:slug" element={<ProjectDetailPage />} />
        <Route path="/custom-project" element={<CustomProjectPage />} />
        <Route path="/quote" element={<CustomProjectPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/track-order" element={<TrackOrderPage />} />
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/sign-up" element={<SignUpPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        {legalRoutes.map(([path, title, section]) => (
          <Route key={path} path={path} element={<LegalPage title={title} section={section} />} />
        ))}
        {/* Internal only: absent from the production bundle. */}
        {import.meta.env.DEV && <Route path="/internal/style-preview" element={<StylePreviewPage />} />}
      </Route>

      <Route element={<RequireAuth><CustomerLayout /></RequireAuth>}>
        <Route path="/account" element={<AccountOverviewPage />} />
        <Route path="/account/orders" element={<AccountOrdersPage />} />
        <Route path="/account/orders/:id" element={<AccountOrderDetailPage />} />
        <Route path="/account/orders/:id/reorder" element={<AccountReorderPage />} />
        <Route path="/account/quotes" element={<AccountQuotesPage />} />
        <Route path="/account/quotes/:id" element={<QuoteViewPage account />} />
        <Route path="/account/profile" element={<AccountProfilePage />} />
      </Route>

      {/* Staff sign-in. Public by necessity — someone has to be able to reach it
          before they have a session — and unlinked by design. Obscurity is not
          the protection; every management API verifies session and role. */}
      <Route path="/manager" element={<ManagerSignInPage />} />

      {/* Compatibility only, for links that predate /manager. */}
      <Route path="/admin" element={<Navigate to="/manager/dashboard" replace />} />
      <Route path="/admin/*" element={<Navigate to="/manager/dashboard" replace />} />

      <Route element={<RequireOwner><AdminLayout /></RequireOwner>}>
        <Route path="/manager/dashboard" element={<AdminDashboardPage />} />
        <Route path="/manager/orders" element={<AdminOrdersPage />} />
        <Route path="/manager/orders/:id" element={<AdminOrderDetailPage />} />
        <Route path="/manager/customers" element={<AdminCustomersPage />} />
        <Route path="/manager/customers/:id" element={<AdminCustomerDetailPage />} />
        <Route path="/manager/reports" element={<AdminReportsPage />} />
        {adminSections.map(section => (
          <Route
            key={section.path}
            path={section.path}
            element={(
              <AdminSectionPage
                title={section.title}
                description={section.description}
                load={section.load}
                columns={section.columns}
                newPath={section.newPath}
                editPath={section.editPath}
              />
            )}
          />
        ))}
        <Route path="/manager/products/new" element={<AdminProductFormPage />} />
        <Route path="/manager/products/:id/edit" element={<AdminProductFormPage />} />
        <Route path="/manager/categories/new" element={<AdminCategoryFormPage />} />
        <Route path="/manager/categories/:id/edit" element={<AdminCategoryFormPage />} />
        <Route path="/manager/projects/new" element={<AdminProjectFormPage />} />
        <Route path="/manager/projects/:id/edit" element={<AdminProjectFormPage />} />
        <Route path="/manager/content" element={<AdminContentPage />} />
        <Route path="/manager/files" element={<AdminFilesPage />} />
        <Route path="/manager/settings" element={<AdminSettingsPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
