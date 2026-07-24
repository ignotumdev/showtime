import {
  resolveChatPresetTemplate,
  type ChatMessagePart,
  type ChatPresetAnswer,
  type ChatPresetField,
  type Microphone,
  type Mix,
} from "@showtime/contracts";

type TemplateDefinition = Pick<ChatPresetAnswer, "template" | "fields" | "context">;

export const chatPresetOptionsUseButtons = (options: ReadonlyArray<string>) => options.length < 5;

export const readableChatPresetFieldName = (name: string) =>
  name.replace(/[-_]+/g, " ").replace(/^./, (letter: string) => letter.toUpperCase());

export function initialChatPresetValues(
  fields: ReadonlyArray<ChatPresetField>,
  microphones: ReadonlyArray<Microphone>,
  mixes: ReadonlyArray<Mix>,
) {
  return Object.fromEntries(
    fields.map((field) => [
      field.name,
      field.type === "microphone"
        ? (microphones[0]?.id ?? "")
        : field.type === "mix"
          ? (mixes[0]?.id ?? "")
          : field.type === "select"
            ? (field.options[0] ?? "")
            : "",
    ]),
  );
}

export function resolveChatPresetDefinition(
  definition: TemplateDefinition,
  values: Readonly<Record<string, string>>,
  microphones: ReadonlyArray<Microphone>,
  mixes: ReadonlyArray<Mix>,
) {
  const parts = new Map<string, ChatMessagePart>(
    definition.context?.map((item) => [item.name, item.part]),
  );
  const microphonesById = new Map(microphones.map((microphone) => [microphone.id, microphone]));
  const mixesById = new Map(mixes.map((mix) => [mix.id, mix]));
  for (const field of definition.fields) {
    const value = values[field.name]?.trim() ?? "";
    if (!value) return undefined;
    if (field.type === "microphone") {
      const microphone = microphonesById.get(value as Microphone["id"]);
      if (!microphone) return undefined;
      parts.set(field.name, {
        type: "microphone",
        id: microphone.id,
        number: microphone.number,
        color: microphone.color,
        ...(microphone.name ? { name: microphone.name } : {}),
        text: `Mic ${microphone.number}${microphone.name ? ` (${microphone.name})` : ""}`,
      });
    } else if (field.type === "mix") {
      const mix = mixesById.get(value as Mix["id"]);
      if (!mix) return undefined;
      parts.set(field.name, {
        type: "mix",
        id: mix.id,
        number: mix.number,
        color: mix.color,
        ...(mix.name ? { name: mix.name } : {}),
        text: `Mix ${mix.number}${mix.name ? ` (${mix.name})` : ""}`,
      });
    } else {
      parts.set(field.name, { type: "text", text: value });
    }
  }
  const resolved = resolveChatPresetTemplate(definition.template, parts);
  return resolved ? { ...resolved, values: parts } : undefined;
}
