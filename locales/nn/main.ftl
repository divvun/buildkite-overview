# Hovudgrensesnitt-strengar
app-title = Divvun Buildkite
nav-overview = Oversikt
nav-pipelines = Kommandokøar
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
auto-refresh-on = Automatisk oppdatering PÅ (kvart {$interval}. sekund)
auto-refresh-off = Automatisk oppdatering AV
auto-refresh-background = Automatisk oppdatering PÅ (bakgrunnsmodus: kvart {$interval}. sekund)
enable-auto-refresh = Aktiver automatisk oppdatering
disable-auto-refresh = Deaktiver automatisk oppdatering

# Navigasjon og UI-etikettar
buildkite-logo = Buildkite-logo
dashboard-overview = Dashboard-oversikt
view-all-pipelines = Sjå alle kommandokøar
view-build-agents = Sjå alle byggjeagentar
view-build-queues = Sjå alle byggjekøar
sign-in-github = Logg inn med GitHub
toggle-navigation-menu = Slå av/på navigasjonsmeny
menu = Meny
breadcrumb-navigation = Brødsmulenavigasjon
go-to-homepage = Gå til heimesida
home = Heim
main-content = Hovudinnhald
secondary-navigation = Sekundær navigasjon

# Sidetitlar og skildringar
buildkite-overview = Buildkite-oversikt
access-denied = Tilgang nekta
pipelines-breadcrumb = Kommandokøar
agents-breadcrumb = Agentar
queues-breadcrumb = Køar

# Paginering
first-page = Fyrste side
previous-page = Førre side
next-page = Neste side
last-page = Siste side

# Generelle tilstandar
no-repository = Inkje repositorium
no-commit-message = Inga innsjekkingsmelding
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
build-not-found = Bygg ikkje funne
pipeline-not-found = Kommandokø ikkje funne
insufficient-permissions = Utilstrekkelege løyve
access-denied-description = Tilgang nekta
invalid-build-number = Ugyldig byggjenummer
failed-load-build-details = Kunne ikkje lasta byggjedetaljar

# Job-loggar
show-timestamps = Vis
hide-timestamps = Gøym
timestamps = Tidsstempel

# Køadministrasjon
default-queue = Standard
unassigned = Ikkje tildelt
unassigned-agents = Ikkje-tildelte agentar
queue-prefix = Kø

# Statusmerke
status-running = Køyrer
status-passed = Fullført
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
failed-fetch-pipelines = Kunne ikkje henta kommandokøar
failed-fetch-builds = Kunne ikkje henta bygg
failed-fetch-jobs = Kunne ikkje henta byggjejobbar
failed-fetch-agents = Kunne ikkje henta agentdata
failed-fetch-queues = Kunne ikkje henta kødata
failed-cache-status = Kunne ikkje henta cache-status
failed-cache-action = Kunne ikkje utføra cache-handling
failed-job-logs = Kunne ikkje henta jobbloggar frå Buildkite API
buildkite-api-key-not-configured = Buildkite-API-nøkkel ikkje konfigurert
access-denied-logs = Tilgang nekta til jobbloggar. Dette kan koma av utilstrekkelege API-løyve eller at loggane er sletta.
unknown-error = Ukjend feil
invalid-locale-data = Ugyldig språkdata-format
missing-build-slug = Manglar byggjenummer eller kommandokø-slugg

# Footer
resources = Ressursar
divvun-buildkite-overview = Divvun Buildkite-oversikt
buildkite-dashboard = Buildkite Dashboard
github-divvun = GitHub - divvun
github-giellalt = GitHub - giellalt

# Visibility
visibility-unknown = Ukjent

# Build details
no-builds-yet = Ingen bygg enno
started-label = Starta

# Tilgjengelegheitsetikettar
view-all-pipelines-aria = Vis alle {$count} kommandokøar
view-agents-wait-time-aria = Vis agentar, gjennomsnittleg ventetid: {$waitTime}
view-queues-pending-aria = Vis køar, {$count} ventande bygg
view-failing-pipeline-aria = Vis detaljar for feilande kommandokø: {$name}
build-status-title = Bygg #{$number}: {$status}
feature-coming-soon = Funksjon kjem snart - set i gang nye bygg frå grensesnittet
user-menu-aria = Brukarmeny for {$user}
go-to-breadcrumb-aria = Gå til {$label}
pipeline-page-title = {$name} - kommandokø
build-page-title = Bygg #{$number} - {$pipeline}
build-not-found-title = Bygg ikkje funne
invalid-build-number = Ugyldig byggjenummer

# Tilkoplingstilstandar
connection-connected = tilkopla
connection-disconnected = fråkopla
connection-lost = tapt

# Dashboard-strengar
failing-since = har feila sidan {$time}
average-wait-time = Gjennomsnittleg ventetid
builds-passed-failed = {$passed} fullførde, {$failed} mislukkast

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
try-different-account = Prøv annan konto
sign-in-github = Logg inn med GitHub

# Uautorisert tilgang
access-denied = Tilgang nekta
unauthorized-description = Du må vera medlem av divvun-organisasjonen for å få tilgang til denne sida.
what-you-can-do = Kva du kan gjera:
contact-admin = Kontakt administratoren din for å be om tilgang til divvun-organisasjonen
verify-account = Sjekk at du er logga inn med rett GitHub-konto
accept-invitation = Sørg for at du har akseptert organisasjonsinvitasjonen om ein er sendt
return-to-dashboard = Attende til oversikta
sign-out = Logg ut

# Standard app-tittel
default-app-title = Buildkite-oversikt

# Innloggingsside
login-page-title = Logg inn - Buildkite-oversikt
divvun-buildkite = Divvun Buildkite
login-description = Logg inn med GitHub-kontoen din for å få tilgang til byggjeoversikta
auth-failed = Autentisering feila. Ver grei og prøv igjen.
invalid-auth-response = Ugyldig autentiseringsrespons.
security-validation-failed = Tryggleiksvalidering feila. Ver grei og prøv igjen.
insufficient-access-error = Du har ikkje tilgang til dei naudsynte GitHub-organisasjonane (divvun eller giellalt). Du må kanskje autentisera på nytt for å oppdatera organisasjonsløyva dine.
auth-error-occurred = Autentiseringsfeil oppstod. Ver grei og prøv igjen.
choose-different-account-desc = Vel ein annan konto eller gje ny autorisasjon for å oppdatera organisasjonsløyve
review-app-permissions = gå gjennom app-tillatingar på GitHub
requires-membership = Krev medlemskap i {$org1}- eller {$org2}-organisasjonane
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
    [one] {$count} minutt
   *[other] {$count} minutt
}
time-hours-ago = {$count ->     
    [one] {$count} time
   *[other] {$count} timar
}
time-days-ago = {$count ->     
    [one] {$count} dag
   *[other] {$count} dagar
}

# Feilmeldingar
build-not-found-in-pipeline = Bygg #{$number} ikkje funne i kommandokø "{$pipeline}". Tilgjengelege bygg: {$builds}