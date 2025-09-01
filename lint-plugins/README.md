# Custom Lint Plugins

This directory contains custom lint rules that enforce architectural boundaries in the Fresh application.

## Rules

### no-server-imports-in-islands

This rule prevents importing server-side code from the `server/` directory into island components.

### no-server-only-imports-in-islands

This rule prevents importing files marked with `"server only"` string literals into island components.

### Why?

Islands in Fresh are client-side components that run in the browser and should never import server-side code because:

- **Security**: Server code may contain secrets, database connections, or sensitive business logic
- **Bundle Size**: Server code increases client-side bundle size unnecessarily
- **Runtime Errors**: Server-only APIs (like Deno APIs) will fail in the browser
- **Architecture**: Violates the separation of concerns between client and server

### What's blocked?

**Directory-based blocking** (`no-server-imports-in-islands`):

- `import { something } from "~/server/anything"`
- `import { something } from "../server/anything"`
- Any import path containing `/server/`
- Dynamic imports: `await import("~/server/something")`

**Marker-based blocking** (`no-server-only-imports-in-islands`):

- Any file containing the exact string literal `"server only"` at module scope
- Case-insensitive matching: `"SERVER ONLY"`, `"Server Only"`, etc.
- Works regardless of file location

### How to fix violations?

1. **Move shared types to `~/types/`**:
   ```typescript
   // ❌ Bad - importing server code
   import type { UserData } from "~/server/user-service.ts"

   // ✅ Good - importing shared types
   import type { UserData } from "~/types/user.ts"
   ```

2. **Use API endpoints to fetch data**:
   ```typescript
   // ❌ Bad - importing server function
   import { getUserData } from "~/server/user-service.ts"

   // ✅ Good - fetching via API
   const userData = await fetch("/api/users/me").then((r) => r.json())
   ```

3. **Create client-safe utility functions**:
   ```typescript
   // ❌ Bad - importing server utilities
   import { formatDate } from "~/server/utils.ts"

   // ✅ Good - client-safe utilities
   import { formatDate } from "~/utils/client-safe-formatters.ts"
   ```

4. **Remove the "server only" marker**:
   ```typescript
   // ❌ Bad - marked as server-only
   "server only"
   export function sharedUtil() {/* ... */}

   // ✅ Good - remove marker to allow island imports
   export function sharedUtil() {/* ... */}
   ```

### Examples

#### ❌ Violations (in islands/)

```typescript
// islands/UserProfile.tsx
import { getUser } from "~/server/user-service.ts" // ❌ Directory-based violation
import { DatabaseConfig } from "~/server/config.ts" // ❌ Directory-based violation
import { hash } from "../server/crypto.ts" // ❌ Directory-based violation
import { sensitiveOp } from "~/utils/marked-utils.ts" // ❌ Marker-based violation (if marked-utils.ts contains "server only")

// Dynamic import violations
const module = await import("~/server/utils.ts") // ❌ Directory-based dynamic import
const marked = await import("~/utils/marked-utils.ts") // ❌ Marker-based dynamic import
```

#### ✅ Files that trigger marker-based blocking

```typescript
// utils/database-operations.ts
"server only" // ← This marker prevents island imports

export function queryDatabase() {/* ... */}
```

```typescript
// services/auth-service.ts
"SERVER ONLY" // ← Case-insensitive detection

export function validateToken() {/* ... */}
```

#### ✅ Allowed (in islands/)

```typescript
// islands/UserProfile.tsx
import type { User } from "~/types/user.ts" // ✅ Shared types
import { formatDate } from "~/utils/formatters.ts" // ✅ Client-safe utils
import { useState } from "preact/hooks" // ✅ Client libraries

// Fetch data via API
const user = await fetch("/api/user").then((r) => r.json()) // ✅ API calls
```

#### ✅ Server imports allowed elsewhere

```typescript
// routes/api/users.ts (not in islands/)
import { getUser } from "~/server/user-service.ts" // ✅ API route can import server code

// routes/_middleware.ts (not in islands/)
import { authenticate } from "~/server/auth.ts" // ✅ Middleware can import server code
```

### Testing

Run the lint plugin tests:

```bash
deno test lint-plugins/
```

Run lint on the entire project:

```bash
deno lint
```

### Configuration

The plugin is configured in `deno.jsonc`:

```json
{
  "lint": {
    "plugins": ["./lint-plugins/no-server-imports.ts"],
    "rules": {
      "include": ["island-protection/no-server-imports-in-islands"]
    }
  }
}
```

To disable the rule for a specific file, add:

```typescript
// deno-lint-ignore island-protection/no-server-imports-in-islands
```

To disable it for a specific line:

```typescript
import { something } from "~/server/utils.ts" // deno-lint-ignore island-protection/no-server-imports-in-islands
```
