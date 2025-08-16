#!/usr/bin/env -S deno run -A --watch=static/,routes/

import { Builder } from "fresh/dev"

const builder = new Builder()

if (Deno.args.includes("build")) {
  console.log("📦 Copying WebAwesome files for build...")
  try {
    await Deno.remove("static/webawesome", { recursive: true }).catch(() => {})
    await Deno.mkdir("static/webawesome", { recursive: true })

    // Copy WebAwesome dist-cdn files
    const sourceDir = "node_modules/@awesome.me/webawesome/dist-cdn"
    const targetDir = "static/webawesome"

    const command = new Deno.Command("cp", {
      args: ["-ar", `${sourceDir}/.`, targetDir],
    })

    const { success } = await command.output()
    if (!success) {
      throw new Error("Failed to copy WebAwesome files")
    }

    console.log("✅ WebAwesome files copied successfully")
  } catch (error) {
    console.error("❌ Failed to copy WebAwesome files:", error)
    Deno.exit(1)
  }
  await builder.build()
} else {
  await builder.listen(() => import("./main.ts"))
}
