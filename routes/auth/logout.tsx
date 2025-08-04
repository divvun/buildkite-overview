import { Context } from "fresh"
import { State } from "~/utils.ts"

export const handler = {
  POST(_ctx: Context<State>) {
    const headers = new Headers()
    headers.set("Location", "/auth/login")
    
    // Clear session cookie
    headers.set("Set-Cookie", "session=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/")

    return new Response(null, {
      status: 302,
      headers,
    })
  },
}