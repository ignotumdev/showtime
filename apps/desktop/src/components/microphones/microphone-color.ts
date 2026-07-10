import { type Color } from "@showtime/contracts";

export const microphoneColorClassNames: Record<
  Color,
  { readonly background: string; readonly text: string }
> = {
  red: { background: "bg-red-950", text: "text-red-400" },
  orange: { background: "bg-orange-950", text: "text-orange-400" },
  amber: { background: "bg-amber-950", text: "text-amber-400" },
  yellow: { background: "bg-yellow-950", text: "text-yellow-400" },
  lime: { background: "bg-lime-950", text: "text-lime-400" },
  green: { background: "bg-green-950", text: "text-green-400" },
  emerald: { background: "bg-emerald-950", text: "text-emerald-400" },
  teal: { background: "bg-teal-950", text: "text-teal-400" },
  cyan: { background: "bg-cyan-950", text: "text-cyan-400" },
  sky: { background: "bg-sky-950", text: "text-sky-400" },
  blue: { background: "bg-blue-950", text: "text-blue-400" },
  indigo: { background: "bg-indigo-950", text: "text-indigo-400" },
  violet: { background: "bg-violet-950", text: "text-violet-400" },
  purple: { background: "bg-purple-950", text: "text-purple-400" },
  fuchsia: { background: "bg-fuchsia-950", text: "text-fuchsia-400" },
  pink: { background: "bg-pink-950", text: "text-pink-400" },
  rose: { background: "bg-rose-950", text: "text-rose-400" },
  neutral: { background: "bg-neutral-950", text: "text-neutral-400" },
};
