import process from 'node:process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

if (process.env.NODE_ENV === 'production' && process.env.VITE_E2E_TEST_AUTH_SECRET) {
  throw new Error('VITE_E2E_TEST_AUTH_SECRET must never be configured for a production build.')
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
})
