"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Maximize2, Minimize2 } from "lucide-react";

export function TeacherPresentationControls({
  backHref
}: {
  backHref?: string;
}) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    const update = () => setIsFullscreen(Boolean(document.fullscreenElement));
    setIsSupported(
      Boolean(
        document.fullscreenEnabled &&
          document.documentElement.requestFullscreen
      )
    );
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      await document.documentElement.requestFullscreen();
    } catch {
      // Fullscreen is optional; the presentation remains usable without it.
    }
  }

  if (!isSupported && !backHref) return null;

  return (
    <div className="print:hidden flex items-center gap-2">
      {backHref ? (
        <Link
          href={backHref}
          aria-label="Back to classes"
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 text-sm font-semibold text-white/85 backdrop-blur transition hover:bg-white/15 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Classes</span>
        </Link>
      ) : null}
      {isSupported ? (
        <button
          type="button"
          onClick={() => void toggleFullscreen()}
          aria-pressed={isFullscreen}
          aria-label={isFullscreen ? "Exit full screen" : "Enter full screen"}
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 text-sm font-semibold text-white/85 backdrop-blur transition hover:bg-white/15 hover:text-white"
        >
          {isFullscreen ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">
            {isFullscreen ? "Exit full screen" : "Full screen"}
          </span>
        </button>
      ) : null}
    </div>
  );
}
