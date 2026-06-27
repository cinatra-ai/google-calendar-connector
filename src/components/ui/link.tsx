import * as React from "react"

import { cn } from "../../lib/utils"

// shadcn link wrapper. This is the design-system primitive for inline text
// links — it renders the raw <a> here, inside the components/ui carve-out
// where the ui-design-system gate's raw-JSX block does not apply (the
// wrappers themselves render the raw elements). Consumers import <Link>
// instead of writing raw <a>, which the gate enforces at error severity.
function Link({ className, ...props }: React.ComponentProps<"a">) {
  return (
    <a
      data-slot="link"
      className={cn(
        "font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 rounded-xs",
        className
      )}
      {...props}
    />
  )
}

export { Link }
