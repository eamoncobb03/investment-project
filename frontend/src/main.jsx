import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import ErrorBoundary from '@/components/ErrorBoundary'
import { TooltipProvider } from '@/components/ui/tooltip'
import App from '@/App.jsx'
import '@/index.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      {/* One provider for the whole app rather than one per tooltip: it is what
          shares open/close timing between them, so moving between two hints
          does not re-wait the full delay each time. */}
      <TooltipProvider delayDuration={120}>
        <App />
      </TooltipProvider>
    </ErrorBoundary>
  </StrictMode>,
)

// Tells the bootstrap guard in index.html that the app mounted, so its
// one-shot reload flag is cleared for next time.
window.dispatchEvent(new Event('planner:ready'))
