import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { apiPlugin } from './vite.apiPlugin'

export default defineConfig({
  plugins: [react(), apiPlugin()],
})
