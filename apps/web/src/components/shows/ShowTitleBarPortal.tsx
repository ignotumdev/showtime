import * as React from "react";
import { createPortal } from "react-dom";

export const showTitleBarLeadingId = "show-title-bar-leading";
export const showTitleBarActionsId = "show-title-bar-actions";

export function ShowTitleBarPortal({
  children,
  position,
}: {
  readonly children: React.ReactNode;
  readonly position: "leading" | "actions";
}) {
  const [target, setTarget] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    setTarget(
      document.getElementById(
        position === "leading" ? showTitleBarLeadingId : showTitleBarActionsId,
      ),
    );
  }, [position]);

  return target ? createPortal(children, target) : null;
}
