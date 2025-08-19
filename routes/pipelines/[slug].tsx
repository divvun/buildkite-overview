import { Context, page } from "fresh"
import Layout from "~/components/Layout.tsx"
import PipelineBuilds from "~/islands/PipelineBuilds.tsx"
import { type BuildkiteBuild, GET_PIPELINE_BUILDS, getBuildkiteClient } from "~/utils/buildkite-client.ts"
import { type AppPipeline, fetchAllPipelines } from "~/utils/buildkite-data.ts"
import { getCacheManager } from "~/utils/cache/cache-manager.ts"
import { formatTimeAgo, getBadgeVariant, getStatusIcon, getTranslatedStatus } from "~/utils/formatters.ts"
import { type AppState } from "~/utils/middleware.ts"
import { withRetry } from "~/utils/retry-helper.ts"
import { type SessionData } from "~/utils/session.ts"

interface PipelineDetailProps {
  session?: SessionData | null
  pipeline?: AppPipeline
  builds?: BuildkiteBuild[]
  error?: string
}

export const handler = {
  async GET(ctx: Context<AppState>) {
    const pipelineSlug = ctx.params.slug

    try {
      // Fetch all pipelines and find the one matching the slug
      const allPipelines = await fetchAllPipelines()
      const pipeline = allPipelines.find((p) => p.slug === pipelineSlug)

      if (!pipeline) {
        return page(
          {
            session: ctx.state.session,
            error: ctx.state.t("pipeline-not-found"),
          } satisfies PipelineDetailProps,
        )
      }

      // Try to get builds from cache first
      const cacheManager = getCacheManager()
      let builds = await cacheManager.getCachedBuildsForPipeline(pipelineSlug, 20)

      if (builds.length === 0) {
        // No cached builds, fetch from API
        console.log(`No cached builds for ${pipelineSlug}, fetching from API`)
        const fullPipelineSlug = `divvun/${pipelineSlug}`
        const result = await withRetry(
          async () =>
            await getBuildkiteClient().query(GET_PIPELINE_BUILDS, {
              pipelineSlug: fullPipelineSlug,
              first: 20,
            }).toPromise(),
          { maxRetries: 3, initialDelay: 1000, maxDelay: 300000 },
        )

        builds = result.data?.pipeline?.builds?.edges?.map((edge: { node: BuildkiteBuild }) => edge.node) || []
        console.log(`Fetched ${builds.length} builds for pipeline ${fullPipelineSlug}`)

        // Cache each build
        for (const build of builds) {
          await cacheManager.cacheBuild(pipelineSlug, build.number, build)
        }
      } else {
        console.log(`Using ${builds.length} cached builds for pipeline ${pipelineSlug}`)
      }

      return page(
        {
          session: ctx.state.session,
          pipeline,
          builds,
        } satisfies PipelineDetailProps,
      )
    } catch (error) {
      console.error("Error fetching pipeline details:", error)

      return page(
        {
          session: ctx.state.session,
          error: ctx.state.t("pipeline-load-error"),
        } satisfies PipelineDetailProps,
      )
    }
  },
}

export default function PipelineDetail(props: { data: PipelineDetailProps; state: AppState }) {
  const { session, pipeline, builds = [], error } = props.data

  // Get the most recent build for display
  const latestBuild = builds.length > 0 ? builds[0] : null

  if (error || !pipeline) {
    return (
      <Layout
        title={props.state.t("pipeline-not-found-title")}
        currentPath="/pipelines"
        session={session}
        t={props.state.t}
        state={props.state}
      >
        <div class="wa-stack wa-gap-l" style="padding: var(--wa-space-l)">
          <wa-callout variant="danger">
            <wa-icon slot="icon" name="triangle-exclamation"></wa-icon>
            {error || props.state.t("pipeline-not-found")}
          </wa-callout>

          <wa-button>
            <wa-icon slot="prefix" name="arrow-left"></wa-icon>
            <a href="/pipelines" style="text-decoration: none; color: inherit">
              {props.state.t("back-to-pipelines")}
            </a>
          </wa-button>
        </div>
      </Layout>
    )
  }

  const breadcrumbs = [
    { label: props.state.t("pipelines-breadcrumb"), href: "/pipelines" },
    { label: pipeline.name },
  ]

  return (
    <Layout
      title={props.state.t("pipeline-page-title", { name: pipeline.name })}
      currentPath="/pipelines"
      session={session}
      breadcrumbs={breadcrumbs}
    >
      <div class="wa-stack wa-gap-l" style="padding: var(--wa-space-l)">
        <header class="wa-stack wa-gap-s">
          <div class="wa-flank">
            <div class="wa-cluster wa-gap-s">
              <wa-button
                variant="brand"
                appearance="outlined"
                disabled
                title={props.state.t("feature-coming-soon")}
              >
                <wa-icon slot="prefix" name="play"></wa-icon>
                {props.state.t("new-build")}
              </wa-button>
            </div>
          </div>

          <div class="wa-flank">
            <div class="wa-stack wa-gap-xs">
              <div class="wa-flank wa-gap-s">
                <wa-icon
                  name={getStatusIcon(pipeline.status)}
                  style={`color: var(--wa-color-${
                    getBadgeVariant(pipeline.status)
                  }-fill-loud); font-size: 1.5rem` as any}
                >
                </wa-icon>
                <h1 class="wa-heading-l">{pipeline.name}</h1>
                <wa-badge variant={getBadgeVariant(pipeline.status)}>
                  {getTranslatedStatus(pipeline.status, props.state.t)}
                </wa-badge>
              </div>

              <div class="wa-cluster wa-gap-s">
                <div class="wa-caption-m wa-color-text-quiet">
                  <wa-icon name="code-branch" style="margin-right: var(--wa-space-3xs)"></wa-icon>
                  {pipeline.repo || props.state.t("no-repository")}
                </div>
                <div class="wa-caption-m wa-color-text-quiet">
                  {props.state.t("last-build-label")}: {pipeline.lastBuild}
                </div>
              </div>
            </div>
          </div>

          <div class="wa-cluster wa-gap-xs" style="flex-wrap: wrap">
            {pipeline.tags.map((tag) => <wa-tag key={tag}>{tag}</wa-tag>)}
          </div>
        </header>

        <div class="wa-grid wa-gap-m" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))">
          <wa-card>
            <div class="wa-stack wa-gap-xs">
              <div class="wa-flank">
                <span class="wa-heading-s">{props.state.t("total-builds")}</span>
                <wa-badge variant="brand">{pipeline.builds.total}</wa-badge>
              </div>
              <div class="wa-caption-m wa-color-text-quiet">
                {latestBuild
                  ? `${props.state.t("last-build-label")} ${
                    formatTimeAgo(
                      latestBuild.createdAt || latestBuild.startedAt || new Date().toISOString(),
                      props.state.locale,
                      props.state.t,
                    )
                  }`
                  : props.state.t("no-builds-yet")}
              </div>
            </div>
          </wa-card>

          <wa-card>
            <div class="wa-stack wa-gap-xs">
              <div class="wa-flank">
                <span class="wa-heading-s">{props.state.t("success-rate")}</span>
                <wa-badge
                  variant={pipeline.builds.total > 0 && (pipeline.builds.passed / pipeline.builds.total) >= 0.9
                    ? "success"
                    : "warning"}
                >
                  {pipeline.builds.total > 0 ? Math.round((pipeline.builds.passed / pipeline.builds.total) * 100) : 0}%
                </wa-badge>
              </div>
              <div class="wa-caption-m wa-color-text-quiet">
                {props.state.t("builds-passed-failed", {
                  passed: pipeline.builds.passed,
                  failed: pipeline.builds.failed,
                })}
              </div>
            </div>
          </wa-card>

          <wa-card>
            <div class="wa-stack wa-gap-xs">
              <div class="wa-flank">
                <span class="wa-heading-s">{props.state.t("visibility")}</span>
                <wa-badge variant={pipeline.visibility === "private" ? "brand" : "success"}>
                  <wa-icon slot="prefix" name={pipeline.visibility === "private" ? "lock" : "globe"}></wa-icon>
                  {pipeline.visibility || props.state.t("visibility-unknown")}
                </wa-badge>
              </div>
              <div class="wa-caption-m wa-color-text-quiet">{props.state.t("repository-access")}</div>
            </div>
          </wa-card>
        </div>

        <section>
          <h2 class="wa-heading-m">{props.state.t("recent-builds-title")}</h2>
          <PipelineBuilds pipelineSlug={pipeline.slug} initialBuilds={builds} />
        </section>
      </div>
    </Layout>
  )
}
