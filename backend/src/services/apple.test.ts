import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';

import { verifyIdentityToken } from './apple';

describe('verifyIdentityToken', () => {
  let sign: (claims: { iss?: string; aud?: string; sub?: string; exp?: string }) => Promise<string>;
  let jwks: ReturnType<typeof createLocalJWKSet>;

  beforeAll(async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    jwks = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' }] });
    sign = ({ iss = 'https://appleid.apple.com', aud = 'vn.hoantien.app', sub = '001234.abcd', exp = '10m' }) =>
      new SignJWT({}).setProtectedHeader({ alg: 'RS256', kid: 'k1' }).setIssuer(iss).setAudience(aud).setSubject(sub).setIssuedAt().setExpirationTime(exp).sign(privateKey);
  });

  it('chấp nhận token hợp lệ và trả sub', async () => {
    expect(await verifyIdentityToken(await sign({}), jwks)).toEqual({ sub: '001234.abcd' });
  });

  it.each([
    ['sai audience (app khác)', { aud: 'com.other.app' }],
    ['sai issuer', { iss: 'https://evil.example' }],
    ['đã hết hạn', { exp: '-1m' }],
  ])('từ chối token %s', async (_, claims) => {
    await expect(verifyIdentityToken(await sign(claims), jwks)).rejects.toMatchObject({ status: 401 });
  });

  it('từ chối token ký bằng khoá khác', async () => {
    const other = await generateKeyPair('RS256');
    const forged = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer('https://appleid.apple.com')
      .setAudience('vn.hoantien.app')
      .setSubject('attacker')
      .setExpirationTime('10m')
      .sign(other.privateKey);
    await expect(verifyIdentityToken(forged, jwks)).rejects.toMatchObject({ status: 401 });
  });
});
