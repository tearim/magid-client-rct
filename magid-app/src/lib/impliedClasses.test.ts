import { describe, it, expect } from 'vitest';
import { applyImpliedClasses, classPatternMatches } from './impliedClasses';

describe('classPatternMatches', () => {
  it('matches a plain pattern only against the exact class string', () => {
    expect(classPatternMatches('keeper-talking', 'keeper-talking')).toBe(true);
    expect(classPatternMatches('keeper-talking', 'keeper-talking loud')).toBe(false);
    expect(classPatternMatches('keeper-talking', 'keeper')).toBe(false);
  });

  it('matches "x*" when the class string starts with x', () => {
    expect(classPatternMatches('anim*', 'anim by-word-20 fancy')).toBe(true);
    expect(classPatternMatches('anim*', 'special anim')).toBe(false);
  });

  it('matches "*x" when the class string ends with x', () => {
    expect(classPatternMatches('*anim', 'special anim')).toBe(true);
    expect(classPatternMatches('*anim', 'anim special')).toBe(false);
  });

  it('matches "*x*" when the class string contains x', () => {
    expect(classPatternMatches('*agent-talking*', 'secret-agent-talking now')).toBe(true);
    expect(classPatternMatches('*agent-talking*', 'agent-silent')).toBe(false);
  });

  it('ignores surrounding whitespace in the pattern', () => {
    expect(classPatternMatches('  seer-talking ', 'seer-talking')).toBe(true);
  });
});

describe('applyImpliedClasses', () => {
  const vars = {
    'implied-classes-of: hermit-talking*, skinner-talking*': 'type-by-word-50 animate-independent',
    'implied-classes-of: seer-talking': 'type-by-word-75',
    'freshness-key': 'abc',
  };

  it('appends the implied classes of a matching key', () => {
    expect(applyImpliedClasses('seer-talking', vars)).toBe('seer-talking type-by-word-75');
  });

  it('matches any pattern of a comma-separated key', () => {
    expect(applyImpliedClasses('skinner-talking', vars)).toBe('skinner-talking type-by-word-50 animate-independent');
  });

  it('keeps the explicit classes first so they take precedence over implied ones', () => {
    expect(applyImpliedClasses('hermit-talking type-by-word-70', vars))
      .toBe('hermit-talking type-by-word-70 type-by-word-50 animate-independent');
  });

  it('does not add a class that is already present', () => {
    expect(applyImpliedClasses('hermit-talking animate-independent', vars))
      .toBe('hermit-talking animate-independent type-by-word-50');
  });

  it('does not let implied classes imply further classes', () => {
    const chained = {
      'implied-classes-of: a': 'b',
      'implied-classes-of: b': 'c',
    };
    expect(applyImpliedClasses('a', chained)).toBe('a b');
  });

  it('leaves the class unchanged when nothing matches', () => {
    expect(applyImpliedClasses('bandit-talking', vars)).toBe('bandit-talking');
  });

  it('returns undefined and empty classes unchanged', () => {
    expect(applyImpliedClasses(undefined, vars)).toBeUndefined();
    expect(applyImpliedClasses('', vars)).toBe('');
  });

  it('does not modify its arguments', () => {
    const input = { ...vars };
    applyImpliedClasses('seer-talking', input);
    expect(input).toEqual(vars);
  });
});
