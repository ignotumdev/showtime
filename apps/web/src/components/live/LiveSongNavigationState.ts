export type LiveSongNavigationDirection = "previous" | "next";

export function liveSongNavigationDirection(key: string): LiveSongNavigationDirection | undefined {
  switch (key) {
    case "ArrowLeft":
    case "ArrowDown":
      return "previous";
    case " ":
    case "ArrowRight":
    case "ArrowUp":
      return "next";
    default:
      return undefined;
  }
}
