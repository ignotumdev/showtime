import type { ShowtimeDesktopUpdateState } from "@showtime/shared";
import desktopPackage from "../../../../desktop/package.json";
import { SettingsHeader, SettingsItem, SettingsSection } from "@/components/settings/SettingsPage";
import {
  DesktopUpdateDialog,
  useDesktopUpdateState,
} from "@/components/updates/DesktopUpdateDialog";

export function UpdatesSettings() {
  const { bridge, state } = useDesktopUpdateState();
  const currentVersion = state?.currentVersion ?? desktopPackage.version;
  const displayVersion = formatVersion(currentVersion);

  return (
    <div className="space-y-6">
      <SettingsHeader>Updates</SettingsHeader>
      <SettingsSection>
        <SettingsItem
          title="Version"
          action={<span className="text-sm text-muted-foreground">{displayVersion}</span>}
        />
        <SettingsItem
          title="Updates"
          description={updateDescription(state)}
          action={bridge ? <DesktopUpdateDialog showIdle /> : undefined}
        />
      </SettingsSection>
    </div>
  );
}

const formatVersion = (version: string): string => version.replace(/^v/i, "");

const updateDescription = (state: ShowtimeDesktopUpdateState | undefined): string => {
  if (!state) return "Updates are managed by the installed Showtime application.";
  switch (state.kind) {
    case "unsupported":
      return "Automatic updates are unavailable on this platform.";
    case "checking":
      return "Checking for a newer version of Showtime.";
    case "up-to-date":
      return "Showtime is up to date.";
    case "available":
      return `Version ${formatVersion(state.version)} is available to download.`;
    case "downloading":
      return `Downloading version ${formatVersion(state.version)}: ${Math.round(state.percent)}%.`;
    case "ready":
      return `Version ${formatVersion(state.version)} is ready to install.`;
    case "blocked-live":
      return "The update is paused while a show is Live.";
    case "error":
    case "recovery-required":
      return state.message;
  }
};
