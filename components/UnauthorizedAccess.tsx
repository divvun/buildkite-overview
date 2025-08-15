/// <reference path="../types/webawesome.d.ts" />
import type { ComponentChildren } from "preact"

export interface UnauthorizedAccessProps {
  title?: string
  description?: string
  children?: ComponentChildren
}

export default function UnauthorizedAccess({
  title = "Access Denied",
  description = "You need to be a member of the divvun organization to access this page.",
  children,
}: UnauthorizedAccessProps) {
  return (
    <wa-card style="max-width: 600px; margin: var(--wa-space-l) auto;">
      <div class="wa-stack wa-gap-m" style="padding: var(--wa-space-l)">
        <div class="wa-stack wa-gap-s wa-align-items-center">
          <wa-icon
            name="shield-exclamation"
            style="font-size: 3rem; color: var(--wa-color-warning-fill-loud)"
          />
          <h2 class="wa-heading-l">{title}</h2>
          <p class="wa-body-m wa-color-text-quiet" style="text-align: center">
            {description}
          </p>
        </div>

        <wa-divider />

        <div class="wa-stack wa-gap-s">
          <h3 class="wa-heading-s">What you can do:</h3>
          <ul class="wa-stack wa-gap-xs" style="padding-left: var(--wa-space-m)">
            <li class="wa-body-s">Contact your administrator to request access to the divvun organization</li>
            <li class="wa-body-s">Verify you're signed in with the correct GitHub account</li>
            <li class="wa-body-s">Make sure you've accepted the organization invitation if one was sent</li>
          </ul>
        </div>

        {children && (
          <div style="margin-top: var(--wa-space-s)">
            {children}
          </div>
        )}

        <div class="wa-cluster wa-gap-s">
          <wa-button>
            <wa-icon slot="prefix" name="arrow-left" />
            <a href="/" style="text-decoration: none; color: inherit">
              Return to Dashboard
            </a>
          </wa-button>
          <wa-button variant="brand" appearance="outlined">
            <wa-icon slot="prefix" name="arrow-right-from-bracket" />
            <a href="/auth/logout" style="text-decoration: none; color: inherit">
              Sign Out
            </a>
          </wa-button>
        </div>
      </div>
    </wa-card>
  )
}
