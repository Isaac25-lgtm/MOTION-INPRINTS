import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { AuthProvider } from './auth/AuthProvider'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ToastProvider } from './components/ToastProvider'
import { SiteContentProvider } from './content/SiteContentProvider'
import { CartProvider } from './features/cart/CartProvider'
import { assertRuntimeConfig } from './config/env'
import './styles.css'

assertRuntimeConfig()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <SiteContentProvider>
            <CartProvider>
              <BrowserRouter><App /></BrowserRouter>
            </CartProvider>
          </SiteContentProvider>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
)
