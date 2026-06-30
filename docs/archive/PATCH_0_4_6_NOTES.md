# Patch 0.4.6 — Fix Missing `main_leader_id` on CCB Group Creation

Symptom:

```txt
The required parameter main_leader_id is missing
```

The UI had the main leader ID, but `create_group` was being sent as a `POST` request with parameters in the request body. CCB appears to ignore the body for this service, so it received `srv=create_group` but not the other parameters.

## Changed

`lib/ccb/client.ts`

```ts
await this.requestParsed({
  service: "create_group",
  allowWrite: true,
  params
});
```

Instead of:

```ts
await this.requestParsed({
  service: "create_group",
  method: "POST",
  allowWrite: true,
  params
});
```

This sends `main_leader_id` and all other group fields in the query string, matching the rest of the CCB API pattern used by this app.

## No migration

No SQL migration is required.
