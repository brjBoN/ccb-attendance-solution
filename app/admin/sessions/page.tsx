import type { Metadata } from "next";
import { AdminSessionsManager } from "@/components/admin-sessions-manager";

export const metadata: Metadata = {
  title: "Class Check-In"
};

export default function AdminSessionsPage() {
  return (
    <div className="mx-auto max-w-[1240px]">
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#167365]">
            Attendance
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em] text-[#18332d] sm:text-5xl">
            Class check-in
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-[#667670]">
            Each class has one reusable QR code. Open a meeting when it is time
            to take attendance—the same printed code works every week.
          </p>
        </div>
        <div className="w-fit rounded-2xl border border-[#cfe3dc] bg-[#e7f4ef] px-4 py-3 text-sm text-[#285b50]">
          <strong className="block text-[#174b41]">New attendance model</strong>
          No more meeting-by-meeting QR codes.
        </div>
      </div>

      <AdminSessionsManager />
    </div>
  );
}
