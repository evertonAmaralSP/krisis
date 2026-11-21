import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { OPENAPI_V1_PATH, renderOpenApiV1 } from '../src/scripts/generate-openapi.ts';

describe('OpenAPI v1', () => {
  it('o arquivo versionado está em dia com o contrato (rode: npm run openapi)', async () => {
    expect(existsSync(OPENAPI_V1_PATH), 'openapi/v1.json não existe: rode npm run openapi').toBe(true);
    expect(readFileSync(OPENAPI_V1_PATH, 'utf8')).toBe(await renderOpenApiV1());
  });

  it('todas as rotas ficam sob /api/v1 e a documentação é pública', async () => {
    const spec = JSON.parse(await renderOpenApiV1());
    const paths = Object.keys(spec.paths);
    expect(paths.length).toBeGreaterThan(0);
    expect(paths.every((p) => p.startsWith('/api/v1/'))).toBe(true);
    expect(spec.components.schemas).toHaveProperty('Interview');
  });
});
