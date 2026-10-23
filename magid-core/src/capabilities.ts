// Server-announced commands (config var `allowed-commands`) and operator restrictions.
//
// Wire format: `group:action,action;group:action`, e.g. `core:server-status,end-session;xml:list-xmls,set-xml`.
// Commands go out unqualified (`cmd=set-xml`); the group only exists on the server, so a name matches an entry when
// both are qualified and equal, or when their action parts are equal.

// Server actions the client knows about (story-server/agnostic: AgnosticMagidServer, MagidServerCoreActions,
// MagidServerUnsafeCodeActions, …). Only these are gated by `allowed-commands`; anything else is a story command (a
// menu choice) and always allowed.
export const SERVER_ACTIONS = [
  'request-file',
  'list-actors', 'server-stats', 'server-status', 'story-status', 'end-session',
  'list-xmls', 'set-xml', 'reload-xml',
  'list-stories', 'retrieve-story', 'save-story',
  'list-scenes', 'expose-code', 'mutate-code',
];

// `group:a,b;g2:c` → ['group:a', 'group:b', 'g2:c']. Entries without a group stay unqualified.
export function parseAllowedCommands(spec: string): string[] {
  const result: string[] = [];
  for (const groupSpec of spec.split(';')) {
    const colon = groupSpec.indexOf(':');
    const group = colon === -1 ? '' : groupSpec.slice(0, colon).trim();
    const actions = colon === -1 ? groupSpec : groupSpec.slice(colon + 1);
    for (const action of actions.split(',').map((a) => a.trim()).filter(Boolean)) {
      result.push(group ? `${group}:${action}` : action);
    }
  }
  return result;
}

function actionOf(name: string): string {
  return name.slice(name.indexOf(':') + 1);
}

export function commandMatches(a: string, b: string): boolean {
  if (a.includes(':') && b.includes(':')) return a === b;
  return actionOf(a) === actionOf(b);
}

// `allowed` null = the server announced nothing: everything is allowed. Operator `disabled` entries always win.
export function isCommandAllowed(command: string, allowed: string[] | null, disabled: string[] = []): boolean {
  if (disabled.some((d) => commandMatches(command, d))) return false;
  if (allowed === null || !SERVER_ACTIONS.includes(actionOf(command))) return true;
  return allowed.some((a) => commandMatches(command, a));
}
