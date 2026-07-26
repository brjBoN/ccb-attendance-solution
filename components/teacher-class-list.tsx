"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Search,
  SearchX,
  X
} from "lucide-react";
import {
  filterTeacherClasses,
  normalizeClassSearch
} from "@/lib/teacher/class-search";
import type { TeacherClass } from "@/lib/teacher/classes";

export function TeacherClassList({ classes }: { classes: TeacherClass[] }) {
  const [query, setQuery] = useState("");
  const filteredClasses = useMemo(
    () => filterTeacherClasses(classes, query),
    [classes, query]
  );
  const hasQuery = Boolean(normalizeClassSearch(query));

  return (
    <>
      <div className="sticky top-0 z-10 -mx-4 border-y border-[#dce7f1] bg-[#f4f8fc]/95 px-4 py-3 backdrop-blur-xl sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
        <label className="relative block">
          <span className="sr-only">Search your classes</span>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#6a7c91]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            type="search"
            inputMode="search"
            autoComplete="off"
            placeholder="Search your classes"
            className="teacher-class-search h-14 w-full rounded-2xl border border-[#cbd9e7] bg-white pl-12 pr-12 text-base font-medium text-[#0b1f3a] shadow-[0_10px_28px_rgba(7,31,63,0.06)] outline-none transition placeholder:font-normal placeholder:text-[#91a0b0] focus:border-[#3c8cff] focus:ring-4 focus:ring-[#b9d6ff]/40"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear class search"
              className="absolute right-2.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[#66798d] transition hover:bg-[#eef6ff]"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </label>
      </div>

      <div className="mb-3 mt-5 flex items-center justify-between gap-4">
        <p className="text-sm font-semibold text-[#36506c]">
          {hasQuery
            ? `${filteredClasses.length} matching ${
                filteredClasses.length === 1 ? "class" : "classes"
              }`
            : `${classes.length} ${
                classes.length === 1 ? "class" : "classes"
              } available`}
        </p>
        {hasQuery ? (
          <p className="max-w-[55%] truncate text-xs text-[#7a8b9d]">
            Results contain “{query.trim()}”
          </p>
        ) : null}
      </div>

      {filteredClasses.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredClasses.map((classItem) => (
            <Link
              key={classItem.id}
              href={classItem.presentationHref}
              className="group overflow-hidden rounded-[26px] border border-[#d7e2ee] bg-white shadow-[0_14px_38px_rgba(7,31,63,0.07)] transition active:scale-[0.99] sm:hover:-translate-y-0.5 sm:hover:border-[#aac4df] sm:hover:shadow-[0_20px_46px_rgba(7,31,63,0.11)]"
            >
              <div className="relative aspect-[16/8.5] overflow-hidden bg-[#071f3f]">
                <Image
                  src={classItem.imageUrl}
                  alt=""
                  fill
                  unoptimized
                  sizes="(min-width: 1280px) 31vw, (min-width: 640px) 48vw, 100vw"
                  className="scale-105 object-cover opacity-45 blur-xl transition duration-500 group-hover:scale-110"
                />
                <Image
                  src={classItem.imageUrl}
                  alt={`Group picture for ${classItem.name}`}
                  fill
                  unoptimized
                  sizes="(min-width: 1280px) 31vw, (min-width: 640px) 48vw, 100vw"
                  className="object-contain"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent"
                />
              </div>

              <div className="p-5">
                <h2 className="text-xl font-semibold leading-tight tracking-[-0.025em] text-[#0b1f3a]">
                  {classItem.name}
                </h2>

                <div className="mt-3 flex min-h-11 items-start gap-2 text-sm leading-5 text-[#64778a]">
                  <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-[#0866ff]" />
                  {classItem.schedule.length ? (
                    <div>
                      {classItem.schedule.slice(0, 2).map((slot) => (
                        <p key={`${slot.dayName}-${slot.meetingTime}`}>
                          {slot.dayName} · {slot.meetingTime}
                        </p>
                      ))}
                      {classItem.schedule.length > 2 ? (
                        <p className="text-xs text-[#7a8b9d]">
                          +{classItem.schedule.length - 2} more meeting time
                          {classItem.schedule.length - 2 === 1 ? "" : "s"}
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <p>Meeting time has not been set</p>
                  )}
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-[#e2ebf4] pt-4">
                  <span className="text-sm font-bold text-[#0754d6]">
                    Show check-in code
                  </span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eaf4ff] text-[#0754d6] transition group-hover:translate-x-1 group-hover:bg-[#d9eaff]">
                    <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-[26px] border border-dashed border-[#cbd9e7] bg-white/65 px-6 py-14 text-center">
          <SearchX className="mx-auto h-9 w-9 text-[#7a8b9d]" />
          <h2 className="mt-4 text-lg font-semibold text-[#17304d]">
            No class matches “{query.trim()}”
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#6a7c91]">
            Try a shorter part of the class name.
          </p>
          <button
            type="button"
            onClick={() => setQuery("")}
            className="mt-5 rounded-xl bg-[#0866ff] px-4 py-2.5 text-sm font-semibold text-white"
          >
            Clear search
          </button>
        </div>
      )}
    </>
  );
}
