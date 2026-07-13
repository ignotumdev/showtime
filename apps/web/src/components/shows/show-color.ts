import { colors, type Color } from "@showtime/contracts";
import { colorPreviewClassNames } from "@/components/color";

export const randomShowColor = (): Color => colors[Math.floor(Math.random() * colors.length)];

export const showColorClassNames: Record<Color, string> = colorPreviewClassNames;
