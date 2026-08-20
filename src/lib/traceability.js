import fs from 'node:fs';
import path from 'node:path';
import { loadArchivedFeatures } from './archive.js';

const REQUIREMENT_ID = /\b(?:FR|NFR)-\d+\b/g;
const STORY_ID = /\bUS-\d+\b/g;
const ACCEPTANCE_ID = /\bUS-\d+\.AC-\d+\b/g;
const SCOPE_PLACEHOLDER = /-SCOPE-\d+$/;
const ANY_PLACEHOLDER = /-(?:SCOPE|RELEASE)-\d+$/;

function unique(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function matches(value, pattern) {
  return unique([...String(value || '').matchAll(pattern)].map((match) => match[0]));
}

function readOptional(repoRoot, relativePath) {
  const filePath = path.join(repoRoot, relativePath);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
}

function parseRequirements(content) {
  if (!content) return [];
  const ids = [];
  const entryPattern = /^\s*[-*]\s+\*\*((?:FR|NFR)-\d+)\*\*\s*:/gm;
  for (const match of content.matchAll(entryPattern)) ids.push(match[1]);
  return unique(ids);
}

function parseUserStories(content) {
  if (!content) return [];
  const headings = [...content.matchAll(/^##\s+(US-\d+)\s*:/gm)];
  return headings.map((heading, index) => {
    const start = heading.index;
    const end = headings[index + 1]?.index ?? content.length;
    const block = content.slice(start, end);
    const acceptanceCriteria = [];
    for (const match of block.matchAll(/^\s*[-*]\s+\*\*(US-\d+\.AC-\d+)\*\*\s*:/gm)) {
      acceptanceCriteria.push(match[1]);
    }
    return {
      id: heading[1],
      requirements: matches(block, REQUIREMENT_ID),
      acceptanceCriteria: unique(acceptanceCriteria),
    };
  });
}

function refsFrom(value) {
  const text = JSON.stringify(value || []);
  return {
    requirements: matches(text, REQUIREMENT_ID),
    stories: matches(text, STORY_ID),
    acceptanceCriteria: matches(text, ACCEPTANCE_ID),
  };
}

export function buildTraceability(repoRoot, data) {
  const requirementsContent = readOptional(repoRoot, path.join('docs', 'product', 'requirements.md'));
  const storiesContent = readOptional(repoRoot, path.join('docs', 'product', 'user-stories.md'));
  const requirementIds = parseRequirements(requirementsContent);
  const parsedStories = parseUserStories(storiesContent);
  const storyIds = parsedStories.map((story) => story.id);
  const acceptanceIds = parsedStories.flatMap((story) => story.acceptanceCriteria);

  // Archived features (see src/lib/archive.js) were passing when moved out
  // of feature_list.json; requirements/stories/acceptance criteria they
  // covered must keep reading as covered, not regress to "uncovered" the
  // moment a completed milestone archives.
  const allFeatures = [...(data.features || []), ...loadArchivedFeatures(repoRoot)];

  const featureRows = allFeatures
    .filter((feature) => !ANY_PLACEHOLDER.test(feature.id))
    .map((feature) => {
      const refs = refsFrom(feature.source_refs);
      const verifications = (feature.verification || []).map((verification, index) => ({
        index: index + 1,
        ...refsFrom(verification.source_refs || verification.acceptance_criteria),
      }));
      return {
        id: feature.id,
        requirements: refs.requirements,
        stories: refs.stories,
        acceptanceCriteria: refs.acceptanceCriteria,
        verifications,
      };
    });

  const storyRows = parsedStories.map((story) => {
    const features = featureRows
      .filter((feature) => feature.stories.includes(story.id)
        || feature.acceptanceCriteria.some((id) => id.startsWith(`${story.id}.AC-`)))
      .map((feature) => feature.id);
    return { ...story, features: unique(features) };
  });

  const acceptanceRows = acceptanceIds.map((id) => {
    const storyId = id.split('.AC-')[0];
    const features = featureRows.filter((feature) => feature.acceptanceCriteria.includes(id));
    const verifications = featureRows.flatMap((feature) => feature.verifications
      .filter((verification) => verification.acceptanceCriteria.includes(id))
      .map((verification) => ({ featureId: feature.id, verificationIndex: verification.index })));
    return {
      id,
      storyId,
      features: features.map((feature) => feature.id),
      verifications,
    };
  });

  const requirementRows = requirementIds.map((id) => {
    const stories = storyRows.filter((story) => story.requirements.includes(id));
    const transitiveFeatureIds = stories.flatMap((story) => story.features);
    const directFeatureIds = featureRows
      .filter((feature) => feature.requirements.includes(id))
      .map((feature) => feature.id);
    return {
      id,
      stories: stories.map((story) => story.id),
      features: unique([...directFeatureIds, ...transitiveFeatureIds]),
    };
  });

  const unknownReferences = [];
  for (const feature of featureRows) {
    for (const id of feature.requirements.filter((candidate) => !requirementIds.includes(candidate))) {
      unknownReferences.push(`${feature.id} references unknown requirement ${id}`);
    }
    for (const id of feature.acceptanceCriteria.filter((candidate) => !acceptanceIds.includes(candidate))) {
      unknownReferences.push(`${feature.id} references unknown acceptance criterion ${id}`);
    }
    for (const id of feature.stories.filter((candidate) => !storyIds.includes(candidate))) {
      unknownReferences.push(`${feature.id} references unknown user story ${id}`);
    }
    for (const verification of feature.verifications) {
      for (const id of verification.acceptanceCriteria.filter((candidate) => !acceptanceIds.includes(candidate))) {
        unknownReferences.push(`${feature.id} verification ${verification.index} references unknown acceptance criterion ${id}`);
      }
      for (const id of verification.acceptanceCriteria.filter((candidate) => !feature.acceptanceCriteria.includes(candidate))) {
        unknownReferences.push(`${feature.id} verification ${verification.index} references ${id}, but the feature itself does not declare that acceptance criterion`);
      }
    }
  }
  for (const story of storyRows) {
    for (const id of story.requirements.filter((candidate) => !requirementIds.includes(candidate))) {
      unknownReferences.push(`${story.id} references unknown requirement ${id}`);
    }
  }

  const gaps = {
    uncoveredRequirements: requirementRows.filter((row) => row.features.length === 0).map((row) => row.id),
    orphanStories: storyRows.filter((row) => row.requirements.length === 0).map((row) => row.id),
    orphanFeatures: featureRows
      .filter((row) => row.requirements.length === 0 && row.acceptanceCriteria.length === 0)
      .map((row) => row.id),
    unverifiedAcceptanceCriteria: acceptanceRows
      .filter((row) => row.verifications.length === 0)
      .map((row) => row.id),
    uncoveredAcceptanceCriteria: acceptanceRows
      .filter((row) => row.features.length === 0)
      .map((row) => row.id),
    unknownReferences: unique(unknownReferences),
  };

  const applicable = requirementsContent !== null || storiesContent !== null;
  const deferred = (data.features || []).some((feature) => SCOPE_PLACEHOLDER.test(feature.id));
  const gapCount = Object.values(gaps).reduce((count, values) => count + values.length, 0);

  return {
    applicable,
    deferred,
    ok: !applicable || (deferred ? gaps.unknownReferences.length === 0 : gapCount === 0),
    requirements: requirementRows,
    stories: storyRows,
    acceptanceCriteria: acceptanceRows,
    features: featureRows,
    ...gaps,
  };
}
