# Amino: Design Spec

Date: 2026-11-04
Status: Draft, awaiting user review

## 1. Purpose

Amino is a workout tracker. The user schedules workouts, marks them done, and views a 3D body on which the muscles they trained glow red to signal possible soreness. The red fades to nothing over 48 hours, the assumed recovery time.

Theme: monochrome. Red is the only non-grey colour and is reserved for soreness.

### Decisions made with the user

- Stack: React, Three.js (via React Three Fiber), Motion, Tailwind CSS on the frontend; Express in TypeScript on the backend.
- Single user for now, but multi-user ready (every row carries `user_id`; auth lives behind one middleware seam).
- Database: PostgreSQL hosted on Neon. Drizzle ORM.
- 3D body: procedural, stylized, built in code from per-muscle primitives. Replaceable later by a glTF behind the same interface.
- A workout is a date plus exercises chosen from a built-in library. Each exercise maps to primary and secondary muscles. Sets, reps and weight are optional fields.
- Scalability and maintainability take priority over speed of first delivery.

### Assumptions (open to correction)

- Primary muscles count at intensity 1.0, secondary at 0.5.
- Overlapping workouts combine by taking the maximum, capped at 1.
- Soreness is computed from the completion time, never stored, so no background job is needed.
- Recovery window is a fixed 48 hours for every muscle in v1.

### Out of scope for v1

Accounts and login, custom exercises, per-set logging during a session, per-muscle recovery times, recurring workout schedules, notifications, a glTF anatomy model, end-to-end browser tests.

## 2. Repository layout

npm workspaces monorepo (pnpm is not installed on the target machine; npm needs no extra setup).

```
amino/
  apps/
    web/            React + Vite + Tailwind + Motion + R3F
    api/            Express + TypeScript + Drizzle
  packages/
    shared/         muscle IDs, soreness function, zod schemas, DTO types
  docs/
  package.json      workspaces, shared scripts
  tsconfig.base.json
  .env.example      placeholders only
  .gitignore        includes .env
```

`packages/shared` is the single source of truth for anything both sides must agree on. It has no runtime dependency besides zod.

## 3. Backend

### 3.1 Layers

`routes -> controllers -> services -> repositories`

- Routes bind paths to controllers and attach validation.
- Controllers translate HTTP to service calls and back. No business logic.
- Services hold business rules and are the unit-tested layer. They depend on repository interfaces, not on Drizzle.
- Repositories are the only code that touches Drizzle and Postgres.

Cross-cutting: request validation with shared zod schemas, a single error-handling middleware, structured logging (pino), config loaded and validated once at startup, graceful shutdown.

### 3.2 User seam

A `currentUser` middleware attaches `req.userId`. In v1 it returns the seeded default user. Every repository method takes `userId` explicitly. Adding real auth later replaces only this middleware.

### 3.3 Data model

All tables use UUID primary keys and `created_at` / `updated_at`.

- `users`: one seeded default row.
- `exercises`: `name`, `slug` (unique per scope), nullable `user_id`. Null means built-in. Custom exercises need no schema change later.
- `exercise_muscles`: `exercise_id`, `muscle_id`, `role` (`primary` | `secondary`).
- `workouts`: `user_id`, `title`, `scheduled_for` (date), `status` (`scheduled` | `completed` | `skipped`), `completed_at` (timestamptz, nullable).
- `workout_exercises`: `workout_id`, `exercise_id`, `position`, optional `sets`, `reps`, `weight_kg`.

`MuscleId` is a shared enum, not a table. Initial set: chest, upper back, lats, traps, shoulders, biceps, triceps, forearms, abs, obliques, lower back, glutes, quads, hamstrings, calves.

Indexes: `workouts(user_id, scheduled_for)`, `workouts(user_id, completed_at)`.

Migrations are managed by drizzle-kit and committed. The exercise library is loaded by an idempotent seed script.

### 3.4 REST API (`/api/v1`)

- `GET /workouts?from&to` workouts in a date range. The range is required and capped, so there is no unbounded list.
- `POST /workouts`, `PATCH /workouts/:id`, `DELETE /workouts/:id`
- `POST /workouts/:id/complete` and `POST /workouts/:id/uncomplete`. Both are idempotent.
- `GET /exercises`
- `GET /soreness` returns events from the last 48 hours as `{ muscleId, role, completedAt }`.

Error envelope for every failure: `{ "error": { "code", "message", "details" } }`.

### 3.5 Soreness

The shared function is:

```
intensity(event, now) = weight(role) * max(0, 1 - hoursSince(event.completedAt, now) / 48)
muscleIntensity(muscle, events, now) = min(1, max over events of intensity)
```

with `weight(primary) = 1.0` and `weight(secondary) = 0.5`. The server returns raw events; the client applies the function so the fade runs live without refetching. The server uses the same function for any server-side needs, so the two cannot diverge.

## 4. Frontend

### 4.1 Structure

Feature folders, each owning its components, hooks and API calls: `features/schedule`, `features/body`, `features/exercises`. A thin `lib/` holds the API client and shared UI primitives. Server state is handled by TanStack Query. Local UI state stays in components.

### 4.2 3D body

- `bodyDefinition.ts` is data: each `MuscleId` maps to a list of primitive parts (capsule, lathe, sphere with position and scale), mirrored left and right.
- A builder turns the definition into meshes tagged with `userData.muscleId`. Replacing the builder with a glTF loader later leaves the scene untouched.
- The scene component takes only `Record<MuscleId, number>` (intensity 0 to 1). It knows nothing about workouts.
- Look: matte grey body on a dark neutral background. Each muscle's colour blends from grey to red by intensity.
- One shared material per muscle. Intensity changes are tweened with Motion, so a muscle flushes red when a workout is completed.
- Interaction: orbit controls with limited zoom, Front and Back snap buttons, hover or tap on a muscle shows its name, soreness percentage and time until recovered.
- Performance: render on demand, only when intensities change or the camera moves; device pixel ratio capped at 2; the 3D chunk is lazy-loaded so the schedule renders first.
- Fallback: if WebGL is unavailable, show a list of muscles with intensity bars.

### 4.3 Schedule UI

- Week strip plus day list. Add a workout by choosing a date and picking exercises from the library.
- "Mark done" updates optimistically, and the body reacts immediately.
- Desktop: schedule on the left, body on the right. Mobile: body on top, schedule below.

### 4.4 Styling

Monochrome design tokens are Tailwind-consumed CSS variables, so a future theme changes tokens only. Motion handles UI transitions and the body tween. Respect `prefers-reduced-motion`.

## 5. Configuration and secrets

- `DATABASE_URL` is read from `apps/api/.env`, which is gitignored. `.env.example` contains placeholders only.
- The connection string provided during design must never be committed or written into any tracked file. It was shared in chat, so the Neon password should be rotated before any deployment.
- Tests run against a separate Neon branch database, never the primary one.

## 6. Testing

- Vitest unit tests for the soreness function (boundaries at 0, 24 and 48 hours, overlap, secondary weighting) and for services using in-memory repository fakes.
- Supertest integration tests for the API against a Neon test branch.
- Component tests for the schedule flow with Testing Library.
- No end-to-end browser tests in v1.

## 7. Scalability and maintainability notes

- Stateless API, so it scales horizontally. Neon's pooled connection string is used for the app.
- Bounded queries everywhere (date ranges, 48-hour soreness window).
- Repository interfaces isolate the database; shared package prevents client and server drift.
- Versioned API path, `user_id` on every row, and nullable-owner exercises leave room for accounts and custom exercises without migrations that rewrite data.
- The body renderer depends on a plain intensity map, so the data source and the model asset can each change independently.

## 8. Milestones

1. Monorepo scaffold, shared package, soreness function with tests.
2. API: schema, migrations, seed, workouts and exercises endpoints, soreness endpoint.
3. Frontend shell, schedule UI wired to the API.
4. 3D body with intensity map, interaction and fallback.
5. Polish: motion, responsive layout, accessibility pass.
