if (typeof Deno === "undefined") {
  throw new Error("CLI module can only be used on the server side")
}

import { object, option, optional } from "@optique/core/parser"
import { string } from "@optique/core/valueparser"
import { run } from "@optique/run"

export interface CliOptions {
  config?: string
}

const parser = object({
  config: optional(option("-c", "--config", string())),
})

export function parseCliArgs(args: string[] = Deno.args): CliOptions {
  return run(parser, { args, help: "both" })
}
