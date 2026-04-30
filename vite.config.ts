import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    cors: true,
    headers: {
      'Cross-Origin-Resource-Policy': 'cross-origin',
    },
  },
  preview: {
    cors: true,
    headers: {
      'Cross-Origin-Resource-Policy': 'cross-origin',
    },
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: {
        main: 'index.html',
        modelPreview: 'model-preview.html',
      },
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
});
