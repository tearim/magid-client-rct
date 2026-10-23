// React-app side of @magiden/client-core's transport. Story commands go through the core client (see store/magidStore.ts);
// only the admin stats view still calls the server directly.
import * as core from '@magiden/client-core';
import type { ServerStats } from '@magiden/client-core';

export { javaHashCode } from '@magiden/client-core';

// Announced to the server as `client-type`.
export const CLIENT_TYPE = 'react';

export function fetchServerStats(baseUrl: string, authToken?: string): Promise<ServerStats> {
  return core.fetchServerStats({ baseUrl, authToken, clientType: CLIENT_TYPE });
}
