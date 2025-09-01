import { Context } from "fresh"
import { State } from "~/utils.ts"
import { deleteSession } from "~/server/session-store.ts"

const logoutHandler = async (ctx: Context<State>) => {
  const headers = new Headers()
  headers.set("Location", "/")

  // Get session ID from cookie before clearing it
  const sessionId = ctx.req.headers.get("cookie")
    ?.split("; ")
    .find((c) => c.startsWith("session_id="))
    ?.split("=")[1]

  // Delete session from database if it exists
  if (sessionId) {
    try {
      await deleteSession(sessionId)
      console.log(`🗑️  Deleted session ${sessionId} from database`)
    } catch (error) {
      console.error(`Failed to delete session ${sessionId}:`, error)
    }
  }

  // Clear session cookie
  headers.set("Set-Cookie", "session_id=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/")

  return new Response(null, {
    status: 302,
    headers,
  })
}

export const handler = {
  GET: logoutHandler,
  POST: logoutHandler,
}
