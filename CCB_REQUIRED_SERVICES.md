# Required CCB API Services

The CCB API user must be granted each service individually in CCB API administration.

## Required for the complete v1 workflow

### People

```txt
individual_search
individual_profile_from_id
duplicate_individuals_list
create_individual
update_individual
```

### Groups

```txt
group_profiles
group_profile_from_id
group_participants
individual_groups
create_group
update_group
add_individual_to_group
```

### Events and attendance

```txt
event_profiles
event_profile
create_event
attendance_profile
attendance_profiles
create_event_attendance
```

## Intentionally not used

The app blocks destructive CCB operations, including:

```txt
remove_individual_from_group
individual_inactivate
```

Do not grant additional delete/remove/inactivate services unless another separately-reviewed integration requires them.

## Permission test

A successful metadata call should return a service description instead of error 110:

```bash
npm run ccb:describe -- create_group
npm run ccb:describe -- update_group
npm run ccb:describe -- create_event
npm run ccb:describe -- create_event_attendance
npm run ccb:describe -- create_individual
npm run ccb:describe -- update_individual
npm run ccb:describe -- add_individual_to_group
```
