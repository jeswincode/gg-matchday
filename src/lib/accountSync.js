const accountTimeout = "Checking your Matchday account timed out.";

export async function fetchMatchdayAccount(apiUrl, headers, signal) {
  const response = await fetch(`${apiUrl}/auth/me`, { headers, signal, cache: "no-store" });
  const data = await response.json().catch(() => null);
  if (response.ok && data?.user?.id && data.user.role) return data.user;

  const error = new Error(data?.message || "Matchday account service is temporarily unavailable.");
  error.status = response.status;
  error.retryable = response.ok || response.status === 408 || response.status === 429 || response.status >= 500;
  throw error;
}

function waitForRetry(delay, signal) {
  return new Promise(resolve => {
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", finish);
      resolve();
    };
    const timer = setTimeout(finish, delay);
    signal.addEventListener("abort", finish, { once: true });
  });
}

async function attempt(load, user, signal, timeout) {
  const request = new AbortController();
  const cancel = () => request.abort(signal.reason);
  signal.addEventListener("abort", cancel, { once: true });
  const timer = setTimeout(() => request.abort(new Error(accountTimeout)), timeout);
  const aborted = new Promise((_, reject) => {
    request.signal.addEventListener("abort", () => reject(request.signal.reason), { once: true });
  });
  try {
    return await Promise.race([aborted, load(user, request.signal)]);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", cancel);
  }
}

export function createAccountSync({
  load, onIdentity, onStart = () => {}, onResult, onError, onSettled,
  timeout = 20_000, retryDelays = [500, 1_000, 2_000],
}) {
  let identity;
  let user;
  let pending;
  let failure;

  function cancel() {
    const previous = pending;
    pending = undefined;
    previous?.abort();
  }

  async function run(recovery) {
    failure = undefined;
    const request = new AbortController();
    pending = request;
    const { signal } = request;
    const currentUser = user;
    onStart();

    try {
      for (let index = 0; !signal.aborted; index++) {
        try {
          const result = await attempt(load, currentUser, signal, timeout);
          if (!signal.aborted) onResult(result, { recovered: recovery || index > 0 });
          return;
        } catch (error) {
          if (signal.aborted) return;
          if (error?.retryable === false || index >= retryDelays.length) {
            failure = error;
            onError(error);
            return;
          }
          await waitForRetry(retryDelays[index], signal);
        }
      }
    } finally {
      if (pending === request) {
        pending = undefined;
        onSettled();
      }
    }
  }

  function sync(nextUser) {
    const uid = nextUser?.uid ?? null;
    if (identity === uid) return;
    identity = uid;
    user = nextUser;
    cancel();
    failure = undefined;
    onIdentity(user);
    if (user) return run(false);
  }

  function retry({ automatic = false } = {}) {
    if (user && failure && !pending && (!automatic || failure.retryable !== false)) return run(true);
  }

  return { sync, cancel, retry };
}
