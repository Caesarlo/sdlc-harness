import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildTraceability } from '../../src/lib/traceability.js';
import { validateTraceability } from '../../src/validators/traceability.js';
import { archiveMilestone } from '../../src/lib/archive.js';

function writeProductDocs(dir, requirements, stories) {
  fs.mkdirSync(path.join(dir, 'docs', 'product'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'docs', 'product', 'requirements.md'), requirements);
  fs.writeFileSync(path.join(dir, 'docs', 'product', 'user-stories.md'), stories);
}

test('traceability computes the requirement to verification chain', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  writeProductDocs(
    dir,
    '## Functional Requirements\n- **FR-1**: WHEN asked, the system SHALL answer.\n',
    '## US-1: Answer\n\nSource Requirements: `FR-1`.\n\n- **US-1.AC-1**: Given a question, When asked, Then answer.\n',
  );
  const data = { features: [{
    id: 'M0-FEAT-001', source_refs: [
      'docs/product/requirements.md#FR-1', 'docs/product/user-stories.md#US-1.AC-1',
    ],
    verification: [{
      type: 'automated', command: 'npm test', expected: 'answer',
      source_refs: ['docs/product/user-stories.md#US-1.AC-1'],
    }],
  }] };

  const matrix = buildTraceability(dir, data);
  assert.equal(matrix.ok, true);
  assert.deepEqual(matrix.requirements[0], { id: 'FR-1', stories: ['US-1'], features: ['M0-FEAT-001'] });
  assert.deepEqual(matrix.acceptanceCriteria[0].verifications, [
    { featureId: 'M0-FEAT-001', verificationIndex: 1 },
  ]);
  assert.equal(validateTraceability(data, dir).ok, true);
});

test('traceability reports under-scope, over-scope, and missing verification links', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  writeProductDocs(
    dir,
    '## Functional Requirements\n- **FR-1**: The system SHALL answer.\n- **FR-2**: The system SHALL audit.\n',
    '## US-1: Answer\n\n- **US-1.AC-1**: Then answer.\n',
  );
  const data = { features: [{
    id: 'M0-FEAT-ORPHAN', source_refs: ['docs/adr/0001.md'],
    verification: [{ type: 'automated', command: 'npm test', expected: 'passes' }],
  }] };

  const matrix = buildTraceability(dir, data);
  assert.deepEqual(matrix.uncoveredRequirements, ['FR-1', 'FR-2']);
  assert.deepEqual(matrix.orphanStories, ['US-1']);
  assert.deepEqual(matrix.orphanFeatures, ['M0-FEAT-ORPHAN']);
  assert.deepEqual(matrix.unverifiedAcceptanceCriteria, ['US-1.AC-1']);
  assert.equal(validateTraceability(data, dir).ok, false);
});

test('scope placeholders expose gaps without making partial planning fail', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  writeProductDocs(
    dir,
    '## Functional Requirements\n- **FR-1**: The system SHALL answer.\n',
    '## US-1: Answer\n\nSource Requirements: FR-1.\n- **US-1.AC-1**: Then answer.\n',
  );
  const data = { features: [{ id: 'M0-SCOPE-001', source_refs: [], verification: [] }] };
  const result = validateTraceability(data, dir);
  assert.equal(result.matrix.deferred, true);
  assert.deepEqual(result.matrix.uncoveredRequirements, ['FR-1']);
  assert.equal(result.ok, true);
});

test('an archived feature still counts as coverage after it leaves feature_list.json', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  writeProductDocs(
    dir,
    '## Functional Requirements\n- **FR-1**: WHEN asked, the system SHALL answer.\n',
    '## US-1: Answer\n\nSource Requirements: `FR-1`.\n\n- **US-1.AC-1**: Given a question, When asked, Then answer.\n',
  );
  fs.writeFileSync(path.join(dir, 'feature_list.json'), JSON.stringify({
    project: 'demo', schema_version: '1.0', milestones: [{ id: 'M0' }],
    features: [{
      id: 'M0-FEAT-001', milestone: 'M0', status: 'passing', dependencies: [],
      source_refs: ['docs/product/requirements.md#FR-1', 'docs/product/user-stories.md#US-1.AC-1'],
      verification: [{
        type: 'automated', command: 'npm test', expected: 'answer',
        source_refs: ['docs/product/user-stories.md#US-1.AC-1'],
      }],
      evidence: [{ kind: 'review', result: 'passed' }],
    }],
  }));

  archiveMilestone(dir, 'M0');

  const remaining = JSON.parse(fs.readFileSync(path.join(dir, 'feature_list.json'), 'utf8'));
  assert.equal(remaining.features.length, 0);

  const matrix = buildTraceability(dir, remaining);
  assert.equal(matrix.ok, true);
  assert.deepEqual(matrix.uncoveredRequirements, []);
  assert.deepEqual(matrix.requirements[0].features, ['M0-FEAT-001']);
});

test('verification cannot claim an acceptance criterion outside its feature scope', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-harness-'));
  writeProductDocs(
    dir,
    '## Functional Requirements\n- **FR-1**: The system SHALL answer.\n',
    '## US-1: Answer\n\nSource Requirements: FR-1.\n- **US-1.AC-1**: Then answer.\n',
  );
  const data = { features: [{
    id: 'M0-FEAT-001', source_refs: ['docs/product/requirements.md#FR-1'],
    verification: [{
      type: 'automated', command: 'npm test', expected: 'passes',
      source_refs: ['docs/product/user-stories.md#US-1.AC-1'],
    }],
  }] };
  assert.match(validateTraceability(data, dir).errors.join('\n'), /feature itself does not declare/);
});
