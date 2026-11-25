import type { Config } from '@netlify/functions';
import { askScholar } from '../lib/ghazal-ai';

export default async (req: Request) => {
  const payload = await req.json().catch(() => null);
  const { status, body } = await askScholar(payload);
  return Response.json(body, { status });
};

export const config: Config = {
  path: '/api/ask-scholar',
  method: 'POST',
};
