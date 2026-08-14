import { Route, Routes } from 'react-router-dom'
import { AdminLayout, CustomerLayout, PublicLayout } from './layouts/Layouts'
import { RequireAdmin, RequireAuth } from './auth/RouteGuards'
import { PlaceholderPage } from './pages/PlaceholderPage'
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

/* Routes still awaiting their own phase keep the placeholder page. */
const publicPlaceholders = [
  ['/track-order', 'Track order'],
]
/* Legal pages render owner-published CMS content, or say plainly that it has not
   been published. Registered so the footer's links resolve rather than 404. */
const legalRoutes = [
  ['/privacy', 'Privacy policy', 'privacy'],
  ['/terms', 'Terms and conditions', 'terms'],
]
const customerRoutes = [
  ['/account', 'Account'], ['/account/orders', 'Orders'], ['/account/orders/:id', 'Order'],
  ['/account/profile', 'Profile'],
]
const adminRoutes = [
  ['/admin', 'Dashboard'], ['/admin/products', 'Products'], ['/admin/categories', 'Categories'],
  ['/admin/orders', 'Orders'], ['/admin/quotes', 'Quotes'], ['/admin/customers', 'Customers'],
  ['/admin/projects', 'Projects'], ['/admin/content', 'Content'], ['/admin/files', 'Files'],
  ['/admin/settings', 'Settings'],
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
        {publicPlaceholders.map(([path, title]) => (
          <Route key={path} path={path} element={<PlaceholderPage title={title} />} />
        ))}
        {legalRoutes.map(([path, title, section]) => (
          <Route key={path} path={path} element={<LegalPage title={title} section={section} />} />
        ))}
        {/* Internal only: absent from the production bundle. */}
        {import.meta.env.DEV && <Route path="/internal/style-preview" element={<StylePreviewPage />} />}
      </Route>

      <Route element={<RequireAuth><CustomerLayout /></RequireAuth>}>
        <Route path="/account/quotes" element={<AccountQuotesPage />} />
        <Route path="/account/quotes/:id" element={<QuoteViewPage account />} />
        {customerRoutes.map(([path, title]) => (
          <Route key={path} path={path} element={<PlaceholderPage title={title} />} />
        ))}
      </Route>

      <Route element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
        {adminRoutes.map(([path, title]) => (
          <Route key={path} path={path} element={<PlaceholderPage title={`Admin: ${title}`} />} />
        ))}
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
