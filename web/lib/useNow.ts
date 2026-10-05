"use client";

import { useEffect, useState } from "react";

/** Unix seconds, refreshed every `ms`. Keeps Date.now() out of render. */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}
