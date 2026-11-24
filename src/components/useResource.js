import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function useResource(path, refreshKey = 0, { keepPreviousData = false } = {}) {
  const [state, setState] = useState(null);
  useEffect(() => {
    if (!path) return;
    let active = true;
    api(path).then(data => {
      if (active) setState({ path, data, error: "" });
    }).catch(error => {
      if (!active) return;
      setState(current => {
        if (current?.path === path && current.data && error.retryable) return current;
        return { path, data: null, error: error.message };
      });
    });
    return () => { active = false; };
  }, [path, refreshKey]);
  if (!path) return { data: null, error: "", loading: false };
  return state?.path === path ? { ...state, loading: false } : {
    data: keepPreviousData ? state?.data ?? null : null,
    error: "",
    loading: true,
  };
}
