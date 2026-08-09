import { createFileRoute, Navigate } from "@tanstack/react-router";
import { ChatSettings } from "@/components/settings/ChatSettings";
import { ProfilesSettings } from "@/components/profiles/ProfileSwitcher";
import { ConnectionsSettings } from "@/components/connections/ConnectionDialog";
import { GeneralSettings } from "@/components/settings/GeneralSettings";
import { UpdatesSettings } from "@/components/settings/UpdatesSettings";

export const Route = createFileRoute("/shows/$showId/settings/$section")({
  component: SettingsSection,
});

function SettingsSection() {
  const { showId, section } = Route.useParams();
  if (section === "general") return <GeneralSettings />;
  if (section === "chat") return <ChatSettings />;
  if (section === "updates") return <UpdatesSettings />;
  if (section === "profiles") return <ProfilesSettings />;
  if (section === "connections") return <ConnectionsSettings />;
  return (
    <Navigate
      to="/shows/$showId/settings/$section"
      params={{ showId, section: "general" }}
      replace
    />
  );
}
