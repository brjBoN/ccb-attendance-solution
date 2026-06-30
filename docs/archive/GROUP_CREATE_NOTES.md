# Group Create Patch — Real CCB Group Creation

This patch adds an admin workflow for creating a real CCB group through the CCB `create_group` API.

## Safety flags

Creating a group in CCB now requires only:

```env
CCB_ENABLE_GROUP_CREATE=true
```

If `CCB_ENABLE_GROUP_CREATE=false`, the form is visible but the API route refuses to create the group. If the variable is omitted, group creation defaults to enabled.

## Required CCB fields

The documented CCB `create_group` API requires:

- `name`
- `campus_id`
- `main_leader_id`

The app includes a leader search helper so you can find the CCB individual ID for the main leader.

## Supported CCB API fields

The form submits the documented create_group API fields:

- name
- campus_id
- main_leader_id
- description
- group_type_id
- department_id
- area_id
- group_capacity
- meeting_location_street_address
- meeting_location_city
- meeting_location_state
- meeting_location_zip
- meeting_day_id
- meeting_time_id
- childcare_provided
- interaction_type
- membership_type
- listed
- public_search_listed
- udf_group_pulldown_1_id
- udf_group_pulldown_2_id
- udf_group_pulldown_3_id

## CCB web-form fields not supported by create_group

The uploaded CCB HTML references include additional web UI settings such as photo upload,
public form, member privileges, participant communication defaults, leader privileges, approval
group, inactive flag, age range, and attendance groupings.

The public `create_group` API documentation does not list those fields as create-time parameters.
The app still displays/captures those values as local metadata so they can be reviewed, but they are
not submitted to CCB until/unless a supported API endpoint for those settings is confirmed.

## SQL

Run:

```txt
supabase/migrations/0004_group_create_logs.sql
```

This adds a local audit/log table for group creation attempts.


## Patch 0.4.3

Group creation no longer requires `CCB_ENABLE_WRITES=true`. The `create_group` API call is controlled by `CCB_ENABLE_GROUP_CREATE`, which defaults to `true` in this build. Attendance writes, person creation, and add-to-group remain separately gated.
