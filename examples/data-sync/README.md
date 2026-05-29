# Data Sync

Fetch a public JSON API, cache the response to avoid redundant fetches, persist to SQLite, and report stored data.

## What it demonstrates

Uses `http.fetch` to call a remote API, `cache.has` as a fetch guard (5-minute TTL), `sqlite.run` for schema initialization, and `sqlite` exec/query for insert and retrieval.

## How to run

```bash
crunes use sync      # fetch and store (hits the network)
crunes use report    # display stored posts
crunes use sync      # runs again within 5 min — skips fetch
```

## What to expect

First `sync` inserts 100 posts and reports the count. `report` shows total count and the 5 most recent post titles. Running `sync` again within 5 minutes reports the cache guard and skips the network call.
