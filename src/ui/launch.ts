/**
 * Run a click/change handler that may return a Promise, without leaving a
 * floating or misused promise in a void callback.
 */
export function launch(op: () => void | Promise<void>): void {
  void Promise.resolve()
    .then(() => op())
    .catch((err: unknown) => {
      console.error("[NF-Calendar]", err);
    });
}
