"""Count TODO-style markers per file and print the result as crunes sections.

With run.output "sections", each line of standard output shaped like a
`--format jsonl` event becomes one: {"type": "section", "section": {...}} is a
section, and {"type": "log", "level": ..., "message": ...} a log line on
standard error. Any other line is plain text.
"""
import json
import os
import sys

args = json.loads(os.environ["CRUNES_ARGS"])
markers = json.loads(os.environ["CRUNES_VARS"]).get("markers", ["TODO"])
root = os.path.join(os.environ["CRUNES_PROJECT_ROOT"], args.get("dir") or ".")

def emit(name, content):
    print(json.dumps({"type": "section", "section": {"name": name, "data": {"type": "markdown", "content": content}}}), flush=True)

counts = {}
for base, dirs, files in os.walk(root):
    dirs[:] = [d for d in dirs if not d.startswith(".")]
    for name in files:
        path = os.path.join(base, name)
        try:
            with open(path, encoding="utf-8") as f:
                n = sum(line.count(m) for line in f for m in markers)
        except (UnicodeDecodeError, OSError):
            continue
        if n >= args["min"]:
            counts[os.path.relpath(path, root)] = n

print(json.dumps({"type": "log", "level": "info", "message": f"scanned {root} for {', '.join(markers)}"}))
ranked = sorted(counts.items(), key=lambda kv: -kv[1])
if args["format"] == "table":
    rows = "\n".join(f"| {path} | {n} |" for path, n in ranked)
    emit("files", "| File | Count |\n| --- | --- |\n" + rows if ranked else "No markers found.")
else:
    emit("files", "\n".join(f"- {path}: {n}" for path, n in ranked) or "No markers found.")
emit("total", f"{sum(counts.values())} markers in {len(counts)} files")
