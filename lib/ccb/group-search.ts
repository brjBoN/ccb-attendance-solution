import type { CcbGroup } from "@/lib/ccb/types";

export type RankedCcbGroup = {
  group: CcbGroup;
  matchReason: "Group name" | "Leader" | "Group type" | "Campus" | "Description";
  score: number;
};

export function rankCcbGroups(groups: CcbGroup[], rawQuery: string) {
  const query = normalize(rawQuery);

  if (!query) {
    return groups
      .map((group) => ({
        group,
        matchReason: "Group name" as const,
        score: 0
      }))
      .sort(compareRankedGroups);
  }

  return groups
    .flatMap((group) => {
      const ranked = rankGroup(group, query);
      return ranked ? [ranked] : [];
    })
    .sort(compareRankedGroups);
}

function rankGroup(group: CcbGroup, query: string): RankedCcbGroup | null {
  const name = normalize(group.name);
  if (name === query) return { group, matchReason: "Group name", score: 0 };
  if (name.startsWith(query)) return { group, matchReason: "Group name", score: 1 };
  if (name.split(/\s+/).some((word) => word.startsWith(query))) {
    return { group, matchReason: "Group name", score: 2 };
  }
  if (name.includes(query)) return { group, matchReason: "Group name", score: 3 };

  const secondary = [
    ["Leader", group.leaderName, 10],
    ["Group type", group.groupType, 11],
    ["Campus", group.campus, 12],
    ["Description", group.description, 13]
  ] as const;

  for (const [matchReason, value, score] of secondary) {
    if (normalize(value).includes(query)) {
      return { group, matchReason, score };
    }
  }

  return null;
}

function compareRankedGroups(left: RankedCcbGroup, right: RankedCcbGroup) {
  return (
    left.score - right.score ||
    String(left.group.name ?? "").localeCompare(String(right.group.name ?? ""), undefined, {
      sensitivity: "base"
    })
  );
}

function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}
