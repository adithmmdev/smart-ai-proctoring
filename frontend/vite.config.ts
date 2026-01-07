
  import { defineConfig } from 'vite';
  import react from '@vitejs/plugin-react-swc';
  import path from 'path';

  export default defineConfig({
    plugins: [react()],
    base: "/",   // 🔴 REQUIRED for Netlify
    resolve: {
      extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      target: 'esnext',
      outDir: 'dist',  // Changed from 'build' to 'dist' for Netlify
    },
    server: {
      port: 5173,
      open: true,
    },
  });