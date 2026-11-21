/** Gera openapi/v1.json a partir do contrato. Rode com: npm run openapi */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { REPO_ROOT } from '../config.ts';
import { buildInMemoryApp } from '../testing/inMemoryApp.ts';

export const OPENAPI_V1_PATH = resolve(REPO_ROOT, 'openapi/v1.json');

export async function renderOpenApiV1(): Promise<string> {
  const { app, close } = await buildInMemoryApp();
  try {
    return `${JSON.stringify(app.swagger(), null, 2)}\n`;
  } finally {
    await close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const json = await renderOpenApiV1();
  mkdirSync(dirname(OPENAPI_V1_PATH), { recursive: true });
  writeFileSync(OPENAPI_V1_PATH, json);
  console.log(`OpenAPI gravado em ${OPENAPI_V1_PATH}`);
}
