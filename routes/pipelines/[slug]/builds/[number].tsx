import { Context, page } from "fresh"
import Layout from "~/components/Layout.tsx"
import BuildJobs from "~/islands/BuildJobs.tsx"
import {
  type BuildkiteBuild,
  type BuildkiteJob,
  GET_BUILD_DETAILS,
  GET_PIPELINE_BUILDS,
  getBuildkiteClient,
} from "~/utils/buildkite-client.ts"
import { fetchAllPipelines } from "~/utils/buildkite-data.ts"
import {
  formatDuration,
  formatTimeAgo,
  getBadgeVariant,
  getStatusIcon,
  getTranslatedStatus,
} from "~/utils/formatters.ts"
import { type AppState, canAccessPipeline } from "~/utils/middleware.ts"
import { withRetry } from "~/utils/retry-helper.ts"
import { type SessionData } from "~/utils/session.ts"

interface BuildDetailProps {
  session?: SessionData | null
  build?: BuildkiteBuild
  jobs?: BuildkiteJob[]
  pipelineSlug?: string
  error?: string
}

export const handler = {
  async GET(ctx: Context<AppState>) {
    const pipelineSlug = ctx.params.slug
    const buildNumber = parseInt(ctx.params.number)

    if (isNaN(buildNumber)) {
      return page(
        {
          session: ctx.state.session,
          error: ctx.state.t("invalid-build-number"),
          pipelineSlug,
        } satisfies BuildDetailProps,
      )
    }

    try {
      // First, verify that user has access to this pipeline
      const allPipelines = await fetchAllPipelines()
      const pipeline = allPipelines.find((p) => p.slug === pipelineSlug)

      if (!pipeline) {
        return page(
          {
            session: ctx.state.session,
            error: ctx.state.t("pipeline-not-found"),
            pipelineSlug,
          } satisfies BuildDetailProps,
        )
      }

      // Check if user has access to this pipeline
      if (!canAccessPipeline(pipeline, ctx.state.session)) {
        // Return 404 instead of 403 to avoid leaking pipeline existence
        return page(
          {
            session: ctx.state.session,
            error: ctx.state.t("pipeline-not-found"),
            pipelineSlug,
          } satisfies BuildDetailProps,
        )
      }

      // Buildkite GraphQL API expects format: organization-slug/pipeline-slug
      // We need to find the organization for this pipeline
      const fullPipelineSlug = `divvun/${pipelineSlug}` // Default to divvun org

      const result = await withRetry(
        async () =>
          await getBuildkiteClient().query(GET_PIPELINE_BUILDS, {
            pipelineSlug: fullPipelineSlug,
            first: 100, // Increase limit to find older builds
          }).toPromise(),
        { maxRetries: 3, initialDelay: 1000, maxDelay: 300000 },
      )

      if (result.error) {
        console.error("Error fetching pipeline builds:", result.error)
        return page(
          {
            session: ctx.state.session,
            error: `Pipeline "${pipelineSlug}" not found or access denied`,
            pipelineSlug,
          } satisfies BuildDetailProps,
        )
      }

      const builds = result.data?.pipeline?.builds?.edges?.map((edge: { node: BuildkiteBuild }) => edge.node) || []
      const build = builds.find((b: BuildkiteBuild) => b.number === buildNumber)
      console.log(`Looking for build #${buildNumber}, found:`, build ? `#${build.number}` : "none")

      if (!build) {
        return page(
          {
            session: ctx.state.session,
            error: ctx.state.t("build-not-found-in-pipeline", {
              number: buildNumber,
              pipeline: pipelineSlug,
              builds: builds.map((b: BuildkiteBuild) => `#${b.number}`).join(", ") || "none",
            }),
            pipelineSlug,
          } satisfies BuildDetailProps,
        )
      }

      // Fetch jobs for this build
      const decodedId = atob(build.id)
      const uuid = decodedId.split("---")[1]
      const buildDetailsResult = await withRetry(
        async () =>
          await getBuildkiteClient().query(GET_BUILD_DETAILS, {
            uuid: uuid,
          }).toPromise(),
        { maxRetries: 3, initialDelay: 1000, maxDelay: 300000 },
      )

      const jobs = (buildDetailsResult.data?.build?.jobs?.edges?.map((edge: any) =>
        edge?.node
      ).filter((job: any): job is BuildkiteJob =>
        job != null
      ) || []) as BuildkiteJob[]
      console.log(`Fetched ${jobs.length} jobs for build #${buildNumber}`)

      return page(
        {
          session: ctx.state.session,
          build,
          jobs,
          pipelineSlug,
        } satisfies BuildDetailProps,
      )
    } catch (error) {
      console.error("Error fetching build details:", error)

      return page(
        {
          session: ctx.state.session,
          error: "Failed to load build details",
          pipelineSlug,
        } satisfies BuildDetailProps,
      )
    }
  },
}

export default function BuildDetail(props: { data: BuildDetailProps; state: AppState }) {
  const { session, build, jobs = [], pipelineSlug, error } = props.data

  if (error || !build) {
    return (
      <Layout
        title={props.state.t("build-not-found-title")}
        currentPath={`/pipelines/${pipelineSlug}`}
        session={session}
        t={props.state.t}
        state={props.state}
      >
        <div class="wa-stack wa-gap-l" style="padding: var(--wa-space-l) 0">
          <wa-callout variant="danger">
            <wa-icon slot="icon" name="triangle-exclamation"></wa-icon>
            {error || props.state.t("build-not-found")}
          </wa-callout>

          <wa-button>
            <wa-icon slot="prefix" name="arrow-left"></wa-icon>
            <a href={`/pipelines/${pipelineSlug}`} style="text-decoration: none; color: inherit">
              Back to Pipeline
            </a>
          </wa-button>
        </div>
      </Layout>
    )
  }

  const breadcrumbs = [
    { label: props.state.t("pipelines-breadcrumb"), href: "/pipelines" },
    { label: build.pipeline.name, href: `/pipelines/${pipelineSlug}` },
    { label: props.state.t("build-number", { number: build.number }) },
  ]

  return (
    <Layout
      title={props.state.t("build-page-title", { number: build.number, pipeline: build.pipeline.name })}
      currentPath={`/pipelines/${pipelineSlug}`}
      session={session}
      breadcrumbs={breadcrumbs}
      t={props.state.t}
      state={props.state}
    >
      <div class="wa-stack wa-gap-l" style="padding: var(--wa-space-l) 0">
        <header class="wa-stack wa-gap-s">
          {
            /* <div class="wa-flank">
            <wa-button variant="neutral" appearance="outlined">
              <wa-icon slot="prefix" name="arrow-left"></wa-icon>
              <a href={`/pipelines/${pipelineSlug}`} style="text-decoration: none; color: inherit">
                Back to {build.pipeline.name}
              </a>
            </wa-button>
            <div class="wa-cluster wa-gap-s">
              <wa-button variant="brand" appearance="outlined">
                <wa-icon slot="prefix" name="arrow-rotate-right"></wa-icon>
                Rebuild
              </wa-button>
              {build.url && (
                <wa-button variant="brand">
                  <wa-icon slot="prefix" name="arrow-up-right-from-square"></wa-icon>
                  <a href={build.url} target="_blank" style="text-decoration: none; color: inherit">
                    View in Buildkite
                  </a>
                </wa-button>
              )}
            </div>
          </div> */
          }

          <div class="wa-stack wa-gap-s">
            <div class="wa-flank wa-gap-s">
              <wa-icon
                name={getStatusIcon(build.state)}
                style={`color: var(--wa-color-${getBadgeVariant(build.state)}-fill-loud); font-size: 1.5rem` as any}
              >
              </wa-icon>
              <h1 class="wa-heading-l">{props.state.t("build-number", { number: build.number })}</h1>
              <wa-badge variant={getBadgeVariant(build.state)}>
                {getTranslatedStatus(build.state, props.state.t)}
              </wa-badge>
            </div>

            <div class="wa-cluster wa-gap-l">
              <div class="wa-caption-m wa-color-text-quiet">
                {props.state.t("duration-label")}:{" "}
                {formatDuration(build.startedAt, build.finishedAt, props.state.locale)}
              </div>
              <div class="wa-caption-m wa-color-text-quiet">
                {props.state.t("started-label-colon")}: {build.startedAt
                  ? formatTimeAgo(build.startedAt, props.state.locale, props.state.t)
                  : props.state.t("not-started")}
              </div>
            </div>
          </div>

          {build.message && (
            <>
              <wa-divider></wa-divider>
              <div class="wa-stack wa-gap-xs">
                <div class="wa-body-m">{build.message}</div>
                <div class="wa-cluster wa-gap-l">
                  {build.branch && (
                    <div class="wa-caption-s wa-color-text-quiet">
                      <wa-icon name="code-branch" style="margin-right: var(--wa-space-3xs)"></wa-icon>
                      {build.branch}
                    </div>
                  )}
                  {build.commit && (
                    <div class="wa-caption-s wa-color-text-quiet">
                      <wa-icon name="code-commit" style="margin-right: var(--wa-space-3xs)"></wa-icon>
                      {build.commit.substring(0, 8)}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </header>
        <wa-divider></wa-divider>
        <section>
          <h2 class="wa-heading-m">{props.state.t("jobs-heading")}</h2>
          <BuildJobs
            buildId={build.id}
            buildNumber={build.number}
            pipelineSlug={pipelineSlug}
            initialJobs={jobs}
          />
        </section>
      </div>
    </Layout>
  )
}
