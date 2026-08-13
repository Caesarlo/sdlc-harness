export class FeatureNotFoundError extends Error {
  constructor(featureId) {
    super(`Feature not found: ${featureId}`);
    this.name = 'FeatureNotFoundError';
    this.featureId = featureId;
  }
}
