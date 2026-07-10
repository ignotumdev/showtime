import { showColors, type ShowColor } from "@showtime/contracts";

export const randomShowColor = (): ShowColor =>
  showColors[Math.floor(Math.random() * showColors.length)] ?? "sky";

export const showColorClassNames: Record<ShowColor, string> = {
  red: "bg-red-500",
  orange: "bg-orange-500",
  amber: "bg-amber-500",
  yellow: "bg-yellow-500",
  lime: "bg-lime-500",
  green: "bg-green-500",
  emerald: "bg-emerald-500",
  teal: "bg-teal-500",
  cyan: "bg-cyan-500",
  sky: "bg-sky-500",
  blue: "bg-blue-500",
  indigo: "bg-indigo-500",
  violet: "bg-violet-500",
  purple: "bg-purple-500",
  fuchsia: "bg-fuchsia-500",
  pink: "bg-pink-500",
  rose: "bg-rose-500",
  neutral: "bg-neutral-500",
};

export const microphoneColorClassNames: Record<
  ShowColor,
  { readonly background: string; readonly text: string }
> = {
  red: { background: "bg-red-800", text: "text-red-300" },
  orange: { background: "bg-orange-800", text: "text-orange-300" },
  amber: { background: "bg-amber-800", text: "text-amber-300" },
  yellow: { background: "bg-yellow-800", text: "text-yellow-300" },
  lime: { background: "bg-lime-800", text: "text-lime-300" },
  green: { background: "bg-green-800", text: "text-green-300" },
  emerald: { background: "bg-emerald-800", text: "text-emerald-300" },
  teal: { background: "bg-teal-800", text: "text-teal-300" },
  cyan: { background: "bg-cyan-800", text: "text-cyan-300" },
  sky: { background: "bg-sky-800", text: "text-sky-300" },
  blue: { background: "bg-blue-800", text: "text-blue-300" },
  indigo: { background: "bg-indigo-800", text: "text-indigo-300" },
  violet: { background: "bg-violet-800", text: "text-violet-300" },
  purple: { background: "bg-purple-800", text: "text-purple-300" },
  fuchsia: { background: "bg-fuchsia-800", text: "text-fuchsia-300" },
  pink: { background: "bg-pink-800", text: "text-pink-300" },
  rose: { background: "bg-rose-800", text: "text-rose-300" },
  neutral: { background: "bg-neutral-800", text: "text-neutral-300" },
};
