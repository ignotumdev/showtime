import * as React from "react";
import { cn } from "@/lib/utils";

function ButtonGroup({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<"div"> & { orientation?: "horizontal" | "vertical" }) {
  return (
    <div
      role="group"
      data-slot="button-group"
      data-orientation={orientation}
      className={cn(
        "flex w-fit items-stretch [&>*]:focus-visible:z-10 [&>*]:focus-visible:relative data-[orientation=vertical]:flex-col data-[orientation=horizontal]:[&>*:not(:first-child)]:rounded-l-none data-[orientation=horizontal]:[&>*:not(:first-child)]:border-l-0 data-[orientation=horizontal]:[&>*:not(:last-child)]:rounded-r-none data-[orientation=vertical]:[&>*:not(:first-child)]:rounded-t-none data-[orientation=vertical]:[&>*:not(:first-child)]:border-t-0 data-[orientation=vertical]:[&>*:not(:last-child)]:rounded-b-none",
        className,
      )}
      {...props}
    />
  );
}

export { ButtonGroup };
