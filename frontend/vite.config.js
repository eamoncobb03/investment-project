import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset paths (./assets/... instead of /assets/...) so the build
  // works both at its own root and proxied under a path prefix like
  // eamoncobb.com/investment-planner/, without needing to know that prefix
  // at build time or coordinate it with the destination deployment.
  base: './',
})
