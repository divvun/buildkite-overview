# Pipelines-sidestrenger
pipelines-title = Alle kommandokøar
pipelines-description = Handter og overvak alle Buildkite-kommandokøar på tvers av organisasjonar

# Pipeline-filter
filter-search-placeholder = Søk kommandokøar...
filter-status-all = Alle statusar
filter-status-running = Køyrer
filter-status-passed = Bestått
filter-status-failed = Feila
filter-status-pending = Ventar
filter-status-canceled = Avbrote
filter-status-blocked = Blokkert
clear-filters = Fjern filter

# Pipeline-liste
pipeline-name = Kommandokø
pipeline-status = Status
pipeline-last-build = Siste bygg
pipeline-repo = Repositorium
pipeline-tags = Merkelappar
no-pipelines = Ingen kommandokøar funne
no-pipelines-description = Ingen kommandokøar passar med dei gjeldande filtera.

# Pipeline-detaljar
build-history = Byggjehistorikk
recent-builds = Nye bygg
pipeline-settings = Kommandokø-innstillingar
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
pipeline-load-failed = Kunne ikkje lasta inn kommandokøar
pipeline-load-error = Kunne ikkje lasta kommandokøar frå Buildkite. Dette tyder vanlegvis på eit autentiseringsproblem. Kontroller at BUILDKITE_API_KEY-miljøvariabelen din er sett korrekt og har dei nødvendige løyva.

# Bygghandlingar
trigger-build = Set i gang bygg
view-pipeline = Vis kommandokø
view-build = Vis bygg

# Byggstatuser (for jobtilstandar)
status-passed = FULLFØRT
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
view-pipeline-arrow = Vis kommandokø →

# Lastar og feiltilstandar for bygg
loading-builds = Lastar bygg...
no-initial-builds = Ingen tidlegare bygg oppgitt, hentar frå API...
initial-builds-count = tidlegare bygg

# Sidetitlar for feiltilstandar
pipeline-not-found-title = Kommandokø ikkje funne
build-not-found-title = Bygg ikkje funne

# Fleire manglande strengar
failed-to-load-pipelines = Kunne ikkje lasta kommandokødata
build-stats = Byggstatistikk
passed-count = fullførde
failed-count = mislukkast
last-build = Siste bygg
all-status = Alle statusar
first-page = Første side
previous-page = Førre side
next-page = Neste side
last-page = Siste side
showing-results = Viser {$start}-{$end} av {$total} kommandokøar

# Filter-plasshalderar
filter-pipelines-placeholder = Filtrer kommandokøar...
status-placeholder = Status

# Pipeline-vising
no-repository = Ingen repositorium
no-pipelines-found-title = Ingen kommandokøar funne
no-pipelines-filter-desc = Ingen kommandokøar passar med dei gjeldande filtera. Prøv å justera søk eller filter.
refreshing = Oppdaterer...
new-build = Nytt bygg
clear-all-filters = Fjern alle filter
total-builds = Tal på bygg
success-rate = Suksessrate
visibility = Synlegheit
repository-access = Repositorietilgang
last-build-label = Siste bygg