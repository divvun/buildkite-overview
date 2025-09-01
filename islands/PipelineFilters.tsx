import { useState } from "preact/hooks"
import { useLocalization } from "~/utils/localization-context.tsx"

interface PipelineFiltersProps {
  initialSearch?: string
  initialStatus?: string
}

export default function PipelineFilters({ initialSearch = "", initialStatus = "" }: PipelineFiltersProps) {
  const { t } = useLocalization()
  const [search, setSearch] = useState(initialSearch)
  const [status, setStatus] = useState(initialStatus)

  const updateUrl = (newSearch: string, newStatus: string) => {
    const url = new URL(globalThis.location.href)

    if (newSearch.trim()) {
      url.searchParams.set("search", newSearch.trim())
    } else {
      url.searchParams.delete("search")
    }

    if (newStatus) {
      url.searchParams.set("status", newStatus)
    } else {
      url.searchParams.delete("status")
    }

    globalThis.location.href = url.toString()
  }

  const handleSearchSubmit = (e: Event) => {
    e.preventDefault()
    updateUrl(search, status)
  }

  const handleSearchKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      const form = (e.currentTarget as HTMLElement).closest("form")
      form?.requestSubmit()
    }
  }

  const handleStatusChange = (e: Event) => {
    const newStatus = (e.target as HTMLSelectElement)?.value || ""
    setStatus(newStatus)
    updateUrl(search, newStatus)
  }

  return (
    <div class="wa-cluster wa-gap-m">
      <form
        method="GET"
        style="display: contents"
        onSubmit={handleSearchSubmit}
      >
        <wa-input
          name="search"
          placeholder={t("filter-pipelines-placeholder")}
          style="min-width: 300px"
          value={search}
          onInput={(e: Event) => setSearch((e.target as HTMLInputElement).value)}
          onKeyDown={handleSearchKeyDown}
        >
          <wa-icon slot="prefix" name="search"></wa-icon>
        </wa-input>
      </form>

      <wa-select
        placeholder={t("status-placeholder")}
        value={status}
        onChange={handleStatusChange}
      >
        <wa-option value="">{t("all-status")}</wa-option>
        <wa-option value="passed">{t("status-passed")}</wa-option>
        <wa-option value="failed">{t("status-failed")}</wa-option>
        <wa-option value="running">{t("status-running")}</wa-option>
        <wa-option value="canceled">{t("status-canceled")}</wa-option>
        <wa-option value="neutral">{t("status-neutral")}</wa-option>
        <wa-option value="unknown">{t("status-unknown")}</wa-option>
      </wa-select>
    </div>
  )
}
