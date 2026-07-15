const editableSelector = "input, textarea, [contenteditable='true']";

const scrollFocusedControlIntoView = () => {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !active.matches(editableSelector)) return;
  active.scrollIntoView({ block: "nearest", inline: "nearest" });
};

/**
 * Keeps the application inside the visual viewport when a mobile keyboard is open.
 * Dynamic viewport units still follow the layout viewport on some Safari versions,
 * so the Visual Viewport API is used as the authoritative size when available.
 */
export const installMobileViewport = () => {
  const viewport = window.visualViewport;
  let frame: number | undefined;

  const update = () => {
    frame = undefined;
    // Preserve intentional pinch zoom. Input controls stay at 16px, which prevents
    // the involuntary focus zoom this workaround is intended to avoid.
    if (viewport && viewport.scale <= 1.01) {
      document.documentElement.style.setProperty("--app-height", `${viewport.height}px`);
      document.documentElement.style.setProperty("--app-offset-top", `${viewport.offsetTop}px`);
      document.documentElement.style.setProperty(
        "--app-offset-bottom",
        `${Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)}px`,
      );
    } else if (!viewport) {
      document.documentElement.style.setProperty("--app-height", `${window.innerHeight}px`);
      document.documentElement.style.setProperty("--app-offset-top", "0px");
      document.documentElement.style.setProperty("--app-offset-bottom", "0px");
    }
    scrollFocusedControlIntoView();
  };

  const scheduleUpdate = () => {
    if (frame !== undefined) return;
    frame = window.requestAnimationFrame(update);
  };

  scheduleUpdate();
  viewport?.addEventListener("resize", scheduleUpdate, { passive: true });
  viewport?.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", scheduleUpdate, { passive: true });
  window.addEventListener("orientationchange", scheduleUpdate, { passive: true });
  document.addEventListener("focusin", () => {
    scheduleUpdate();
    window.setTimeout(scrollFocusedControlIntoView, 250);
  });
};
