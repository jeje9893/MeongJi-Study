import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'child_process'

function getGitInfo() {
  try {
    const message = execSync('git log -1 --pretty=%s').toString().trim()
    const date = execSync('git log -1 --pretty=%cs').toString().trim()
    return JSON.stringify({ message, date })
  } catch {
    return JSON.stringify({ message: '', date: '' })
  }
}

export default defineConfig({
  define: {
    __GIT_INFO__: getGitInfo(),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '나만의 퀴즈',
        short_name: '퀴즈',
        description: '나만의 학습 퀴즈 앱',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      }
    })
  ],
})
