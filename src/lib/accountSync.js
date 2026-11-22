export function createAccountSync({ load, onIdentity, onResult, onError, onSettled, timeout = 15_000 }) {
  let identity;
  let pending;

  function cancel() {
    const previous = pending;
    pending = undefined;
    previous?.abort();
  }

  async function sync(user) {
    const uid = user?.uid ?? null;
    if (identity === uid) return;
    identity = uid;
    cancel();
    onIdentity(user);
    if (!user) return;

    const request = new AbortController();
    pending = request;
    const timer = setTimeout(() => {
      request.abort(new Error("Checking your Matchday account timed out."));
    }, timeout);

    try {
      const abort = new Promise((_, reject) => {
        request.signal.addEventListener("abort", () => reject(request.signal.reason), { once: true });
      });
      const result = await Promise.race([abort, load(user, request.signal)]);
      if (pending === request) onResult(result);
    } catch (error) {
      if (pending === request) onError(error);
    } finally {
      clearTimeout(timer);
      if (pending === request) {
        pending = undefined;
        onSettled();
      }
    }
  }

  return { sync, cancel };
}
