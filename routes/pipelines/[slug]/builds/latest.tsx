import { Context } from "fresh"
import { type BuildkiteBuild, GET_PIPELINE_BUILDS, getBuildkiteClient } from "~/utils/buildkite-client.ts"
import { fetchAllPipelines } from "~/utils/buildkite-data.ts"
import { type AppState, canAccessPipeline } from "~/utils/middleware.ts"
import { getCacheManager } from "~/utils/cache/cache-manager.ts"
import { withRetry } from "~/utils/retry-helper.ts"

export const handler = {
  async GET(ctx: Context<AppState>) {
    const pipelineSlug = ctx.params.slug

    try {
      // First, verify that user has access to this pipeline
      const allPipelines = await fetchAllPipelines()
      const pipeline = allPipelines.find((p) => p.slug === pipelineSlug)

      if (!pipeline) {
        // Pipeline not found, return 404
        return new Response(null, {
          status: 404,
        })
      }

      // Check if user has access to this pipeline
      if (!canAccessPipeline(pipeline, ctx.state.session)) {
        // Return 404 instead of 403 to avoid leaking pipeline existence
        return new Response(null, {
          status: 404,
        })
      }

      // Try to get builds from cache first
      const cacheManager = getCacheManager()
      let builds = await cacheManager.getCachedBuildsForPipeline(pipelineSlug, 1)

      if (builds.length === 0) {
        // No cached builds, fetch from API
        console.log(`No cached builds for ${pipelineSlug}, fetching from API for latest redirect`)
        const fullPipelineSlug = `divvun/${pipelineSlug}`
        const result = await withRetry(
          async () =>
            await getBuildkiteClient().query(GET_PIPELINE_BUILDS, {
              pipelineSlug: fullPipelineSlug,
              first: 1, // Only fetch the latest build
            }).toPromise(),
          { maxRetries: 3, initialDelay: 1000, maxDelay: 300000 },
        )

        if (result.error) {
          console.error("Error fetching pipeline builds for latest redirect:", result.error)
          // Redirect to pipeline page if we can't fetch builds
          return new Response(null, {
            status: 302,
            headers: { "Location": `/pipelines/${pipelineSlug}` },
          })
        }

        builds = result.data?.pipeline?.builds?.edges?.map((edge: { node: BuildkiteBuild }) => edge.node) || []
      }

      // Check if we have any builds
      if (builds.length === 0) {
        console.log(`No builds found for pipeline ${pipelineSlug}`)
        // Redirect to pipeline page with no builds
        return new Response(null, {
          status: 302,
          headers: { "Location": `/pipelines/${pipelineSlug}` },
        })
      }

      // Get the latest build (first in the array)
      const latestBuild = builds[0]
      console.log(`Redirecting to latest build #${latestBuild.number} for pipeline ${pipelineSlug}`)

      // Redirect to the latest build
      return new Response(null, {
        status: 302,
        headers: { "Location": `/pipelines/${pipelineSlug}/builds/${latestBuild.number}` },
      })
    } catch (error) {
      console.error("Error in latest build redirect:", error)

      // Fallback: redirect to pipeline page
      return new Response(null, {
        status: 302,
        headers: { "Location": `/pipelines/${pipelineSlug}` },
      })
    }
  },
}
