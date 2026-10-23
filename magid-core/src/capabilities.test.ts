import { describe, it, expect } from 'vitest';
import { commandMatches, isCommandAllowed, parseAllowedCommands } from './capabilities';

const SPEC = 'common-file:request-file;core:list-actors,server-status,story-status,end-session;xml:list-xmls,set-xml';

describe('parseAllowedCommands', () => {
  it('qualifies every action with its group', () => {
    expect(parseAllowedCommands(SPEC)).toEqual([
      'common-file:request-file',
      'core:list-actors', 'core:server-status', 'core:story-status', 'core:end-session',
      'xml:list-xmls', 'xml:set-xml',
    ]);
  });

  it('tolerates spaces, empty parts and entries without a group', () => {
    expect(parseAllowedCommands(' xml: set-xml , ;;reload-xml')).toEqual(['xml:set-xml', 'reload-xml']);
    expect(parseAllowedCommands('')).toEqual([]);
  });
});

describe('commandMatches', () => {
  it('compares action parts unless both names are qualified', () => {
    expect(commandMatches('set-xml', 'xml:set-xml')).toBe(true);
    expect(commandMatches('xml:set-xml', 'set-xml')).toBe(true);
    expect(commandMatches('xml:set-xml', 'other:set-xml')).toBe(false);
    expect(commandMatches('set-xml', 'reload-xml')).toBe(false);
  });
});

describe('isCommandAllowed', () => {
  const allowed = parseAllowedCommands(SPEC);

  it('allows everything when the server announced nothing', () => {
    expect(isCommandAllowed('reload-xml', null)).toBe(true);
    expect(isCommandAllowed('expose-code', null)).toBe(true);
  });

  it('allows announced server actions and refuses the others', () => {
    expect(isCommandAllowed('set-xml', allowed)).toBe(true);
    expect(isCommandAllowed('reload-xml', allowed)).toBe(false);
    expect(isCommandAllowed('expose-code', allowed)).toBe(false);
    expect(isCommandAllowed('server-stats', allowed)).toBe(false);
  });

  it('always allows story commands', () => {
    expect(isCommandAllowed('', allowed)).toBe(true);
    expect(isCommandAllowed('go-north', allowed)).toBe(true);
  });

  it('lets operator restrictions win over the server', () => {
    expect(isCommandAllowed('set-xml', allowed, ['set-xml'])).toBe(false);
    expect(isCommandAllowed('set-xml', null, ['xml:set-xml'])).toBe(false);
  });
});
