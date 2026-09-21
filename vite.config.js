import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const calendarHoverFix = {
  name: 'gg-calendar-hover-fix',
  transform(code, id) {
    if (!id.endsWith('/src/App.jsx')) return null

    const fixed = code.replace(
      /dayMatches\s*\.slice\(\s*0\s*,\s*3\s*\)/,
      'dayMatches'
    )

    return fixed === code ? null : { code: fixed, map: null }
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [calendarHoverFix, react()],
})
