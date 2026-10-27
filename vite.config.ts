import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    host: true,
    port: 3000,
    strictPort: true,
    allowedHosts: true,
    watch: {
      ignored: ["**/backend/**"],
    },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-charts": ["chart.js", "vue-chartjs"],
          "vendor-pdf": ["jspdf", "html2canvas"],
        },
      },
    },
  },
})
