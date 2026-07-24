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
  return chatPresetPlaceholderNames(template).flatMap((name) =>
    !inheritedNames.has(name) || previousByName.has(name)
      ? [previousByName.get(name) ?? { name, type: "text", options: [] }]
      : [],
  );
};

export const chatPresetFieldsFromDrafts = (
  drafts: ReadonlyArray<ChatPresetFieldDraft>,
): ReadonlyArray<ChatPresetField> =>
  drafts.map((field) =>
    field.type === "select"
      ? {
          name: field.name,
          type: "select",
          options: field.options.flatMap((option) => {
            const trimmed = option.trim();
            return trimmed ? [trimmed] : [];
          }),
        }
      : { name: field.name, type: field.type },
  );
