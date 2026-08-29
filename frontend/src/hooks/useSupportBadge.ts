import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

/** Polls how many open support tickets are awaiting this side's reply — powers the bell/sidebar badges. */
export function useSupportBadge(): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const poll = () => {
      api
        .get<{ count: number }>("/support/tickets/awaiting-reply-count")
        .then(({ data }) => {
          if (!cancelled) setCount(data.count);
        })
        .catch(() => undefined);
    };

    poll();
    const interval = setInterval(poll, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user]);

  return count;
}
