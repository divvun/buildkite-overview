# Pipelines-sidestrenger
pipelines-title = Alle pipelines
pipelines-description = Administrer og overvåk alle Buildkite-pipelines på tvers av organisasjoner

# Pipeline-filtre
filter-search-placeholder = Søk pipelines...
filter-status-all = Alle statuser
filter-status-running = Kjører
filter-status-passed = Bestått
filter-status-failed = Feilet
filter-status-pending = Venter
filter-status-canceled = Avbrutt
filter-status-blocked = Blokkert
clear-filters = Tøm filtre

# Pipeline-liste
pipeline-name = Pipeline
pipeline-status = Status
pipeline-last-build = Siste bygg
pipeline-repo = Repository
pipeline-tags = Merker
no-pipelines = Ingen pipelines funnet
no-pipelines-description = Ingen pipelines matcher dine nåværende filtre.

# Pipeline-detaljer
build-history = Bygghistorikk
recent-builds = Nylige bygg
pipeline-settings = Pipeline-innstillinger
pipeline-triggers = Utløsere
pipeline-description = Beskrivelse
last-successful-build = Siste vellykkede bygg
last-failed-build = Siste feilede bygg
builds-count = {$count ->
    [one] {$count} bygg
   *[other] {$count} bygg
}

# Pipeline-statusmeldinger
pipeline-never-built = Aldri bygget
pipeline-load-failed = Kunne ikke laste pipelines
pipeline-load-error = Kunne ikke laste pipelines fra Buildkite. Dette indikerer vanligvis et autentiseringsproblem. Vennligst verifiser at BUILDKITE_API_KEY-miljøvariabelen er satt riktig og har nødvendige tillatelser.

# Bygghandlinger
trigger-build = Utløs bygg
view-pipeline = Vis pipeline
view-build = Vis bygg

# Byggstatuser (for jobtilstander)
status-passed = BESTÅTT
status-finished = FERDIG
status-failed = FEILET
status-canceled = AVBRUTT
status-running = KJØRER
status-scheduled = PLANLAGT
status-creating = OPPRETTER
status-waiting = VENTER
status-blocked = BLOKKERT
status-canceling = AVBRYTER
status-waiting-failed = VENTING_FEILET
status-neutral = NØYTRAL
status-unknown = UKJENT

# Paginering placeholder
status-placeholder = Status

# Bygghistorikk tooltip og detaljer
build-number-prefix = Bygg
view-build-arrow = Vis bygg ↗
view-pipeline-arrow = Vis pipeline →

# Laster og feiltilstander for bygg
loading-builds = Laster bygg...
no-initial-builds = Ingen opprinnelige bygg oppgitt, henter fra API...
initial-builds-count = opprinnelige bygg

# Sidetitler for feiltilstander
pipeline-not-found-title = Pipeline ikke funnet
build-not-found-title = Bygg ikke funnet

# Flere manglende strenger
failed-to-load-pipelines = Kunne ikke laste pipeline-data
build-stats = Byggstatistikk
passed-count = bestått
failed-count = feilet
last-build = Siste bygg
all-status = Alle statuser
first-page = Første side
previous-page = Forrige side
next-page = Neste side
last-page = Siste side
showing-results = Viser {$start}-{$end} av {$total} pipelines

# Filter-plassholdere
filter-pipelines-placeholder = Filtrer pipelines...
status-placeholder = Status

# Pipeline-visning
no-repository = Ingen repository
no-pipelines-found-title = Ingen pipelines funnet
no-pipelines-filter-desc = Ingen pipelines matcher dine nåværende filtre. Prøv å justere søk eller filtre.
refreshing = Oppdaterer...
new-build = Nytt bygg
clear-all-filters = Fjern alle filtre
total-builds = Totalt antall bygg
success-rate = Suksessrate
visibility = Synlighet
repository-access = Repository-tilgang
last-build-label = Siste bygg

# New build creation
creating-build = Oppretter bygg...
failed-to-create-build = Klarte ikke å opprette bygg
error-creating-build = Feil ved opprettelse av bygg
