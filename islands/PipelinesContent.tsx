/// <reference path="../types/webawesome.d.ts" />
import { useCallback, useEffect, useState } from "preact/hooks"
import EmptyState from "~/components/EmptyState.tsx"
import SkeletonLoader from "~/components/SkeletonLoader.tsx"
import { type AppPipeline } from "~/types/app.ts"
import {
  getBadgeVariant,
  getHealthBorderStyle,
  getStatusIcon,
  getTranslatedStatus,
  isRunningStatus,
} from "~/utils/formatters.ts"
import { useLocalization } from "~/utils/localization-context.tsx"

interface PipelinesData {
  pipelines: AppPipeline[]
  statusFilter?: string
  searchQuery?: string
  error?: string
}

interface PipelinesContentProps {
  statusFilter?: string
  searchQuery?: string
}

const PIPELINES_PER_PAGE = 24 // 3 columns x 8 rows

export default function PipelinesContent({ statusFilter, searchQuery }: PipelinesContentProps) {
  const { t } = useLocalization()
  const [data, setData] = useState<PipelinesData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [showSkeletonOnRefresh, setShowSkeletonOnRefresh] = useState(false)

  console.log("PipelinesContent: Component rendered")

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)

      // Show skeleton only if we have existing data (refresh scenario)
      if (data?.pipelines && data.pipelines.length > 0) {
        setShowSkeletonOnRefresh(true)
      }

      // Build URL with current filters
      const url = new URL("/api/pipelines", globalThis.location.origin)
      if (statusFilter) {
        url.searchParams.set("status", statusFilter)
      }
      if (searchQuery) {
        url.searchParams.set("search", searchQuery)
      }

      const response = await fetch(url.toString())
      if (response.ok) {
        const newData = await response.json()
        setData(newData)
      } else {
        console.error("Failed to fetch pipelines data:", response.status)
      }
    } catch (error) {
      console.error("Error fetching pipelines data:", error)
    } finally {
      setIsLoading(false)
      setShowSkeletonOnRefresh(false)
    }
  }, [statusFilter, searchQuery])

  useEffect(() => {
    console.log("PipelinesContent: Setting up autorefresh event listener")

    const handleRefresh = () => {
      console.log("PipelinesContent: Received autorefresh event")
      fetchData()
    }

    // Listen for refresh events from AutoRefresh component
    globalThis.addEventListener("autorefresh", handleRefresh)

    return () => {
      console.log("PipelinesContent: Removing autorefresh event listener")
      globalThis.removeEventListener("autorefresh", handleRefresh)
    }
  }, [])

  // Add fetch on mount
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Show loading state initially
  if (!data && isLoading) {
    return (
      <div class="wa-stack wa-gap-l">
        <div
          class="pipeline-grid"
          style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--wa-space-m)"
        >
          {Array.from({ length: 6 }).map((_, i) => <SkeletonLoader key={i} height="120px" />)}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <wa-callout variant="danger">
        <wa-icon slot="icon" name="triangle-exclamation"></wa-icon>
        {t("failed-to-load-pipelines")}
      </wa-callout>
    )
  }

  const { pipelines, error } = data

  // Pagination logic
  const totalPages = Math.ceil(pipelines.length / PIPELINES_PER_PAGE)
  const startIndex = (currentPage - 1) * PIPELINES_PER_PAGE
  const endIndex = startIndex + PIPELINES_PER_PAGE
  const paginatedPipelines = pipelines.slice(startIndex, endIndex)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [data?.statusFilter, data?.searchQuery])

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    // Scroll to top when page changes
    globalThis.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <div class="wa-stack wa-gap-l">
      {error && (
        <wa-callout variant="danger">
          <wa-icon slot="icon" name="triangle-exclamation"></wa-icon>
          {error}
        </wa-callout>
      )}

      <div
        class="wa-gap-m"
        style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: var(--wa-space-m)"
      >
        {showSkeletonOnRefresh
          ? (
            // Show skeleton loaders during refresh
            Array.from(
              { length: Math.min(PIPELINES_PER_PAGE, 12) },
              (_, i) => <SkeletonLoader key={i} variant="pipeline" />,
            )
          )
          : pipelines.length === 0 && !error
          ? (
            <EmptyState
              icon="folder-open"
              title={t("no-pipelines-found-title")}
              description={searchQuery || statusFilter
                ? t("no-pipelines-filter-desc")
                : `No Buildkite pipelines found. Check your API configuration or create your first pipeline.`}
              variant="neutral"
            >
              {(searchQuery || statusFilter) && (
                <wa-button appearance="outlined">
                  <a href="/pipelines" style="text-decoration: none; color: inherit">
                    {t("clear-all-filters")}
                  </a>
                </wa-button>
              )}
            </EmptyState>
          )
          : (
            paginatedPipelines.map((pipeline) => (
              <div key={pipeline.id}>
                <wa-card class="clickable-card" style={getHealthBorderStyle(pipeline.status)}>
                  <a
                    href={`/pipelines/${pipeline.slug}`}
                    style="text-decoration: none; color: inherit; display: block"
                  >
                    <div class="wa-stack wa-gap-s">
                      <div class="wa-flank">
                        <div class="wa-stack wa-gap-3xs">
                          <div class="wa-flank wa-gap-xs">
                            {isRunningStatus(pipeline.status)
                              ? (
                                <wa-spinner style="color: var(--wa-color-warning-fill-loud)">
                                </wa-spinner>
                              )
                              : (
                                <wa-icon
                                  name={getStatusIcon(pipeline.status)}
                                  style={`color: var(--wa-color-${getBadgeVariant(pipeline.status)}-fill-loud)`}
                                >
                                </wa-icon>
                              )}
                            <span class="wa-heading-s">{pipeline.name}</span>
                          </div>
                          <div class="wa-caption-s wa-color-text-quiet">{pipeline.repo || t("no-repository")}</div>
                        </div>
                      </div>

                      <wa-badge variant={getBadgeVariant(pipeline.status)}>
                        {getTranslatedStatus(pipeline.status, t)}
                      </wa-badge>
                      <div class="wa-cluster wa-gap-xs" style="flex-wrap: wrap; min-height: 24px">
                        {pipeline.tags.map((tag) => <wa-tag key={tag}>{tag}</wa-tag>)}
                      </div>

                      <wa-divider></wa-divider>

                      <div class="wa-flank">
                        <div class="wa-stack wa-gap-3xs">
                          <div class="wa-caption-s">{t("build-stats")}</div>
                          <div class="wa-cluster wa-gap-s">
                            <span class="wa-caption-xs">
                              <wa-badge variant="success">{pipeline.builds.passed}</wa-badge> {t("passed-count")}
                            </span>
                            <span class="wa-caption-xs">
                              <wa-badge variant="danger">{pipeline.builds.failed}</wa-badge> {t("failed-count")}
                            </span>
                          </div>
                        </div>
                        <div class="wa-stack wa-gap-3xs wa-align-items-end">
                          <div class="wa-caption-s">{t("last-build")}</div>
                          <div class="wa-caption-xs wa-color-text-quiet">{pipeline.lastBuild}</div>
                        </div>
                      </div>
                    </div>
                  </a>
                </wa-card>
              </div>
            ))
          )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div class="wa-stack wa-gap-s wa-align-items-center">
          <div class="wa-cluster wa-gap-s wa-align-items-center">
            <wa-button
              size="small"
              appearance="outlined"
              disabled={currentPage === 1}
              onClick={() => handlePageChange(1)}
              title={t("first-page")}
            >
              <wa-icon name="angles-left" />
            </wa-button>

            <wa-button
              size="small"
              appearance="outlined"
              disabled={currentPage === 1}
              onClick={() => handlePageChange(currentPage - 1)}
              title={t("previous-page")}
            >
              <wa-icon name="chevron-left" />
            </wa-button>

            <div class="wa-cluster wa-gap-2xs">
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                let pageNum: number

                if (totalPages <= 7) {
                  // Show all pages if 7 or fewer
                  pageNum = i + 1
                } else if (currentPage <= 4) {
                  // Show first 7 pages
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 3) {
                  // Show last 7 pages
                  pageNum = totalPages - 6 + i
                } else {
                  // Show current page ± 3
                  pageNum = currentPage - 3 + i
                }

                return (
                  <wa-button
                    key={pageNum}
                    size="small"
                    variant={currentPage === pageNum ? "brand" : "neutral"}
                    appearance={currentPage === pageNum ? "filled" : "outlined"}
                    onClick={() => handlePageChange(pageNum)}
                  >
                    {pageNum}
                  </wa-button>
                )
              })}
            </div>

            <wa-button
              size="small"
              appearance="outlined"
              disabled={currentPage === totalPages}
              onClick={() => handlePageChange(currentPage + 1)}
              title={t("next-page")}
            >
              <wa-icon name="chevron-right" />
            </wa-button>

            <wa-button
              size="small"
              appearance="outlined"
              disabled={currentPage === totalPages}
              onClick={() => handlePageChange(totalPages)}
              title={t("last-page")}
            >
              <wa-icon name="angles-right" />
            </wa-button>
          </div>

          <div class="wa-caption-s wa-color-text-quiet">
            {t("showing-results", {
              start: startIndex + 1,
              end: Math.min(endIndex, pipelines.length),
              total: pipelines.length,
            })}
          </div>
        </div>
      )}
    </div>
  )
}
