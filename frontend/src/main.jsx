import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ErrorBoundary from '@/components/ErrorBoundary'
import App from '@/App.jsx'
import '@/index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

// Tells the bootstrap guard in index.html that the app mounted, so its
// one-shot reload flag is cleared for next time.
window.dispatchEvent(new Event('planner:ready'))
