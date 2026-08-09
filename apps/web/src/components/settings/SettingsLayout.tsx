import { Link, Outlet } from "@tanstack/react-router";
import {
  ArrowLeftIcon,
  MessageCircleIcon,
  RefreshCwIcon,
  Settings2Icon,
  UserRoundIcon,
  WifiIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useShowFromParams } from "@/hooks/useShowFromParams";
import { cn } from "@/lib/utils";
import { isDesktopHost } from "@/platform";
import { ShowSwitcher } from "@/components/shows/ShowSwitcher";

export function SettingsLayout() {
  const { showId, show } = useShowFromParams();
  const desktopHost = isDesktopHost();

  return (
    <>
      <header
        aria-hidden="true"
        className={cn(
          "title-bar-height title-bar-padding fixed inset-x-0 top-0 z-30 hidden select-none items-center bg-background md:flex",
          desktopHost && "drag-region",
        )}
      />
      <SidebarProvider className="app-height relative overflow-hidden bg-background">
        <Sidebar collapsible="none" className="relative z-40 hidden md:flex">
          <SidebarHeader>
            <ShowSwitcher showId={showId} destination="settings" />
          </SidebarHeader>
          <SidebarContent>
            {showId && (
              <SidebarGroup>
                <SidebarGroupLabel>{show?.name ?? "Show"}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SettingsShowLink
                      showId={showId}
                      section="general"
                      label="General"
                      icon={Settings2Icon}
                    />
                    <SettingsShowLink
                      showId={showId}
                      section="chat"
                      label="Chat"
                      icon={MessageCircleIcon}
                    />
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
            <SidebarGroup>
              <SidebarGroupLabel>Settings</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {showId ? (
                    <>
                      <SettingsShowLink
                        showId={showId}
                        section="profiles"
                        label="Profiles"
                        icon={UserRoundIcon}
                      />
                      <SettingsShowLink
                        showId={showId}
                        section="connections"
                        label="Connections"
                        icon={WifiIcon}
                      />
                    </>
                  ) : (
                    <>
                      <SettingsGlobalLink
                        section="profiles"
                        label="Profiles"
                        icon={UserRoundIcon}
                      />
                      <SettingsGlobalLink
                        section="connections"
                        label="Connections"
                        icon={WifiIcon}
                      />
                    </>
                  )}
                  {showId ? (
                    <SettingsShowLink
                      showId={showId}
                      section="updates"
                      label="Updates"
                      icon={RefreshCwIcon}
                    />
                  ) : (
                    <SettingsGlobalLink section="updates" label="Updates" icon={RefreshCwIcon} />
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={
                    showId ? <Link to="/shows/$showId" params={{ showId }} /> : <Link to="/" />
                  }
                >
                  <ArrowLeftIcon />
                  <span>Back</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="z-20 min-w-0 overflow-hidden md:pt-10">
          <header className="flex h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 items-center gap-2 border-b bg-background px-3 pt-[env(safe-area-inset-top)] md:hidden">
            <Button
              nativeButton={false}
              size="icon-sm"
              variant="ghost"
              aria-label={show ? `Back to ${show.name}` : "Back to shows"}
              render={showId ? <Link to="/shows/$showId" params={{ showId }} /> : <Link to="/" />}
            >
              <ArrowLeftIcon />
            </Button>
            <span className="text-sm font-semibold">Settings</span>
          </header>
          <nav className="flex shrink-0 gap-1 overflow-x-auto border-b bg-background p-2 md:hidden">
            {showId ? (
              <>
                <MobileShowLink showId={showId} section="general" label="General" />
                <MobileShowLink showId={showId} section="chat" label="Chat" />
              </>
            ) : null}
            {showId ? (
              <>
                <MobileShowLink showId={showId} section="profiles" label="Profiles" />
                <MobileShowLink showId={showId} section="connections" label="Connections" />
              </>
            ) : (
              <>
                <MobileGlobalLink section="profiles" label="Profiles" />
                <MobileGlobalLink section="connections" label="Connections" />
              </>
            )}
            {showId ? (
              <MobileShowLink showId={showId} section="updates" label="Updates" />
            ) : (
              <MobileGlobalLink section="updates" label="Updates" />
            )}
          </nav>
          <ScrollArea className="min-h-0 flex-1">
            <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-5 sm:px-5 sm:py-6 lg:px-8">
              <Outlet />
            </div>
          </ScrollArea>
        </SidebarInset>
      </SidebarProvider>
    </>
  );
}

type Icon = React.ComponentType<{ className?: string }>;
type ShowSection = "general" | "chat" | "updates" | "profiles" | "connections";
type GlobalSection = "updates" | "profiles" | "connections";

function SettingsShowLink({
  showId,
  section,
  label,
  icon: Icon,
}: {
  showId: string;
  section: ShowSection;
  label: string;
  icon: Icon;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={
          <Link
            to="/shows/$showId/settings/$section"
            params={{ showId, section }}
            activeProps={{ "data-active": true }}
          />
        }
      >
        <Icon />
        <span>{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function SettingsGlobalLink({
  section,
  label,
  icon: Icon,
}: {
  section: GlobalSection;
  label: string;
  icon: Icon;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={
          <Link
            to="/settings/$section"
            params={{ section }}
            activeProps={{ "data-active": true }}
          />
        }
      >
        <Icon />
        <span>{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

const mobileLinkClassName =
  "shrink-0 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground outline-none hover:bg-muted data-active:bg-muted data-active:text-foreground";

function MobileShowLink({
  showId,
  section,
  label,
}: {
  showId: string;
  section: ShowSection;
  label: string;
}) {
  return (
    <Link
      to="/shows/$showId/settings/$section"
      params={{ showId, section }}
      activeProps={{ "data-active": true }}
      className={mobileLinkClassName}
    >
      {label}
    </Link>
  );
}

function MobileGlobalLink({ section, label }: { section: GlobalSection; label: string }) {
  return (
    <Link
      to="/settings/$section"
      params={{ section }}
      activeProps={{ "data-active": true }}
      className={mobileLinkClassName}
    >
      {label}
    </Link>
  );
}
