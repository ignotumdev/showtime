import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SettingsHeader, SettingsItem, SettingsSection } from "@/components/settings/SettingsPage";
import {
  isThemePreference,
  setThemePreference,
  type ThemePreference,
  useThemePreference,
} from "@/theme";

const themeLabels: Record<ThemePreference, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

export function AppearanceSettings() {
  const theme = useThemePreference();

  return (
    <div className="space-y-6">
      <SettingsHeader>Appearance</SettingsHeader>
      <SettingsSection>
        <SettingsItem
          title="Theme"
          description="Choose how Showtime looks on this device."
          action={
            <div className="w-32">
              <Select
                value={theme}
                onValueChange={(value) => {
                  if (isThemePreference(value)) setThemePreference(value);
                }}
              >
                <SelectTrigger aria-label="Theme">
                  <SelectValue>{themeLabels[theme]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">System</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
        />
      </SettingsSection>
    </div>
  );
}
