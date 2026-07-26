import { describe, expect, it } from "vitest";
import {
  filterTeacherClasses,
  normalizeClassSearch
} from "@/lib/teacher/class-search";

const classes = [
  { name: "Young Adults" },
  { name: "Discover - Summer 2026" },
  { name: "Marriage Class" },
  { name: "Discover Heritage" }
];

describe("teacher class search", () => {
  it("returns only class names that contain the query", () => {
    expect(filterTeacherClasses(classes, "discover")).toEqual([
      { name: "Discover - Summer 2026" },
      { name: "Discover Heritage" }
    ]);
  });

  it("matches punctuation, spacing, and letter case consistently", () => {
    expect(normalizeClassSearch("  DISCOVER—Summer  ")).toBe(
      "discover summer"
    );
    expect(filterTeacherClasses(classes, "summer 2026")).toEqual([
      { name: "Discover - Summer 2026" }
    ]);
  });

  it("puts prefix matches before later matches", () => {
    const results = filterTeacherClasses(
      [{ name: "The Discover Class" }, { name: "Discover Heritage" }],
      "discover"
    );
    expect(results.map((item) => item.name)).toEqual([
      "Discover Heritage",
      "The Discover Class"
    ]);
  });
});
