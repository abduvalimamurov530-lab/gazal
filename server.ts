// Local development server only. On Netlify, the /api/* routes are served by
// Netlify Functions in netlify/functions, which share the logic in netlify/lib/ghazal-ai.ts.
import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { analyzeGhazal, askScholar } from './netlify/lib/ghazal-ai';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

app.post('/api/analyze-ghazal', async (req, res) => {
  const { status, body } = await analyzeGhazal(req.body);
  res.status(status).json(body);
});

app.post('/api/ask-scholar', async (req, res) => {
  const { status, body } = await askScholar(req.body);
  res.status(status).json(body);
});

async function setupServer() {
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Gʻazalshunos serveri http://0.0.0.0:${PORT} da ishga tushdi`);
  });
}

setupServer();
