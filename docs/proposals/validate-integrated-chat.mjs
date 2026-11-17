import fs from 'node:fs/promises';
import { createRequire } from 'node:module';

// Reuse locked frontend dependencies; no installation or runtime writes.
const require = createRequire(new URL('../../frontend/package.json', import.meta.url));
const { default: openapiTS } = require('openapi-typescript');
const Ajv = require('ajv/dist/2020.js');
const addFormats = require('ajv-formats');
const spec = JSON.parse(await fs.readFile(new URL('./integrated-chat-openapi.json', import.meta.url)));
const fixtures = JSON.parse(await fs.readFile(new URL('./integrated-chat-fixtures.json', import.meta.url)));
const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addSchema({ $id: 'chat', components: spec.components });
for (const name of Object.keys(spec.components.schemas)) ajv.compile({ $ref: `chat#/components/schemas/${name}` });
for (const { schema, value } of fixtures) {
  const validate = ajv.compile({ $ref: `chat#/components/schemas/${schema}` });
  if (!validate(value)) throw new Error(`${schema}: ${JSON.stringify(validate.errors)}`);
}
const invalid = [
  ['SendMessage', { clientMessageId: 'bad', bindingId: 'bad', content: '' }],
  ['ApprovalDecision', { decision: 'accept_all' }],
  ['ChatEvent', { type: 'unknown', schemaVersion: 1 }],
];
for (const [schema, value] of invalid) {
  const validate = ajv.compile({ $ref: `chat#/components/schemas/${schema}` });
  if (validate(value)) throw new Error(`Invalid fixture accepted: ${schema}`);
}
const ast = await openapiTS(spec);
if (!ast.length) throw new Error('TypeScript generation produced no declarations');
console.log(`PASS: ${Object.keys(spec.paths).length} paths; ${Object.keys(spec.components.schemas).length} schemas; ${fixtures.length} valid and ${invalid.length} invalid fixtures; TypeScript generation.`);
