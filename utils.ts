import { createDefine } from "fresh"
import { SessionData } from "./utils/session.ts"

// deno-lint-ignore no-empty-interface
export interface State {
    session?: SessionData | null
}

export const define = createDefine<State>()
