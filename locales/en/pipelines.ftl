# Pipelines page strings
pipelines-title = All Pipelines
pipelines-description = Manage and monitor all Buildkite pipelines across organizations

# Pipeline filters
filter-search-placeholder = Search pipelines...
filter-status-all = All Statuses
filter-status-running = Running
filter-status-passed = Passed
filter-status-failed = Failed
filter-status-pending = Pending
filter-status-canceled = Canceled
filter-status-blocked = Blocked
clear-filters = Clear filters

# Pipeline list
pipeline-name = Pipeline
pipeline-status = Status
pipeline-last-build = Last Build
pipeline-repo = Repository
pipeline-tags = Tags
no-pipelines = No pipelines found
no-pipelines-description = No pipelines match your current filters.

# Pipeline details
build-history = Build History
recent-builds = Recent Builds
pipeline-settings = Pipeline Settings
pipeline-triggers = Triggers
pipeline-description = Description
last-successful-build = Last successful build
last-failed-build = Last failed build
builds-count = {$count ->
    [one] {$count} build
   *[other] {$count} builds
}

# Pipeline status messages
pipeline-never-built = Never built
pipeline-load-failed = Failed to load pipelines
pipeline-load-error = Unable to load pipelines from Buildkite. This usually indicates an authentication issue. Please verify your BUILDKITE_API_KEY environment variable is set correctly and has the necessary permissions.

# Build actions
trigger-build = Trigger Build
view-pipeline = View Pipeline
view-build = View Build

# Build statuses (for job states)
status-passed = Passed
status-finished = Finished
status-failed = Failed
status-canceled = Canceled
status-running = Running
status-scheduled = Scheduled
status-creating = Creating
status-waiting = Waiting
status-blocked = Blocked
status-canceling = Canceling
status-waiting-failed = Waiting Failed
status-neutral = Neutral
status-unknown = Unknown

# Pagination placeholder
status-placeholder = Status

# Build history tooltip and details
build-number-prefix = Build
view-build-arrow = View build ↗
view-pipeline-arrow = View pipeline →

# Loading and error states for builds
loading-builds = Loading builds...
no-initial-builds = No initial builds provided, fetching from API...
initial-builds-count = initial builds

# Page titles for error states
pipeline-not-found-title = Pipeline Not Found
build-not-found-title = Build Not Found

# Additional missing strings
failed-to-load-pipelines = Failed to load pipelines data
build-stats = Build Stats
passed-count = passed
failed-count = failed
last-build = Last Build
all-status = All Status
first-page = First page
previous-page = Previous page
next-page = Next page
last-page = Last page
showing-results = Showing {$start}-{$end} of {$total} pipelines

# Filter placeholders
filter-pipelines-placeholder = Filter pipelines...
status-placeholder = Status

# Pipeline display
no-repository = No repository
no-pipelines-found-title = No pipelines found
no-pipelines-filter-desc = No pipelines match your current filters. Try adjusting your search or filters.
refreshing = Refreshing...
new-build = New Build
clear-all-filters = Clear all filters
total-builds = Total Builds
success-rate = Success Rate
visibility = Visibility
repository-access = Repository access
last-build-label = Last build

# New build creation
creating-build = Creating Build...
failed-to-create-build = Failed to create build
error-creating-build = Error creating build