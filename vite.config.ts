import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
  plugins: [
    {
      name: 'copy-assets',
      apply: 'build',
      async writeBundle() {
        const fs = await import('fs');
        const path = await import('path');
        
        const copyDir = (src: string, dest: string) => {
          fs.mkdirSync(dest, { recursive: true });
          const entries = fs.readdirSync(src, { withFileTypes: true });
          for (const entry of entries) {
            const srcPath = path.resolve(src, entry.name);
            const destPath = path.resolve(dest, entry.name);
            if (entry.isDirectory()) {
              copyDir(srcPath, destPath);
            } else {
              fs.copyFileSync(srcPath, destPath);
            }
          }
        };
        
        const srcDir = resolve(__dirname, 'src/assets/images');
        const destDir = resolve(__dirname, 'dist/assets/images');
        copyDir(srcDir, destDir);
      },
    },
  ],
});
