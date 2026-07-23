import path from "path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isLib = mode === 'lib';
  return {
    base: './',
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    // `define` MUST be at the root (not nested in `build`) to avoid
    // "process is not defined" in the browser for the lib build.
    define: {
      __APP_VERSION__: JSON.stringify('0.1.0'),
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.env': '{}',
    },
    build: isLib ? {
      outDir: 'dist',
      lib: {
        entry: path.resolve(__dirname, 'src/main.tsx'),
        name: 'GamePool',
        formats: ['es'],
        fileName: () => 'index.js'
      },
      // The hub + each game's mount() load `./games/<key>/style.css`, so emit
      // the extracted stylesheet as `style.css` (instead of `<package-name>.css`).
      rollupOptions: {
        output: { assetFileNames: 'style.css' },
      },
    } : {
      outDir: 'dist'
    }
  }
})
