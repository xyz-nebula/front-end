import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import { App } from '@/App'
import { AuthProvider } from '@/auth/AuthContext'
import { DomainServicesProvider } from '@/services/DomainServicesContext'
import { ServiceAdaptersProvider } from '@/services/ServiceAdaptersContext'
import '@/styles/global.css'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element was not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <ServiceAdaptersProvider>
        <AuthProvider>
          <DomainServicesProvider>
            <App />
          </DomainServicesProvider>
        </AuthProvider>
      </ServiceAdaptersProvider>
    </BrowserRouter>
  </StrictMode>,
)
