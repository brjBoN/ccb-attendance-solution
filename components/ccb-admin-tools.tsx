"use client";

import { FormEvent, useState, useTransition } from "react";

export function CcbAdminTools() {
  const [describeService, setDescribeService] = useState("individual_search");
  const [firstName, setFirstName] = useState("John");
  const [lastName, setLastName] = useState("Smith");
  const [output, setOutput] = useState<string>("No request run yet.");
  const [isPending, startTransition] = useTransition();

  function runDescribe() {
    startTransition(async () => {
      setOutput("Loading describe_api...");
      const response = await fetch(
        `/api/admin/ccb/describe?service=${encodeURIComponent(describeService)}`
      );
      const data = await response.json();
      setOutput(JSON.stringify(data, null, 2));
    });
  }

  function runSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    startTransition(async () => {
      setOutput("Searching individuals...");
      const response = await fetch("/api/admin/ccb/individuals/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ firstName, lastName })
      });
      const data = await response.json();
      setOutput(JSON.stringify(data, null, 2));
    });
  }

  function runList(kind: "groups" | "events") {
    startTransition(async () => {
      setOutput(`Loading ${kind}...`);
      const response = await fetch(`/api/admin/ccb/${kind}`);
      const data = await response.json();
      setOutput(JSON.stringify(data, null, 2));
    });
  }

  return (
    <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">CCB read-only tools</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        These call internal admin-only API routes. Results may include real CCB data,
        so do not screenshot or paste sensitive output into public places.
      </p>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-4">
          <label className="block text-sm font-medium text-slate-700">
            describe_api service
          </label>
          <div className="mt-2 flex gap-2">
            <input
              value={describeService}
              onChange={(event) => setDescribeService(event.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
            />
            <button
              type="button"
              onClick={runDescribe}
              disabled={isPending}
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              Describe
            </button>
          </div>
        </div>

        <form onSubmit={runSearch} className="rounded-xl border border-slate-200 p-4">
          <p className="text-sm font-medium text-slate-700">Search individuals</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <input
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              placeholder="First"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
            />
            <input
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              placeholder="Last"
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none ring-brand-500 focus:ring-2"
            />
          </div>
          <button
            disabled={isPending}
            className="mt-3 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Search
          </button>
        </form>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => runList("groups")}
          disabled={isPending}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          List groups
        </button>
        <button
          type="button"
          onClick={() => runList("events")}
          disabled={isPending}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          List events
        </button>
      </div>

      <pre className="mt-5 max-h-96 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
        {output}
      </pre>
    </div>
  );
}
