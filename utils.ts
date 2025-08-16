import { createDefine } from "fresh"
import { SessionData } from "./utils/session.ts"

export interface State {
  session?: SessionData | null
}

export const define = createDefine<State>()
