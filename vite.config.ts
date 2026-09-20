import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa/dist/index.cjs'

export default defineConfig({
  base: '/mystickynote/',
  plugins: [react(), tailwindcss(), VitePWA({
    registerType: 'autoUpdate',

    manifest: {
      name: 'MyStickyNote',
      short_name: 'MyStickyNote',
      description: 'A simple sticky note application',
      theme_color: '#f7d77a',
      background_color: '#f7d77a',
      display: 'standalone',
      start_url: '/mystickynote/',
      scope: '/mystickynote/',
      icons: [
        {
          src: '/mystickynote/mystickynote_app_icon.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any maskable'
        },
        {
          src: '/mystickynote/mystickynote_app_icon.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any maskable'
        }
      ]
    }
  })],
})
