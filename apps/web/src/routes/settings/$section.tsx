import { createFileRoute, Navigate } from "@tanstack/react-router";
import { ProfilesSettings } from "@/components/profiles/ProfileSwitcher";
import { ConnectionsSettings } from "@/components/connections/ConnectionDialog";
import { UpdatesSettings } from "@/components/settings/UpdatesSettings";
import { AppearanceSettings } from "@/components/settings/AppearanceSettings";

export const Route = createFileRoute("/settings/$section")({ component: SettingsSection });

function SettingsSection() {
  const { section } = Route.useParams();
  if (section === "updates") return <UpdatesSettings />;
  if (section === "profiles") return <ProfilesSettings />;
  if (section === "connections") return <ConnectionsSettings />;
  if (section === "appearance") return <AppearanceSettings />;
  return <Navigate to="/settings/$section" params={{ section: "updates" }} replace />;
}
