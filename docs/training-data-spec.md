# GG Training Data Specification

Status: approved product direction; implementation is staged after tenancy foundation.

## Purpose

Training Grounds record real-world football training and workouts. They do not simulate exercise or automatically alter competitive player ratings.

Two workflows are supported:
- individual workouts
- organised team training and drills

## Privacy

Individual training logs default to private.

Visibility values:
- private: visible only to the player/account owner
- club: visible to authorised members of the selected Club, subject to membership checks
- world: visible to active members of the World

A training session may expose attendance/completion to its organiser without exposing private exercise metrics or personal notes.

Captains do not automatically receive access to private workouts. The player explicitly chooses what to share.

All reads and writes must be World-scoped and must verify the requesting account's membership and relationship to the record.

## Individual training log

Conceptual fields:
- worldId
- playerId (optional until profile linked)
- userId
- clubId (optional)
- performedAt
- category
- exerciseKey / exerciseName
- durationMinutes
- typed metrics
- notes
- visibility
- optional MediaAsset references

Training logs should record the actor/account separately from the in-World Player reference.

## Metric design

Metrics are exercise-specific and unit-labelled. Avoid one ambiguous generic number field.

Possible metrics:
- sets
- repetitions
- durationSeconds
- distanceMeters
- sprintCount
- weightKg
- completedRepetitions
- perceivedEffort (optional and validated)

Only relevant metrics should be set for a given exercise. Validation and exercise catalogues belong in a training service, not directly in a UI component.

## Team training programme

A programme is a reusable set of training objectives/drills with:
- worldId
- creator account
- optional Club
- title and description
- category
- start/end date
- status
- visibility

## Team training session

A session is a scheduled instance of team training:
- worldId
- programme reference, if any
- organiser account
- optional Club
- scheduledAt and timezone context
- duration
- drill plan
- participant/completion policy
- status (scheduled, completed, cancelled)

Attendance/completion should be recorded independently from private individual metrics.

## Competitive integrity

Training records do not directly alter:
- match ratings
- defensive ratings
- GG rating
- OVR
- match result
- Club wallet or auction balances

Cosmetic rewards may be granted for genuine participation or community milestones. They must not create competitive player-stat advantages.

## Retention and export

Training logs are canonical GG records. Optional exports/backups to Google Drive do not replace GG storage and are never required for core training functionality.

Deletion, retention and user export policies must be defined before public launch, especially for photos, health-adjacent fitness measurements and account deletion.
