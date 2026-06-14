/**
 * Operator-facing client configuration.
 * This file is compiled into the bundle and is not editable by end users.
 * Story owners should adjust these flags before deploying to production.
 */
export const clientConfig = {
  /**
   * Show the Connect button in the header.
   * Disable in production if you don't want users to reconnect manually.
   */
  showConnectButton: true,

  /**
   * Show the Reset Server button in the header.
   * Sends "reload-xml" to the server, restarting the story from the beginning.
   * Disable in production if you don't want users to reset story progress.
   */
  showResetServerButton: true,
} as const;
