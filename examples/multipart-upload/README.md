# Multipart Upload

Upload a local file as a `multipart/form-data` POST and stream the response body chunk by chunk.

## What it demonstrates

- `fs.readAsBytes` to read a file as raw binary
- `Blob` constructor to wrap bytes with a MIME type (sandbox global, no import needed)
- `FormData` to build a multipart body (sandbox global, no import needed)
- `http.fetch` with a `POST` and a `FormData` body — the runner serialises multipart/form-data automatically
- `res.body().getReader()` to consume the response as a `ReadableStream`, reading chunks in a loop
- `section.emit` to stream progress sections back to the caller before the final return

## How to run

Requires a file to upload — any file in the project directory works:

```bash
crunes use upload README.md
crunes use upload README.md --field document
```

The example targets `https://httpbin.org/post`, which echoes the full request back as JSON so you can see what the server received.

## What to expect

Progress lines appear as each chunk arrives, followed by a summary section showing the field name, file size, and which fields the server saw.
