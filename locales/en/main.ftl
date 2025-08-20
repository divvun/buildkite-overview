# Main UI strings
app-title = Divvun Buildkite
nav-overview = Overview
nav-pipelines = Pipelines
nav-agents = Agents
nav-queues = Queues
login = Login
logout = Logout

# Language selection
select-language = Select language
language-english = English
language-norwegian-bokmal = Norwegian Bokmål
language-norwegian-nynorsk = Norwegian Nynorsk

# Common UI elements
loading = Loading...
error = Error
refresh = Refresh
refreshing = Refreshing...
refreshing-data = Refreshing data...
auto-refresh-on = Auto-refresh ON (every {$interval}s)
auto-refresh-off = Auto-refresh OFF
auto-refresh-background = Auto-refresh ON (background mode: every {$interval}s)
enable-auto-refresh = Enable auto-refresh
disable-auto-refresh = Disable auto-refresh

# Navigation and UI labels
buildkite-logo = Buildkite logo
dashboard-overview = Dashboard overview
view-all-pipelines = View all pipelines
view-build-agents = View build agents
view-build-queues = View build queues
sign-in-github = Sign in with GitHub
toggle-navigation-menu = Toggle navigation menu
menu = Menu
breadcrumb-navigation = Breadcrumb navigation
go-to-homepage = Go to homepage
home = Home
main-content = Main content
secondary-navigation = Secondary navigation

# Page titles and descriptions
buildkite-overview = Buildkite Overview
access-denied = Access Denied
pipelines-breadcrumb = Pipelines
agents-breadcrumb = Agents
queues-breadcrumb = Queues

# Pagination
first-page = First page
previous-page = Previous page
next-page = Next page
last-page = Last page

# Generic states
no-repository = No repository
no-commit-message = No commit message
no-specific-requirements = No specific requirements
unknown = Unknown
never-built = Never built
not-started = Not started
not-finished = Not finished

# Time and status
started = Started
finished = Finished

# User actions
try-different-account = Try Different Account
view-github-profile = View GitHub Profile

# Build-related
build-not-found = Build not found
pipeline-not-found = Pipeline not found
insufficient-permissions = Insufficient permissions
access-denied-description = Access denied
invalid-build-number = Invalid build number
failed-load-build-details = Failed to load build details

# Job logs
show-timestamps = Show
hide-timestamps = Hide
timestamps = Timestamps

# Queue management
default-queue = Default
unassigned = Unassigned
unassigned-agents = Unassigned Agents
queue-prefix = Queue

# Status badges
status-running = Running
status-passed = Passed
status-failed = Failed
status-pending = Pending
status-canceled = Canceled
status-skipped = Skipped
status-blocked = Blocked

# Time formatting
time-ago = {$time} ago
duration-value = {$duration}
seconds = {$count ->
    [one] {$count} second
   *[other] {$count} seconds
}
minutes = {$count ->
    [one] {$count} minute
   *[other] {$count} minutes
}
hours = {$count ->
    [one] {$count} hour
   *[other] {$count} hours
}
days = {$count ->
    [one] {$count} day
   *[other] {$count} days
}

# Error messages for API and network issues
failed-fetch-pipelines = Failed to fetch pipelines
failed-fetch-builds = Failed to fetch builds
failed-fetch-jobs = Failed to fetch build jobs
failed-fetch-agents = Failed to fetch agents data
failed-fetch-queues = Failed to fetch queues data
failed-cache-status = Failed to fetch cache status
failed-cache-action = Failed to perform cache action
failed-job-logs = Failed to fetch job logs from Buildkite API
buildkite-api-key-not-configured = Buildkite API key not configured
access-denied-logs = Access denied to job logs. This may be due to insufficient API permissions or the logs may have been purged.
unknown-error = Unknown error
invalid-locale-data = Invalid locale data format
missing-build-slug = Missing build number or pipeline slug

# Footer
resources = Resources
divvun-buildkite-overview = Divvun Buildkite Overview
buildkite-dashboard = Buildkite Dashboard
github-divvun = GitHub - divvun
github-giellalt = GitHub - giellalt

# Visibility
visibility-unknown = Unknown

# Build details
no-builds-yet = No builds yet
started-label = Started

# Accessibility labels
view-all-pipelines-aria = View all {$count} pipelines
view-agents-wait-time-aria = View agents, current average wait time: {$waitTime}
view-queues-pending-aria = View queues, {$count} pending builds
view-failing-pipeline-aria = View details for failing pipeline: {$name}
build-status-title = Build #{$number}: {$status}
feature-coming-soon = Feature coming soon - trigger new builds from the interface
user-menu-aria = User menu for {$user}
go-to-breadcrumb-aria = Go to {$label}
pipeline-page-title = {$name} - Pipeline
build-page-title = Build #{$number} - {$pipeline}
build-not-found-title = Build Not Found
invalid-build-number = Invalid build number

# Connection states
connection-connected = connected
connection-disconnected = disconnected
connection-lost = lost

# Dashboard strings
failing-since = failing since {$time}
average-wait-time = Average Wait Time
builds-passed-failed = {$passed} passed, {$failed} failed

# Job pluralization
job-count = {$count ->
    [one] {$count} job
   *[other] {$count} jobs
}

# Build/Job labels
duration-label = Duration
started-label-colon = Started
build-number = Build #{$number}
job-number = Job #{$id}

# Auth page
try-different-account = Try Different Account
sign-in-github = Sign in with GitHub

# Unauthorized access
access-denied = Access Denied
unauthorized-description = You need to be a member of the divvun organization to access this page.
what-you-can-do = What you can do:
contact-admin = Contact your administrator to request access to the divvun organization
verify-account = Verify you're signed in with the correct GitHub account
accept-invitation = Make sure you've accepted the organization invitation if one was sent
return-to-dashboard = Return to Dashboard
sign-out = Sign Out

# Default app title
default-app-title = Buildkite Overview

# Login page
login-page-title = Sign In - Buildkite Overview
divvun-buildkite = Divvun Buildkite
login-description = Sign in with your GitHub account to access the build overview dashboard
auth-failed = Authentication failed. Please try again.
invalid-auth-response = Invalid authentication response.
security-validation-failed = Security validation failed. Please try again.
insufficient-access-error = You don't have access to the required GitHub organizations (divvun or giellalt). You may need to re-authenticate to update your organization permissions.
auth-error-occurred = Authentication error occurred. Please try again.
choose-different-account-desc = Choose a different account or re-authorize to update organization permissions
review-app-permissions = review app permissions on GitHub
requires-membership = Requires membership of {$org1} or {$org2} organizations
access-description = We only access your public profile and organization membership

# Profile and images
profile-picture-alt = {$user} profile picture

# Loading and empty states
loading-ellipsis = Loading...
no-recent-builds = No recent builds found
failed-status = FAILED
refreshing-ellipsis = Refreshing...
job-fallback = Job

# Time formatting - special cases
time-now = now
time-never = Never
time-unknown = Unknown
time-minutes-ago = {$count ->     
    [one] {$count} minute ago
   *[other] {$count} minutes ago
}
time-hours-ago = {$count ->     
    [one] {$count} hour ago
   *[other] {$count} hours ago
}
time-days-ago = {$count ->     
    [one] {$count} day ago
   *[other] {$count} days ago
}

# Error messages
build-not-found-in-pipeline = Build #{$number} not found in pipeline "{$pipeline}". Available builds: {$builds}

# Authentication for protected resources
sign-in-with-github = Sign in with GitHub
login-required-logs-title = Authentication Required
login-required-logs-description = Build logs may contain sensitive information. Please sign in with your GitHub account to view them.
login-required-private-pipeline-title = Private Pipeline
login-required-private-pipeline-description = This pipeline is private. Please sign in to verify your access.
login-required-admin-title = Admin Access Required
login-required-admin-description = This page requires administrator privileges.
login-secure-note = Your connection is secure and encrypted.