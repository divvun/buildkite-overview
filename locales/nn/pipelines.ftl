# Pipelines-sidestrenger
pipelines-title = Alle Pipelines
pipelines-description = Handter og overvak alle Buildkite-pipelines på tvers av organisasjonar

# Pipeline-filter
filter-search-placeholder = Søk pipelines...
filter-status-all = Alle statusar
filter-status-running = Køyrer
filter-status-passed = Bestått
filter-status-failed = Feila
filter-status-pending = Ventar
filter-status-canceled = Avbrote
filter-status-blocked = Blokkert
clear-filters = Fjern filter

# Pipeline-liste
pipeline-name = Pipeline
pipeline-status = Status
pipeline-last-build = Siste bygg
pipeline-repo = Repository
pipeline-tags = Merkelappar
no-pipelines = Ingen pipelines funne
no-pipelines-description = Ingen pipelines passar med dei gjeldande filtera.

# Pipeline-detaljar
build-history = Bygghistorikk
recent-builds = Nye bygg
pipeline-settings = Pipeline-innstillingar
pipeline-triggers = Utløysarar
pipeline-description = Skildring
last-successful-build = Siste vellukka bygg
last-failed-build = Siste feila bygg
builds-count = {$count ->
    [one] {$count} bygg
   *[other] {$count} bygg
}

# Pipeline-statusmeldingar
pipeline-never-built = Aldri bygd
pipeline-load-failed = Kunne ikkje laste pipelines
pipeline-load-error = Kunne ikkje laste pipelines frå Buildkite. Dette tyder vanlegvis på eit autentiseringsproblem. Kontroller at BUILDKITE_API_KEY-miljøvariabelen din er sett korrekt og har dei nødvendige løyva.

# Bygghandlingar
trigger-build = Utløys bygg
view-pipeline = Vis pipeline
view-build = Vis bygg

# Byggstatuser (for jobtilstandar)
status-passed = BESTÅTT
status-finished = FERDIG
status-failed = FEILA
status-canceled = AVBROTE
status-running = KØYRER
status-scheduled = PLANLAGD
status-creating = OPPRETTAR
status-waiting = VENTAR
status-blocked = BLOKKERT
status-canceling = AVBRYT
status-waiting-failed = VENTING_FEILA

# Paginering placeholder
status-placeholder = Status

# Bygghistorikk tooltip og detaljar
build-number-prefix = Bygg
view-build-arrow = Vis bygg ↗
view-pipeline-arrow = Vis pipeline →

# Lastar og feiltilstandar for bygg
loading-builds = Lastar bygg...
no-initial-builds = Ingen tidlegare bygg oppgitt, hentar frå API...
initial-builds-count = tidlegare bygg

# Sidetitlar for feiltilstandar
pipeline-not-found-title = Pipeline ikkje funne
build-not-found-title = Bygg ikkje funne

# Fleire manglande strengar
failed-to-load-pipelines = Kunne ikkje laste pipeline-data
build-stats = Byggstatistikk
passed-count = bestått
failed-count = mislukkast
last-build = Siste bygg
all-status = Alle statusar
first-page = Første side
previous-page = Førre side
next-page = Neste side
last-page = Siste side
showing-results = Viser {$start}-{$end} av {$total} pipelines

# Filter-plasshalderar
filter-pipelines-placeholder = Filtrer pipelines...
status-placeholder = Status

# Pipeline-vising
no-repository = Ingen repository
no-pipelines-found-title = Ingen pipelines funne
no-pipelines-filter-desc = Ingen pipelines passar med dei gjeldande filtera. Prøv å justere søk eller filter.
refreshing = Oppdaterer...
new-build = Nytt bygg
clear-all-filters = Fjern alle filter
total-builds = Tal på bygg
success-rate = Suksessrate
visibility = Synlegheit
repository-access = Repository-tilgang
last-build-label = Siste bygg