export const IMPLIED_CLASSES_PREFIX = 'implied-classes-of:';

// One pattern from an `implied-classes-of:` key, matched against the element's WHOLE class string:
// `x` equals, `x*` starts with, `*x` ends with, `*x*` contains.
export function classPatternMatches(pattern: string, className: string): boolean {
  const p = pattern.trim();
  if (!p) return false;
  const leading = p.startsWith('*');
  const trailing = p.endsWith('*');
  if (leading && trailing && p.length > 1) return className.includes(p.slice(1, -1));
  if (leading) return className.endsWith(p.slice(1));
  if (trailing) return className.startsWith(p.slice(0, -1));
  return className === p;
}

// Returns className plus the classes implied by matching `implied-classes-of: a, b*, …` vars.
// Patterns are checked against the original className only, so implied classes never imply further ones.
export function applyImpliedClasses(className: string | undefined, vars: Record<string, string>): string | undefined {
  const original = className?.trim();
  if (!original) return className;

  const classes = original.split(/\s+/);
  for (const [key, value] of Object.entries(vars)) {
    if (!key.startsWith(IMPLIED_CLASSES_PREFIX)) continue;
    const patterns = key.slice(IMPLIED_CLASSES_PREFIX.length).split(',');
    if (!patterns.some((p) => classPatternMatches(p, original))) continue;
    for (const implied of value.split(/\s+/)) {
      if (implied && !classes.includes(implied)) classes.push(implied);
    }
  }
  return classes.join(' ');
}
