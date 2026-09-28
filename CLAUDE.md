## Bash usage
- Never chain file-reading commands with `;` or `|` in one call — split into separate tool calls.
- Never prefix a command with inline `VAR=value` env assignments (e.g. `WT=... node script.js`) — pass values as CLI arguments instead, or wrap the invocation in a shell script and call that.
- Prefer the Read and Grep tools over raw shell pipelines when possible.
- ## Scratch scripts
For anything beyond a single literal command, write a file in `scratchpad/` or `perf/` and run it — never inline code via inline shell tricks, -e/-c flags, chaining, or expansion. One throwaway file per task, one clean literal command to run it.