import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Fail the build itself, not just at runtime in the browser, if a
  // production build is missing the backend URL it needs to talk to.
  if (command === 'build' && !env.VITE_API_BASE_URL) {
    throw new Error(
      'VITE_API_BASE_URL must be set for production builds — set it in frontend/.env.production or as a build-time environment variable.',
    )
  }

  return {
    plugins: [react()],
  }
})
