import { type Color } from "@showtime/contracts";

export const microphoneColorClassNames: Record<
  Color,
  { readonly background: string; readonly border: string; readonly text: string }
> = {
  red: { background: "bg-red-950", border: "border-red-400", text: "text-red-400" },
  orange: { background: "bg-orange-950", border: "border-orange-400", text: "text-orange-400" },
  amber: { background: "bg-amber-950", border: "border-amber-400", text: "text-amber-400" },
  yellow: { background: "bg-yellow-950", border: "border-yellow-400", text: "text-yellow-400" },
  lime: { background: "bg-lime-950", border: "border-lime-400", text: "text-lime-400" },
  green: { background: "bg-green-950", border: "border-green-400", text: "text-green-400" },
  emerald: { background: "bg-emerald-950", border: "border-emerald-400", text: "text-emerald-400" },
  teal: { background: "bg-teal-950", border: "border-teal-400", text: "text-teal-400" },
  cyan: { background: "bg-cyan-950", border: "border-cyan-400", text: "text-cyan-400" },
  sky: { background: "bg-sky-950", border: "border-sky-400", text: "text-sky-400" },
  blue: { background: "bg-blue-950", border: "border-blue-400", text: "text-blue-400" },
  indigo: { background: "bg-indigo-950", border: "border-indigo-400", text: "text-indigo-400" },
  violet: { background: "bg-violet-950", border: "border-violet-400", text: "text-violet-400" },
  purple: { background: "bg-purple-950", border: "border-purple-400", text: "text-purple-400" },
  fuchsia: { background: "bg-fuchsia-950", border: "border-fuchsia-400", text: "text-fuchsia-400" },
  pink: { background: "bg-pink-950", border: "border-pink-400", text: "text-pink-400" },
  rose: { background: "bg-rose-950", border: "border-rose-400", text: "text-rose-400" },
  neutral: { background: "bg-neutral-950", border: "border-neutral-400", text: "text-neutral-400" },
};
