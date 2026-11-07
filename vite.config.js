import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages project URL: https://nam4eb.github.io/sam-JQK/
// Can override base during build: VITE_BASE=/other-repo/ npm run build
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/sam-JQK/'
})
