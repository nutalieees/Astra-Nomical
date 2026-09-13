import "server-only";

/** Execution metadata stays server-side and is never included in model context. */
export interface AgentRunOptions {
  signal?: AbortSignal;
}

export function agentRunSignal(options?: AgentRunOptions): AbortSignal {
  const timeout = AbortSignal.timeout(60_000);
  const signal = options?.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  signal.throwIfAborted();
  return signal;
}

/** Bound the caller's wait even if a provider ignores cancellation. */
export async function abortable<T>(operation: () => Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  let onAbort: () => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(signal.reason ?? new DOMException("Operation cancelled.", "AbortError"));
    signal.addEventListener("abort", onAbort, { once: true });
  });
  try {
    // Promise.race also observes a late rejection from an abandoned provider.
    return await Promise.race([operation(), aborted]);
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}
