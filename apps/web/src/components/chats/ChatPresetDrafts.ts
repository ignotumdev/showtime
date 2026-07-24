import { chatPresetPlaceholderNames, type ChatPresetField } from "@showtime/contracts";

export interface ChatPresetFieldDraft {
  readonly name: string;
  readonly type: ChatPresetField["type"];
  readonly options: ReadonlyArray<string>;
}

export const chatPresetFieldDrafts = (
  fields: ReadonlyArray<ChatPresetField>,
): Array<ChatPresetFieldDraft> =>
  fields.map((field) => ({
    name: field.name,
    type: field.type,
    options: field.type === "select" ? field.options : [],
  }));

export const chatPresetDraftsForTemplate = (
  template: string,
  previous: ReadonlyArray<ChatPresetFieldDraft>,
  inheritedNames: ReadonlySet<string> = new Set(),
): Array<ChatPresetFieldDraft> => {
  const previousByName = new Map(previous.map((field) => [field.name, field]));
  return chatPresetPlaceholderNames(template)
    .filter((name) => !inheritedNames.has(name) || previousByName.has(name))
    .map((name) => previousByName.get(name) ?? { name, type: "text", options: [] });
};

export const chatPresetFieldsFromDrafts = (
  drafts: ReadonlyArray<ChatPresetFieldDraft>,
): ReadonlyArray<ChatPresetField> =>
  drafts.map((field) =>
    field.type === "select"
      ? {
          name: field.name,
          type: "select",
          options: field.options.map((option) => option.trim()).filter(Boolean),
        }
      : { name: field.name, type: field.type },
  );
