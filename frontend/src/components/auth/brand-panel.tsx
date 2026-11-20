"use client";

import { CheckIcon, GaugeIcon, ShieldCheckIcon, ZapIcon } from "lucide-react";
import dynamic from "next/dynamic";

import { BrandMark } from "@/components/layout/brand";

// WebGPU-only and browser-only: load on the client, and only on the auth pages.
const AuthShader = dynamic(() => import("./auth-shader"), { ssr: false });

const POINTS = [
  { icon: ShieldCheckIcon, text: "Admin and member roles, enforced by the API" },
  { icon: GaugeIcon, text: "Live metrics: overdue, due this week, completion" },
  { icon: ZapIcon, text: "Filters, search and one-click status updates" },
];

const PREVIEW_TASKS = [
  { title: "Build dashboard summary metrics", status: "Done", dot: "bg-emerald-400", done: true },
  { title: "Add caching layer for summary metrics", status: "In review", dot: "bg-amber-400" },
  { title: "Instrument API with OpenTelemetry", status: "In progress", dot: "bg-sky-400" },
];

/** Decorative right-hand panel on login/register (large screens only). */
export function BrandPanel() {
  return (
    <div className="relative isolate flex h-full flex-col justify-between overflow-hidden rounded-2xl bg-[#1e1b4b] p-10 text-white">
      {/* Static fallback (no WebGPU / reduced motion), then the shader on top. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-20 bg-[radial-gradient(60%_50%_at_80%_10%,#7c3aed_0%,transparent_60%),radial-gradient(70%_60%_at_10%_90%,#4f46e5_0%,transparent_65%),linear-gradient(160deg,#1e1b4b,#312e81)]"
      />
      <div aria-hidden className="absolute inset-0 -z-10">
        <AuthShader />
      </div>
      {/* Faint dot texture + bottom fade for text contrast. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 [background-image:radial-gradient(rgb(255_255_255/0.12)_1px,transparent_1px)] [background-size:18px_18px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
      />
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-1/2 bg-gradient-to-t from-black/40" />

      <div className="flex items-center gap-2 font-semibold">
        <BrandMark className="bg-white text-indigo-600" />
        Sprint Tracker
      </div>

      <div className="grid max-w-md gap-8">
        <div className="grid gap-3">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight text-balance">
            Plan sprints. Ship on time.
          </h2>
          <p className="text-base text-white/70">
            One calm place for your team&apos;s tasks, owners and deadlines.
          </p>
        </div>

        {/* Static product preview: shows what's inside without needing a screenshot. */}
        <div className="grid gap-3 rounded-xl border border-white/15 bg-white/10 p-4 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Sprint 3 · Insights</span>
            <span className="text-white/60 tabular-nums">6 days left</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
            <div className="h-full w-[68%] rounded-full bg-white" />
          </div>
          <ul className="grid gap-2 pt-1">
            {PREVIEW_TASKS.map((task) => (
              <li
                key={task.title}
                className="flex items-center justify-between gap-3 rounded-lg bg-black/15 px-3 py-2 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  {task.done ? (
                    <CheckIcon className="size-3.5 shrink-0 text-emerald-300" />
                  ) : (
                    <span className={`size-2 shrink-0 rounded-full ${task.dot}`} />
                  )}
                  <span className={`truncate ${task.done ? "text-white/60 line-through" : ""}`}>
                    {task.title}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-white/60">{task.status}</span>
              </li>
            ))}
          </ul>
        </div>

        <ul className="grid gap-2.5 text-sm text-white/80">
          {POINTS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-2.5">
              <span className="grid size-6 place-items-center rounded-md bg-white/10">
                <Icon className="size-3.5" />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-white/50">Team Task &amp; Sprint Tracker</p>
    </div>
  );
}
