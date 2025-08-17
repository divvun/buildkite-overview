# Hovudgrensesnitt-strengar
app-title = Divvun Buildkite
nav-overview = Oversikt
nav-pipelines = Pipelines
nav-agents = Agentar
nav-queues = Køar
login = Logg inn
logout = Logg ut

# Language selection
select-language = Vel språk
language-english = Engelsk
language-norwegian-bokmal = Norsk bokmål
language-norwegian-nynorsk = Norsk nynorsk

# Vanlege UI-element
loading = Lastar...
error = Feil
refresh = Oppdater
refreshing = Oppdaterer...
refreshing-data = Oppdaterer data...
auto-refresh-on = Automatisk oppdatering PÅ (kvar {$interval}. sekund)
auto-refresh-off = Automatisk oppdatering AV
auto-refresh-background = Automatisk oppdatering PÅ (bakgrunnsmodus: kvar {$interval}. sekund)
enable-auto-refresh = Aktiver automatisk oppdatering
disable-auto-refresh = Deaktiver automatisk oppdatering

# Navigasjon og UI-etikettar
buildkite-logo = Buildkite-logo
dashboard-overview = Dashboard-oversikt
view-all-pipelines = Sjå alle pipelines
view-build-agents = Sjå alle build-agentar
view-build-queues = Sjå alle build-køar
sign-in-github = Logg inn med GitHub
toggle-navigation-menu = Slå av/på navigasjonsmeny
menu = Meny
breadcrumb-navigation = Brødsmulennavigasjon
go-to-homepage = Gå til heimeside
home = Heim
main-content = Hovudinnhald
secondary-navigation = Sekundær navigasjon

# Sidetitlar og skildringar
buildkite-overview = Buildkite-oversikt
access-denied = Tilgang nekta
pipelines-breadcrumb = Pipelines
agents-breadcrumb = Agentar
queues-breadcrumb = Køar

# Paginering
first-page = Første side
previous-page = Førre side
next-page = Neste side
last-page = Siste side

# Generelle tilstandar
no-repository = Ingen repository
no-commit-message = Ingen commit-melding
no-specific-requirements = Ingen spesifikke krav
unknown = Ukjent
never-built = Aldri bygd
not-started = Ikkje starta
not-finished = Ikkje ferdig

# Tid og status
started = Starta
finished = Ferdig

# Brukarhandlingar
try-different-account = Prøv ein annan konto
view-github-profile = Sjå GitHub-profil

# Build-relatert
build-not-found = Build ikkje funne
pipeline-not-found = Pipeline ikkje funne
insufficient-permissions = Utilstrekkelege løyve
access-denied-description = Tilgang nekta
invalid-build-number = Ugyldig build-nummer
failed-load-build-details = Kunne ikkje laste build-detaljar

# Job-loggar
show-timestamps = Vis
hide-timestamps = Gøym
timestamps = Tidsstempler

# Køadministrasjon
default-queue = Standard
unassigned = Ikkje tildelt
unassigned-agents = Ikkje-tildelte agentar
queue-prefix = Kø

# Statusmerke
status-running = Køyrer
status-passed = Bestått
status-failed = Feila
status-pending = Ventar
status-canceled = Avbrote
status-skipped = Hoppa over
status-blocked = Blokkert

# Tidsformatering
time-ago = {$time} sidan
duration = {$duration}
seconds = {$count ->
    [one] {$count} sekund
   *[other] {$count} sekund
}
minutes = {$count ->
    [one] {$count} minutt
   *[other] {$count} minutt
}
hours = {$count ->
    [one] {$count} time
   *[other] {$count} timar
}
days = {$count ->
    [one] {$count} dag
   *[other] {$count} dagar
}

# Feilmeldingar for API og nettverksproblem
failed-fetch-pipelines = Kunne ikkje hente pipelines
failed-fetch-builds = Kunne ikkje hente builds
failed-fetch-jobs = Kunne ikkje hente build-jobbar
failed-fetch-agents = Kunne ikkje hente agentdata
failed-fetch-queues = Kunne ikkje hente kødata
failed-cache-status = Kunne ikkje hente cache-status
failed-cache-action = Kunne ikkje utføre cache-handling
failed-job-logs = Kunne ikkje hente job-loggar frå Buildkite API
buildkite-api-key-not-configured = Buildkite API-nøkkel ikkje konfigurert
access-denied-logs = Tilgang nekta til job-loggar. Dette kan koma av utilstrekkelege API-løyve eller at loggane er sletta.
unknown-error = Ukjent feil
invalid-locale-data = Ugyldig språkdata-format
missing-build-slug = Manglar build-nummer eller pipeline-slug

# Footer
resources = Ressursar
divvun-buildkite-overview = Divvun Buildkite Oversikt
buildkite-dashboard = Buildkite Dashboard
github-divvun = GitHub - divvun
github-giellalt = GitHub - giellalt

# Visibility
visibility-unknown = Ukjent

# Build details
no-builds-yet = Ingen bygg enno
started-label = Starta

# Tilgjengelegheitsetikettar
view-all-pipelines-aria = Vis alle {$count} pipelines
view-agents-wait-time-aria = Vis agentar, gjennomsnittleg ventetid: {$waitTime}
view-queues-pending-aria = Vis køar, {$count} ventande bygg
view-failing-pipeline-aria = Vis detaljar for feilande pipeline: {$name}
build-status-title = Bygg #{$number}: {$status}
feature-coming-soon = Funksjon kjem snart - utløys nye bygg frå grensesnittet
user-menu-aria = Brukarmeny for {$user}
go-to-breadcrumb-aria = Gå til {$label}
pipeline-page-title = {$name} - Pipeline
build-page-title = Bygg #{$number} - {$pipeline}
build-not-found-title = Bygg ikkje funne
invalid-build-number = Ugyldig byggnummer

# Tilkoplingstilstandar
connection-connected = tilkopla
connection-disconnected = fråkopla
connection-lost = tapt

# Dashboard-strengar
failing-since = feilar sidan {$time}
average-wait-time = Gjennomsnittleg ventetid
builds-passed-failed = {$passed} bestått, {$failed} mislukkast

# Jobb-fleirtal
job-count = {$count ->
    [one] {$count} jobb
   *[other] {$count} jobbar
}

# Bygg/Jobb-etikettar
duration-label = Varigheit
started-label-colon = Starta
build-number = Bygg #{$number}
job-number = Jobb #{$id}

# Autentiseringsside
try-different-account = Prøv anna konto
sign-in-github = Logg inn med GitHub

# Uautorisert tilgang
access-denied = Tilgang nekta
unauthorized-description = Du må vere medlem av divvun-organisasjonen for å få tilgang til denne sida.
what-you-can-do = Kva du kan gjere:
contact-admin = Kontakt administratoren din for å be om tilgang til divvun-organisasjonen
verify-account = Sjekk at du er logga inn med rett GitHub-konto
accept-invitation = Sørg for at du har akseptert organisasjonsinvitasjonen viss ei vart sendt
return-to-dashboard = Tilbake til dashbord
sign-out = Logg ut

# Standard app-tittel
default-app-title = Buildkite-oversikt

# Innloggingsside
login-page-title = Logg inn - Buildkite-oversikt
divvun-buildkite = Divvun Buildkite
login-description = Logg inn med GitHub-kontoen din for å få tilgang til byggoversiktsdashbordet
auth-failed = Autentisering feila. Ver greitt og prøv igjen.
invalid-auth-response = Ugyldig autentiseringsrespons.
security-validation-failed = Tryggleiksvalidering feila. Ver greitt og prøv igjen.
insufficient-access-error = Du har ikkje tilgang til dei nødvendige GitHub-organisasjonane (divvun eller giellalt). Du må kanskje autentisere på nytt for å oppdatere organisasjonstillatelsane dine.
auth-error-occurred = Autentiseringsfeil oppstod. Ver greitt og prøv igjen.
choose-different-account-desc = Vel ei anna konto eller gi ny autorisasjon for å oppdatere organisasjonstillatingar
review-app-permissions = gå gjennom app-tillatingar på GitHub
requires-membership = Krev medlemskap i {$org1} eller {$org2} organisasjonar
access-description = Vi får berre tilgang til den offentlege profilen din og organisasjonsmedlemskap

# Profil og bilete
profile-picture-alt = {$user} profilbilete

# Lasting og tomme tilstandar
loading-ellipsis = Lastar...
no-recent-builds = Ingen nye bygg funne
failed-status = MISLUKKAST
refreshing-ellipsis = Oppdaterer...
job-fallback = Jobb
time-now = nå
time-minutes-ago = {$count ->     
    [one] {$count} minutt sidan
   *[other] {$count} minutt sidan
}
time-hours-ago = {$count ->     
    [one] {$count} time sidan
   *[other] {$count} timar sidan
}
time-days-ago = {$count ->     
    [one] {$count} dag sidan
   *[other] {$count} dagar sidan
}

# Feilmeldingar
build-not-found-in-pipeline = Bygg #{$number} ikkje funne i pipeline "{$pipeline}". Tilgjengelege bygg: {$builds}