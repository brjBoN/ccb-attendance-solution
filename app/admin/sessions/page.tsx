import type { Metadata } from "next";
import { AdminSessionsManager } from "@/components/admin-sessions-manager";

export const metadata: Metadata = {
  title: "Class Schedules"
};

export default function AdminSessionsPage() {
  return (
    <div className="mx-auto max-w-[1240px]">
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#0866ff]">
            Attendance
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em] text-[#0b1f3a] sm:text-5xl">
            Class schedules
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[#5f7187]">
            Set the weekly times each class meets. Attendance opens
            automatically, and leaders can add one-time exceptions when plans
            change.
          </p>
        </div>
        <div className="w-fit rounded-2xl border border-[#b9d6ff] bg-[#eaf4ff] px-4 py-3 text-sm text-[#2b567d]">
          <strong className="block text-[#173e68]">Eastern Time</strong>
          30-minute check-in window on both sides.
        </div>
      </div>

      <AdminSessionsManager />
    </div>
  );
}
