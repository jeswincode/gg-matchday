import { useEffect, useState } from "react";

export function useActionFinished(start, duration) {
  const deadline = start + duration;
  const [finishedAt, setFinishedAt] = useState(null);

  useEffect(() => {
    if (!duration) return;
    const timer = window.setTimeout(() => setFinishedAt(deadline), Math.max(0, deadline - performance.now()));
    return () => window.clearTimeout(timer);
  }, [deadline, duration]);

  return !duration || finishedAt === deadline;
}
