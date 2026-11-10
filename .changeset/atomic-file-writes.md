---
"@caatinga/core": patch
---

Binding markers, the frontend env file, and the frontend `package.json` are now written atomically (temp file + rename), so an interrupted write can no longer leave them truncated. The shared `atomicWriteFile` helper preserves the existing file mode and writes through symlinks (#84).
