import fs from 'node:fs';
import path from 'node:path';
import { readJsonWithStamp, writeJsonCas, RevisionConflictError } from './atomic-write.js';
import { appendEvent } from './events.js';

const ARCHIVE_DIR = path.join('.harness', 'archive');

export class MilestoneNotFoundError extends Error {
  constructor(milestoneId) {
    super(`Milestone not found: ${milestoneId}`);
    this.name = 'MilestoneNotFoundError';
    this.milestoneId = milestoneId;
  }
}

export class MilestoneNotArchivableError extends Error {
  constructor(milestoneId, blockers) {
    super(`Milestone ${milestoneId} cannot be archived — not all features are passing:\n  - ${blockers.join('\n  - ')}`);
    this.name = 'MilestoneNotArchivableError';
    this.milestoneId = milestoneId;
    this.blockers = blockers;
  }
}

export class MilestoneAlreadyArchivedError extends Error {
  constructor(milestoneId) {
    super(`Milestone ${milestoneId} is already archived`);
    this.name = 'MilestoneAlreadyArchivedError';
    this.milestoneId = milestoneId;
  }
}

function archiveFilePath(repoRoot, milestoneId) {
  return path.join(repoRoot, ARCHIVE_DIR, `${milestoneId}.json`);
}

export function listArchivedMilestones(repoRoot) {
  const dir = path.join(repoRoot, ARCHIVE_DIR);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')));
}

// Feature ids that live only in the archive. Treated as satisfied ("passing")
// dependencies everywhere a live feature's dependency list is checked, so
// archiving a completed milestone never blocks new work that depended on it
// — archiving only removes features from feature_list.json, it never
// invalidates what they proved.
export function loadArchivedFeatureIds(repoRoot) {
  const ids = new Set();
  for (const entry of listArchivedMilestones(repoRoot)) {
    for (const feature of entry.features || []) ids.add(feature.id);
  }
  return ids;
}

// Archived features in their original shape, for traceability coverage — a
// requirement/story covered only by now-archived features must keep reading
// as covered rather than regressing to "uncovered" the moment work archives.
export function loadArchivedFeatures(repoRoot) {
  return listArchivedMilestones(repoRoot).flatMap((entry) => entry.features || []);
}

// Moves a milestone and all of its features out of feature_list.json into a
// standalone JSON file under .harness/archive/, keyed by milestone id. Every
// feature in the milestone must already be `passing` — archiving is a
// storage move for completed work, never a way to drop unfinished features.
// The archive file is written before feature_list.json is mutated so a crash
// mid-operation can at worst leave a duplicate/orphaned archive file, never
// lose the milestone's data.
export function archiveMilestone(repoRoot, milestoneId, { actor } = {}) {
  const featureListPath = path.join(repoRoot, 'feature_list.json');
  const archivePath = archiveFilePath(repoRoot, milestoneId);
  if (fs.existsSync(archivePath)) throw new MilestoneAlreadyArchivedError(milestoneId);

  let concurrentRetry = false;
  let record;

  for (;;) {
    const { data, stamp } = readJsonWithStamp(featureListPath);
    const milestone = (data.milestones || []).find((m) => m.id === milestoneId);
    if (!milestone) throw new MilestoneNotFoundError(milestoneId);

    const features = data.features.filter((f) => f.milestone === milestoneId);
    const blockers = features
      .filter((f) => f.status !== 'passing')
      .map((f) => `${f.id} is ${f.status}`);
    if (blockers.length > 0) throw new MilestoneNotArchivableError(milestoneId, blockers);

    record = {
      milestone,
      features,
      archived_at: new Date().toISOString(),
      archived_by: actor || null,
    };
    fs.mkdirSync(path.dirname(archivePath), { recursive: true });
    fs.writeFileSync(archivePath, `${JSON.stringify(record, null, 2)}\n`);

    const next = {
      ...data,
      milestones: data.milestones.filter((m) => m.id !== milestoneId),
      features: data.features.filter((f) => f.milestone !== milestoneId),
    };
    try {
      writeJsonCas(featureListPath, next, stamp);
      break;
    } catch (err) {
      if (!(err instanceof RevisionConflictError) || concurrentRetry) throw err;
      concurrentRetry = true;
    }
  }

  appendEvent(repoRoot, {
    type: 'milestone.archived',
    milestone_id: milestoneId,
    feature_count: record.features.length,
    actor: actor || null,
  });

  return record;
}
