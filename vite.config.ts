import { defineConfig } from 'vite';

export default defineConfig({
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
