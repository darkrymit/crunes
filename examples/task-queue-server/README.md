# Task Queue Server

Demonstrates HTTP server + two piggybacked WebSocket servers in a server-worker lifecycle pattern.

## What it demonstrates

- `http.server()` with a request handler for REST endpoints
- Two `ws.server()` instances piggybacking on the same HTTP server
- `ws.server({ path: '/jobs' })` — broadcast channel for queue events
- `ws.server({ path: '/logs' })` — per-job log channel routed via `conn.pathname`
- `rune.job.start` / `rune.job.exists` / `rune.job.kill` for worker lifecycle management
- `ws.client()` in a consumer rune with concurrent connections

## How to run

```bash
crunes run server start      # spawn the worker (HTTP + WS on :3700)
crunes run server            # check status
crunes run client            # submit 3 jobs, stream logs, print report
crunes run client --jobs 5   # submit 5 jobs
crunes run server stop       # stop the worker
```

## What to expect

`start` spawns the worker and saves its job ID to `.crunes/state/task-queue-server.json`.

`client` polls `/health` until the worker is ready, submits N jobs via `POST /jobs`, opens a `/jobs` WebSocket to watch for `completed` events, opens one `/logs/:jobId` WebSocket per job to collect log lines, waits for all jobs to finish (~2s each), then prints a table:

```
| Job ID   | Status | Logs                                                              |
|----------|--------|-------------------------------------------------------------------|
| a1b2c3d4 | done   | Job a1b2c3d4 started → Job a1b2c3d4 processing... → ... → done   |
```

`stop` kills the worker job.
