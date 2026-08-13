import fs from 'node:fs';
import path from 'node:path';
import Ajv from 'ajv';
import { TEMPLATES_ROOT } from '../lib/copy-templates.js';

const BUNDLED_SCHEMA_PATH = path.join(TEMPLATES_ROOT, 'repo', 'feature_list.schema.json');

function loadSchema(repoRoot) {
  const repoSchemaPath = path.join(repoRoot, 'feature_list.schema.json');
  const schemaPath = fs.existsSync(repoSchemaPath) ? repoSchemaPath : BUNDLED_SCHEMA_PATH;
  return JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
}

// Runs the real JSON Schema (draft-07) over feature_list.json before any
// hand-written semantic validator sees it, so type/shape mistakes are caught
// with a precise instancePath instead of surfacing as a downstream crash or
// a vague "missing field" message.
export function validateSchema(data, repoRoot) {
  const schema = loadSchema(repoRoot);
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validateFn = ajv.compile(schema);
  const valid = validateFn(data);
  if (valid) return { ok: true, errors: [] };

  const errors = (validateFn.errors || []).map((e) => `${e.instancePath || '(root)'} ${e.message}`);
  return { ok: false, errors };
}
