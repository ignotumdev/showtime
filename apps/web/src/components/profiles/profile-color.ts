import type { Color } from "@showtime/contracts";

export const profileColorClassNames: Record<
  Color,
  { readonly background: string; readonly border: string; readonly text: string }
> = {
  red: { background: "bg-red-600", border: "border-red-500", text: "text-red-50" },
  orange: { background: "bg-orange-600", border: "border-orange-500", text: "text-orange-50" },
  amber: { background: "bg-amber-600", border: "border-amber-500", text: "text-amber-50" },
  yellow: { background: "bg-yellow-600", border: "border-yellow-500", text: "text-yellow-50" },
  lime: { background: "bg-lime-600", border: "border-lime-500", text: "text-lime-50" },
  green: { background: "bg-green-600", border: "border-green-500", text: "text-green-50" },
  emerald: {
    background: "bg-emerald-600",
    border: "border-emerald-500",
    text: "text-emerald-50",
  },
  teal: { background: "bg-teal-600", border: "border-teal-500", text: "text-teal-50" },
  cyan: { background: "bg-cyan-600", border: "border-cyan-500", text: "text-cyan-50" },
  sky: { background: "bg-sky-600", border: "border-sky-500", text: "text-sky-50" },
  blue: { background: "bg-blue-600", border: "border-blue-500", text: "text-blue-50" },
  indigo: { background: "bg-indigo-600", border: "border-indigo-500", text: "text-indigo-50" },
  violet: { background: "bg-violet-600", border: "border-violet-500", text: "text-violet-50" },
  purple: { background: "bg-purple-600", border: "border-purple-500", text: "text-purple-50" },
  fuchsia: {
    background: "bg-fuchsia-600",
    border: "border-fuchsia-500",
    text: "text-fuchsia-50",
  },
  pink: { background: "bg-pink-600", border: "border-pink-500", text: "text-pink-50" },
  rose: { background: "bg-rose-600", border: "border-rose-500", text: "text-rose-50" },
  neutral: {
    background: "bg-neutral-600",
    border: "border-neutral-500",
    text: "text-neutral-50",
  },
};
