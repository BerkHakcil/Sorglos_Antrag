'use client'

import { Popover } from '@base-ui/react/popover'

interface ConsentInfoPopoverProps {
  info: string
  triggerLabel: string
}

// Inline info button that opens a popover on click/tap and keyboard activation.
// Placed next to consent checkbox labels that need extra explanation.
export function ConsentInfoPopover({ info, triggerLabel }: ConsentInfoPopoverProps) {
  return (
    <Popover.Root modal={false}>
      <Popover.Trigger
        aria-label={triggerLabel}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring ml-1 inline-flex h-[1.1rem] w-[1.1rem] shrink-0 translate-y-[-1px] cursor-pointer items-center justify-center rounded-full border text-[0.65rem] font-medium outline-none focus-visible:ring-2"
      >
        i
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="top" align="start" sideOffset={6}>
          <Popover.Popup className="bg-popover text-popover-foreground border-border z-50 max-w-[17rem] rounded-lg border p-3 text-sm leading-relaxed shadow-md">
            {info}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
