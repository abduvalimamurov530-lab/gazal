import type { Config } from '@netlify/functions';
import { analyzeGhazal } from '../lib/ghazal-ai';

export default async (req: Request) => {
  const payload = await req.json().catch(() => null);
  const { status, body } = await analyzeGhazal(payload);
  return Response.json(body, { status });
};

export const config: Config = {
  path: '/api/analyze-ghazal',
  method: 'POST',
};
