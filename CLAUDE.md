# malachitopp.com — notes for Claude

Project context lives in `context/`: `PROJECT.md` is the brief (state, decisions, working style). Read the
topic files only when the task touches them: `studio.md` (studio page, overlays, path-traced renderer) and
`deployment.md` (Vercel, Neon, DNS). `/update` keeps them current.

## Finding your way round the code: use graphify first
`graphify-out/` holds a knowledge graph of this repo. For questions like "where is X handled", "what
calls / depends on Y", "how does X connect to Y" or "what breaks if I change Z", query it **before**
grepping or opening files:

    graphify query "<question>" --budget 1500

- Treat the answer as a map: open only the files and lines it points to (`src=… loc=L…`). Raise
  `--budget` only if it says TRUNCATED and the answer isn't in what came back; add `--dfs` to trace one path.
- Skip it when the user already names the file or the change is purely visual — Read/Grep are cheaper there.
- Never read `graphify-out/graph.json` (~130k tokens), and don't load `GRAPH_REPORT.md` just for background.
- The graph is a snapshot (built 2026-09-16) and doesn't update itself. If it points at something that
  isn't there, trust the files. Suggest `/graphify --update` after big changes; never rebuild from scratch
  (~1.2M tokens) without asking.
