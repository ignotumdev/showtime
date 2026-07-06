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
      const timestamps = valueKey === "" ? [] : valueKey.split(",").map(Number);

      const nextDelay = timestamps.reduce<number | undefined>((minimumDelay, timestamp) => {
        const delay = millisecondsUntilRelativeDateUpdate(timestamp, current);

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
  }, [valueKey]);

  return now;
}
