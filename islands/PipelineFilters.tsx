import { useEffect, useState } from "preact/hooks"

interface PipelineFiltersProps {
  initialSearch?: string
  initialStatus?: string
}

export default function PipelineFilters({ initialSearch = "", initialStatus = "" }: PipelineFiltersProps) {
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
          placeholder="Filter pipelines..."
          style="min-width: 300px"
          value={search}
          onInput={(e: Event) => setSearch((e.target as HTMLInputElement).value)}
          onKeyDown={handleSearchKeyDown}
        >
          <wa-icon slot="prefix" name="magnifying-glass"></wa-icon>
        </wa-input>
      </form>

      <wa-select
        placeholder="Status"
        value={status}
        onChange={handleStatusChange}
      >
        <wa-option value="">All Status</wa-option>
        <wa-option value="passed">Passed</wa-option>
        <wa-option value="failed">Failed</wa-option>
        <wa-option value="running">Running</wa-option>
        <wa-option value="cancelled">Cancelled</wa-option>
        <wa-option value="neutral">Neutral</wa-option>
        <wa-option value="unknown">Unknown</wa-option>
      </wa-select>
    </div>
  )
}
