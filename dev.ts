#!/usr/bin/env -S deno run -A --watch=static/,routes/

import { Builder } from "fresh/dev"

const builder = new Builder()

if (Deno.args.includes("build")) {
  console.log("📦 Copying library files for build...")
  try {
    // Create new library structure
    await Deno.mkdir("static/libraries", { recursive: true })
    await Deno.mkdir("static/libraries/webawesome", { recursive: true })
    await Deno.mkdir("static/libraries/boxicons", { recursive: true })

    // Copy WebAwesome dist-cdn files
    const waSourceDir = "node_modules/@awesome.me/webawesome/dist-cdn"
    const waTargetDir = "static/libraries/webawesome"

    const waCommand = new Deno.Command("cp", {
      args: ["-ar", `${waSourceDir}/.`, waTargetDir],
    })

    const waResult = await waCommand.output()
    if (!waResult.success) {
      throw new Error("Failed to copy WebAwesome files")
    }

    console.log("✅ WebAwesome files copied successfully")

    // Copy Boxicons SVG files
    const bxSourceDir = "node_modules/.deno/boxicons@2.1.4/node_modules/boxicons/svg"
    const bxCommand = new Deno.Command("cp", {
      args: ["-ar", bxSourceDir, "static/libraries/boxicons/"],
    })

    const bxResult = await bxCommand.output()
    if (!bxResult.success) {
      throw new Error("Failed to copy Boxicons files")
    }

    console.log("✅ Boxicons files copied successfully")
  } catch (error) {
    console.error("❌ Failed to copy library files:", error)
    Deno.exit(1)
  }
  await builder.build()
} else {
  await builder.listen(() => import("./main.ts"))
}
