import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const venueDir = path.resolve(
  process.env.MS_VENUE_IMAGES_DIR || '../monasterystays.app/public/images/venues',
);

const mime: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function venueImages(): Plugin {
  return {
    name: 'venue-images',
    configureServer(server) {
      server.middlewares.use('/images/venues', async (req, res, next) => {
        try {
          const pathname = decodeURIComponent((req.url || '').split('?')[0]);
          const slug = pathname.replace(/^\//, '').split('/').pop() || '';
          if (!slug) return next();
          for (const suffix of ['', '.jpg', '.png', '.jpeg', '.webp']) {
            const file = path.join(venueDir, slug + suffix);
            const data = await readFile(file).catch(() => null);
            if (data) {
              res.setHeader('Content-Type', mime[suffix] || 'image/jpeg');
              res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
              res.end(data);
              return;
            }
          }
          next();
        } catch {
          next();
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), venueImages()],
  server: {
    port: 3001,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: process.env.BACKEND_URL || 'http://localhost:8088',
        changeOrigin: false,
        ws: true,
      },
    },
  },
});