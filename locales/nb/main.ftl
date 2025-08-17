# Hovedgrensesnitt-strenger
app-title = Divvun Buildkite
nav-overview = Oversikt
nav-pipelines = Pipelines
nav-agents = Agenter
nav-queues = Køer
login = Logg inn
logout = Logg ut

# Language selection
select-language = Velg språk
language-english = Engelsk
language-norwegian-bokmal = Norsk bokmål
language-norwegian-nynorsk = Norsk nynorsk

# Vanlige UI-elementer
loading = Laster...
error = Feil
refresh = Oppdater
refreshing = Oppdaterer...
refreshing-data = Oppdaterer data...
auto-refresh-on = Automatisk oppdatering PÅ (hver {$interval}. sekund)
auto-refresh-off = Automatisk oppdatering AV
auto-refresh-background = Automatisk oppdatering PÅ (bakgrunnsmodus: hver {$interval}. sekund)
enable-auto-refresh = Aktiver automatisk oppdatering
disable-auto-refresh = Deaktiver automatisk oppdatering

# Navigasjon og UI-etiketter
buildkite-logo = Buildkite-logo
dashboard-overview = Dashboard-oversikt
view-all-pipelines = Se alle pipelines
view-build-agents = Se alle build-agenter
view-build-queues = Se alle build-køer
sign-in-github = Logg inn med GitHub
toggle-navigation-menu = Slå av/på navigasjonsmeny
menu = Meny
breadcrumb-navigation = Brødsmulenavigasjon
go-to-homepage = Gå til hjemmeside
home = Hjem
main-content = Hovedinnhold
secondary-navigation = Sekundær navigasjon

# Sidetitler og beskrivelser
buildkite-overview = Buildkite-oversikt
access-denied = Tilgang nektet
pipelines-breadcrumb = Pipelines
agents-breadcrumb = Agenter
queues-breadcrumb = Køer

# Paginering
first-page = Første side
previous-page = Forrige side
next-page = Neste side
last-page = Siste side

# Generelle tilstander
no-repository = Ingen repository
no-commit-message = Ingen commit-melding
no-specific-requirements = Ingen spesifikke krav
unknown = Ukjent
never-built = Aldri bygget
not-started = Ikke startet
not-finished = Ikke ferdig

# Tid og status
started = Startet
finished = Ferdig

# Brukerhandlinger
try-different-account = Prøv en annen konto
view-github-profile = Se GitHub-profil

# Build-relatert
build-not-found = Build ikke funnet
pipeline-not-found = Pipeline ikke funnet
insufficient-permissions = Utilstrekkelige tillatelser
access-denied-description = Tilgang nektet
invalid-build-number = Ugyldig build-nummer
failed-load-build-details = Kunne ikke laste build-detaljer

# Job-logger
show-timestamps = Vis
hide-timestamps = Skjul
timestamps = Tidsstempler

# Køadministrasjon
default-queue = Standard
unassigned = Ikke tildelt
unassigned-agents = Ikke-tildelte agenter
queue-prefix = Kø

# Statusmerker
status-running = Kjører
status-passed = Bestått
status-failed = Feilet
status-pending = Venter
status-canceled = Avbrutt
status-skipped = Hoppet over
status-blocked = Blokkert

# Tidsformatering
time-ago = {$time} siden
duration = {$duration}
seconds = {$count ->
    [one] {$count} sekund
   *[other] {$count} sekunder
}
minutes = {$count ->
    [one] {$count} minutt
   *[other] {$count} minutter
}
hours = {$count ->
    [one] {$count} time
   *[other] {$count} timer
}
days = {$count ->
    [one] {$count} dag
   *[other] {$count} dager
}

# Feilmeldinger for API og nettverksproblemer
failed-fetch-pipelines = Kunne ikke hente pipelines
failed-fetch-builds = Kunne ikke hente builds
failed-fetch-jobs = Kunne ikke hente build-jobber
failed-fetch-agents = Kunne ikke hente agentdata
failed-fetch-queues = Kunne ikke hente kødata
failed-cache-status = Kunne ikke hente cache-status
failed-cache-action = Kunne ikke utføre cache-handling
failed-job-logs = Kunne ikke hente job-logger fra Buildkite API
buildkite-api-key-not-configured = Buildkite API-nøkkel ikke konfigurert
access-denied-logs = Tilgang nektet til job-logger. Dette kan skyldes utilstrekkelige API-tillatelser eller at loggene er slettet.
unknown-error = Ukjent feil
invalid-locale-data = Ugyldig språkdata-format
missing-build-slug = Mangler build-nummer eller pipeline-slug

# Footer
resources = Ressurser
divvun-buildkite-overview = Divvun Buildkite Oversikt
buildkite-dashboard = Buildkite Dashboard
github-divvun = GitHub - divvun
github-giellalt = GitHub - giellalt

# Visibility
visibility-unknown = Ukjent

# Build details
no-builds-yet = Ingen bygg ennå
started-label = Startet

# Tilgjengelighetsetiketter
view-all-pipelines-aria = Vis alle {$count} pipelines
view-agents-wait-time-aria = Vis agenter, gjennomsnittlig ventetid: {$waitTime}
view-queues-pending-aria = Vis køer, {$count} ventende bygg
view-failing-pipeline-aria = Vis detaljer for feilende pipeline: {$name}
build-status-title = Bygg #{$number}: {$status}
feature-coming-soon = Funksjon kommer snart - utløs nye bygg fra grensesnittet
user-menu-aria = Brukermeny for {$user}
go-to-breadcrumb-aria = Gå til {$label}
pipeline-page-title = {$name} - Pipeline
build-page-title = Bygg #{$number} - {$pipeline}
build-not-found-title = Bygg ikke funnet
invalid-build-number = Ugyldig byggnummer

# Tilkoblingstilstander
connection-connected = tilkoblet
connection-disconnected = frakoblet
connection-lost = tapt

# Dashboard-strenger
failing-since = feiler siden {$time}
average-wait-time = Gjennomsnittlig ventetid
builds-passed-failed = {$passed} bestått, {$failed} feilet

# Jobb-flertall
job-count = {$count ->
    [one] {$count} jobb
   *[other] {$count} jobber
}

# Bygg/Jobb-etiketter
duration-label = Varighet
started-label-colon = Startet
build-number = Bygg #{$number}
job-number = Jobb #{$id}

# Autentiseringsside
try-different-account = Prøv annen konto
sign-in-github = Logg inn med GitHub

# Uautorisert tilgang
access-denied = Tilgang nektet
unauthorized-description = Du må være medlem av divvun-organisasjonen for å få tilgang til denne siden.
what-you-can-do = Hva du kan gjøre:
contact-admin = Kontakt administratoren din for å be om tilgang til divvun-organisasjonen
verify-account = Sjekk at du er logget inn med riktig GitHub-konto
accept-invitation = Sørg for at du har akseptert organisasjonsinvitasjonen hvis en ble sendt
return-to-dashboard = Tilbake til dashbord
sign-out = Logg ut

# Standard app-tittel
default-app-title = Buildkite-oversikt

# Innloggingsside
login-page-title = Logg inn - Buildkite-oversikt
divvun-buildkite = Divvun Buildkite
login-description = Logg inn med GitHub-kontoen din for å få tilgang til byggoversiktsdashbordet
auth-failed = Autentisering feilet. Vennligst prøv igjen.
invalid-auth-response = Ugyldig autentiseringsrespons.
security-validation-failed = Sikkerhetsvalidering feilet. Vennligst prøv igjen.
insufficient-access-error = Du har ikke tilgang til de nødvendige GitHub-organisasjonene (divvun eller giellalt). Du må kanskje autentisere på nytt for å oppdatere organisasjonstillatelsene dine.
auth-error-occurred = Autentiseringsfeil oppstod. Vennligst prøv igjen.
choose-different-account-desc = Velg en annen konto eller gi ny autorisasjon for å oppdatere organisasjonstillatelser
review-app-permissions = gjennomgå app-tillatelser på GitHub
requires-membership = Krever medlemskap i {$org1} eller {$org2} organisasjoner
access-description = Vi får kun tilgang til din offentlige profil og organisasjonsmedlemskap

# Profil og bilder
profile-picture-alt = {$user} profilbilde

# Lasting og tomme tilstander
loading-ellipsis = Laster...
no-recent-builds = Ingen nylige bygg funnet
failed-status = MISLYKTES
refreshing-ellipsis = Oppdaterer...
job-fallback = Jobb
time-now = nå
time-minutes-ago = {$count ->     
    [one] {$count} minutt siden
   *[other] {$count} minutter siden
}
time-hours-ago = {$count ->     
    [one] {$count} time siden
   *[other] {$count} timer siden
}
time-days-ago = {$count ->     
    [one] {$count} dag siden
   *[other] {$count} dager siden
}

# Feilmeldinger
build-not-found-in-pipeline = Bygg #{$number} ikke funnet i pipeline "{$pipeline}". Tilgjengelige bygg: {$builds}