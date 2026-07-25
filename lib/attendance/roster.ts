export function buildAttendanceRoster(input: {
  existingCcbIds: Array<string | null | undefined>;
  localCcbIds: Array<string | null | undefined>;
  leaderCcbId?: string | null;
}) {
  return [
    ...new Set(
      [
        ...input.existingCcbIds,
        ...input.localCcbIds,
        input.leaderCcbId
      ]
        .filter((value): value is string => Boolean(value))
        .map(String)
    )
  ];
}
