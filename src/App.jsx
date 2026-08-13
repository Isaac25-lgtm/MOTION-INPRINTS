import { Route, Routes } from 'react-router-dom'
import { AdminLayout, CustomerLayout, PublicLayout } from './layouts/Layouts'
import { RequireAdmin, RequireAuth } from './auth/RouteGuards'
import { PlaceholderPage } from './pages/PlaceholderPage'
import { NotFoundPage } from './pages/NotFoundPage'

const publicRoutes = [
  ['/', 'Home'], ['/shop', 'Shop'], ['/shop/:category', 'Shop category'],
  ['/product/:slug', 'Product'], ['/services', 'Services'], ['/services/:slug', 'Service'],
  ['/work', 'Work'], ['/work/:slug', 'Project'], ['/custom-project', 'Custom project'],
  ['/quote', 'Quote request'], ['/cart', 'Cart'], ['/checkout', 'Checkout'],
  ['/track-order', 'Track order'], ['/about', 'About'], ['/contact', 'Contact'],
]
const customerRoutes = [
  ['/account', 'Account'], ['/account/orders', 'Orders'], ['/account/orders/:id', 'Order'],
  ['/account/quotes', 'Quotes'], ['/account/profile', 'Profile'],
]
const adminRoutes = [
  ['/admin', 'Dashboard'], ['/admin/products', 'Products'], ['/admin/categories', 'Categories'],
  ['/admin/orders', 'Orders'], ['/admin/quotes', 'Quotes'], ['/admin/customers', 'Customers'],
  ['/admin/projects', 'Projects'], ['/admin/content', 'Content'], ['/admin/files', 'Files'],
  ['/admin/settings', 'Settings'],
]

export function App() {
  return <Routes>
    <Route element={<PublicLayout />}>
      {publicRoutes.map(([path, title]) => <Route key={path} path={path} element={<PlaceholderPage title={title} />} />)}
    </Route>
    <Route element={<RequireAuth><CustomerLayout /></RequireAuth>}>
      {customerRoutes.map(([path, title]) => <Route key={path} path={path} element={<PlaceholderPage title={title} />} />)}
    </Route>
    <Route element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
      {adminRoutes.map(([path, title]) => <Route key={path} path={path} element={<PlaceholderPage title={`Admin: ${title}`} />} />)}
    </Route>
    <Route path="*" element={<NotFoundPage />} />
  </Routes>
}
