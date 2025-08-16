import { Context } from "fresh"
import { State } from "~/utils.ts"

const logoutHandler = (_ctx: Context<State>) => {
  const headers = new Headers()
  headers.set("Location", "/")

  // Clear session cookie
  headers.set("Set-Cookie", "session=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/")

  return new Response(null, {
    status: 302,
    headers,
  })
}

export const handler = {
  GET: logoutHandler,
  POST: logoutHandler,
}
