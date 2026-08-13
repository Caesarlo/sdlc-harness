export const DEFAULT_OWNER_BUCKET = '_default';

export function resolveWipLimit(rules) {
  if (!rules) return 1;
  if (typeof rules.wip_limit_per_owner === 'number') return rules.wip_limit_per_owner;
  if (rules.single_active_feature === false) return Infinity;
  return 1;
}
