# Dashboard page strings
dashboard-title = Build Overview
dashboard-description = Monitor the status of all Divvun project builds across GitHub organizations

# Dashboard stats
stats-total-pipelines = Total Pipelines
stats-running-pipelines = Running Pipelines
stats-pending-builds = Pending Builds
stats-available-agents = Available Agents
stats-average-wait-time = Average Wait Time
stats-p95-wait-time = 95th Percentile Wait Time
stats-p99-wait-time = 99th Percentile Wait Time

# Recent builds section
recent-builds-title = Recent Builds
recent-builds-description = Latest build activity across all pipelines

# Failing pipelines section
failing-pipelines-title = Failing Pipelines
failing-pipelines-description = Pipelines that require attention
failing-since = Failing since {$time}
no-failing-pipelines = No failing pipelines! 🎉
no-failing-pipelines-description = All pipelines are healthy. Great work!

# Build status messages
build-number = Build #{$number}
build-url-text = View build ↗
pipeline-url-text = View pipeline →
view-details = View details
view-logs = View logs

# Empty states
no-recent-builds = No recent builds
no-recent-builds-description = No build activity to show yet.
dashboard-load-failed = Failed to load dashboard data
dashboard-load-error = Unable to load dashboard data. This could be due to: 1) Missing BUILDKITE_API_KEY environment variable, 2) Invalid API key, or 3) Network connectivity issues. Please check your configuration and try again.

# Additional empty states
no-failing-pipelines-title = No failing pipelines! 🎉
no-failing-pipelines-desc = All pipelines are currently healthy.