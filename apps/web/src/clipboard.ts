type ClipboardWriter = Pick<Clipboard, "writeText">;

export const copyText = async (
  value: string,
  clipboard: ClipboardWriter | undefined = navigator.clipboard,
  documentRef: Document = document,
) => {
  if (clipboard) {
    try {
      await clipboard.writeText(value);
      return;
    } catch {
      // Plain-HTTP local sites may not receive Clipboard API access.
    }
  }

  const textarea = documentRef.createElement("textarea");
  textarea.value = value;
  textarea.readOnly = true;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  documentRef.body.append(textarea);
  let copied = false;
  try {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, value.length);
    copied = documentRef.execCommand("copy");
  } finally {
    textarea.remove();
  }
  if (!copied) throw new Error("Copy is unavailable");
};
