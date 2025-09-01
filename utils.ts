import { createDefine } from "fresh"
import type { SessionData } from "./types/session.ts"

export interface State {
  session?: SessionData | null
}

export const define = createDefine<State>()
