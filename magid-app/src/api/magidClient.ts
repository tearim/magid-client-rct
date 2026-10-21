// React-app side of @magid/client-core's transport. Story commands go through the core client (see store/magidStore.ts);
// only the admin stats view still calls the server directly.
import * as core from '@magid/client-core';
import type { ServerStats } from '@magid/client-core';

export { javaHashCode } from '@magid/client-core';

// Announced to the server as `client-type`.
export const CLIENT_TYPE = 'react';

export function fetchServerStats(baseUrl: string, authToken?: string): Promise<ServerStats> {
  return core.fetchServerStats({ baseUrl, authToken, clientType: CLIENT_TYPE });
}
