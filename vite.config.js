import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves project sites from /PhianoSheets/, not the domain root.
// Keep the default root path for local development and future Netlify builds.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'pages' ? '/PhianoSheets/' : '/',
}));
