// deno-lint-ignore-file no-explicit-any
/// <reference types="preact" />
// WebAwesome component types for Preact/JSX
import 'webawesome/dist/components/avatar/avatar.js'
import 'webawesome/dist/components/badge/badge.js'
import 'webawesome/dist/components/breadcrumb-item/breadcrumb-item.js'
import 'webawesome/dist/components/breadcrumb/breadcrumb.js'
import 'webawesome/dist/components/button-group/button-group.js'
import 'webawesome/dist/components/button/button.js'
import 'webawesome/dist/components/callout/callout.js'
import 'webawesome/dist/components/card/card.js'
import 'webawesome/dist/components/carousel-item/carousel-item.js'
import 'webawesome/dist/components/carousel/carousel.js'
import 'webawesome/dist/components/checkbox/checkbox.js'
import 'webawesome/dist/components/copy-button/copy-button.js'
import 'webawesome/dist/components/details/details.js'
import 'webawesome/dist/components/dialog/dialog.js'
import 'webawesome/dist/components/divider/divider.js'
import 'webawesome/dist/components/drawer/drawer.js'
import 'webawesome/dist/components/dropdown-item/dropdown-item.js'
import 'webawesome/dist/components/dropdown/dropdown.js'
import 'webawesome/dist/components/icon/icon.js'
import 'webawesome/dist/components/input/input.js'
import 'webawesome/dist/components/option/option.js'
import 'webawesome/dist/components/page/page.js'
import 'webawesome/dist/components/popover/popover.js'
import 'webawesome/dist/components/progress-bar/progress-bar.js'
import 'webawesome/dist/components/progress-ring/progress-ring.js'
import 'webawesome/dist/components/radio-group/radio-group.js'
import 'webawesome/dist/components/radio/radio.js'
import 'webawesome/dist/components/select/select.js'
import 'webawesome/dist/components/skeleton/skeleton.js'
import 'webawesome/dist/components/slider/slider.js'
import 'webawesome/dist/components/spinner/spinner.js'
import 'webawesome/dist/components/switch/switch.js'
import 'webawesome/dist/components/tab-group/tab-group.js'
import 'webawesome/dist/components/tab-panel/tab-panel.js'
import 'webawesome/dist/components/tab/tab.js'
import 'webawesome/dist/components/tag/tag.js'
import 'webawesome/dist/components/textarea/textarea.js'
import 'webawesome/dist/components/tooltip/tooltip.js'
import 'webawesome/dist/components/tree-item/tree-item.js'
import 'webawesome/dist/components/tree/tree.js'

type Props<T> = {
  [P in keyof T]?: (
    & Partial<T[P]>
    & preact.PreactDOMAttributes
    & preact.JSX.DOMAttributes<any>
    & preact.JSX.HTMLAttributes<any>
  )
}

declare global {
  export interface HTMLElement {
    children?: preact.ComponentChildren
  }

  namespace preact.JSX {
    interface IntrinsicElements extends Props<HTMLElementTagNameMap> {}
  }
}

export { }

