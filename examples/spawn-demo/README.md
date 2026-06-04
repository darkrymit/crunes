# Spawn Demo

Start, monitor, and stop a long-running background worker process.

## What it demonstrates

Uses `rune.job.start` to start a rune as a background job, `rune.job.exists` to check if it's still alive, and `rune.job.kill` to terminate it. State is persisted between calls via `json.write`/`json.read`.

## How to run

```bash
crunes run server start    # start the background worker
crunes run server          # check status (default action)
crunes run server stop     # stop the worker
```

## What to expect

`start` spawns the worker and saves its job ID to `.crunes/state/spawn-demo.json`. Subsequent `status` calls report running/stopped state. `stop` kills the job. Starting again while already running reports the existing job.
