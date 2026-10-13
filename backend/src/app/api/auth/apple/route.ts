import { z } from 'zod';

import { json, readJson, route } from '@/lib/http';
import { signInWithApple } from '@/services/auth';

const Body = z.object({
  identityToken: z.string().min(1).max(4000),
  authorizationCode: z.string().max(1000).nullish(),
});

export const POST = route(async (req) => {
  const body = await readJson(req, Body);
  return json(await signInWithApple({ identityToken: body.identityToken, authorizationCode: body.authorizationCode ?? null }));
});
