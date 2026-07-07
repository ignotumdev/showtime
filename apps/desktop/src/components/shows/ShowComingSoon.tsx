import { Badge } from "@/components/ui/badge";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

type ShowComingSoonProps = {
  readonly title: string;
};

export function ShowComingSoon({ title }: ShowComingSoonProps) {
  return (
    <Empty className="h-full">
      <EmptyHeader>
        <Badge variant="secondary">Coming soon</Badge>
        <EmptyTitle>{title}</EmptyTitle>
      </EmptyHeader>
    </Empty>
  );
}
