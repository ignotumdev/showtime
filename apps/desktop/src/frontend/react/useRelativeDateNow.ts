import { useEffect, useMemo, useState } from "react";
import { millisecondsUntilRelativeDateUpdate } from "@/lib/dates";

export function useRelativeDateNow(values: ReadonlyArray<string | number | Date>): Date {
  const [now, setNow] = useState(() => new Date());
  const valueKey = useMemo(
    () => values.map((value) => new Date(value).getTime()).join(","),
    [values],
  );

  useEffect(() => {
    let timeout: number | undefined;

    const scheduleNextUpdate = () => {
      const current = new Date();
      setNow(current);

      const nextDelay = values.reduce<number | undefined>((minimumDelay, value) => {
        const delay = millisecondsUntilRelativeDateUpdate(value, current);

        if (delay === undefined) {
          return minimumDelay;
        }

        return minimumDelay === undefined ? delay : Math.min(minimumDelay, delay);
      }, undefined);

      if (nextDelay !== undefined) {
        timeout = window.setTimeout(scheduleNextUpdate, nextDelay);
      }
    };

    scheduleNextUpdate();

    return () => {
      if (timeout !== undefined) {
        window.clearTimeout(timeout);
      }
    };
  }, [valueKey, values]);

  return now;
}
