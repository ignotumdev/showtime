import { describe, expect, it } from "vite-plus/test";
import { liveSongNavigationDirection } from "./LiveSongNavigationState";

describe("liveSongNavigationDirection", () => {
  it.each([" ", "ArrowRight", "ArrowUp"])("maps %j to the next song", (key) => {
    expect(liveSongNavigationDirection(key)).toBe("next");
  });

  it.each(["ArrowLeft", "ArrowDown"])("maps %j to the previous song", (key) => {
    expect(liveSongNavigationDirection(key)).toBe("previous");
  });

  it.each(["Enter", "Escape", "Space", "a"])("ignores %j", (key) => {
    expect(liveSongNavigationDirection(key)).toBeUndefined();
  });
});
