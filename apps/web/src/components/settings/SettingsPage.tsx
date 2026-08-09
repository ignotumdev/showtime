import * as React from "react";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { cn } from "@/lib/utils";

export function SettingsHeader({ children }: { readonly children: React.ReactNode }) {
  return <h1 className="text-xl font-semibold tracking-tight">{children}</h1>;
}

export function SettingsSection({
  title,
  action,
  children,
  className,
}: {
  readonly title?: string;
  readonly action?: React.ReactNode;
  readonly children: React.ReactNode;
  readonly className?: string;
}) {
  const titleId = React.useId();

  return (
    <section aria-labelledby={title ? titleId : undefined} className={cn("space-y-1.5", className)}>
      {(title || action) && (
        <div className="flex min-h-8 items-center justify-between gap-3">
          {title && (
            <h2 id={titleId} className="text-sm font-medium text-muted-foreground">
              {title}
            </h2>
          )}
          {action && <div className="ml-auto">{action}</div>}
        </div>
      )}
      <div className="divide-y">{children}</div>
    </section>
  );
}

export function SettingsItem({
  title,
  description,
  action,
  children,
  className,
}: {
  readonly title: React.ReactNode;
  readonly description?: React.ReactNode;
  readonly action?: React.ReactNode;
  readonly children?: React.ReactNode;
  readonly className?: string;
}) {
  return (
    <Item className={cn("min-h-16 border-0 px-0 py-3 sm:flex-nowrap", className)}>
      <ItemContent className="min-w-0">
        <ItemTitle>{title}</ItemTitle>
        {description && <ItemDescription>{description}</ItemDescription>}
        {children}
      </ItemContent>
      {action && (
        <ItemActions className="w-full shrink-0 justify-end sm:w-auto">{action}</ItemActions>
      )}
    </Item>
  );
}
