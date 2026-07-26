"use client";

import { useEffect, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

export function TeacherPresentationControls() {
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

  if (!isSupported) return null;

  return (
    <button
      type="button"
      onClick={() => void toggleFullscreen()}
      aria-pressed={isFullscreen}
      className="print:hidden inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white/85 backdrop-blur transition hover:bg-white/15 hover:text-white"
    >
      {isFullscreen ? (
        <Minimize2 className="h-4 w-4" />
      ) : (
        <Maximize2 className="h-4 w-4" />
      )}
      {isFullscreen ? "Exit full screen" : "Full screen"}
    </button>
  );
}
