'use client'

import { Popover } from '@base-ui/react/popover'

interface ConsentInfoPopoverProps {
  info: string
  triggerLabel: string
}

// Inline info button that opens a popover on click/tap and keyboard activation.
// Placed next to consent checkbox labels that need extra explanation.
//
// E-7: the trigger's HIT AREA is 44x44 (the touch-target floor — it measured
// 18x18 in the audit) while the VISIBLE circle stays small: the outer button
// carries the size, and negative vertical margins keep the line layout where
// it was. The focus ring sits on the inner circle via group-focus-visible,
// where the eye is looking, rather than around an invisible 44px box.
export function ConsentInfoPopover({ info, triggerLabel }: ConsentInfoPopoverProps) {
  return (
    <Popover.Root modal={false}>
      <Popover.Trigger
        aria-label={triggerLabel}
        className="group -my-3 inline-flex size-11 shrink-0 cursor-pointer items-center justify-center outline-none"
      >
        <span
          aria-hidden
          className="text-graphite-soft group-hover:text-foreground group-focus-visible:ring-petrol group-focus-visible:ring-offset-background inline-flex h-[1.1rem] w-[1.1rem] items-center justify-center rounded-full border text-[0.65rem] font-medium group-focus-visible:ring-2 group-focus-visible:ring-offset-2"
        >
          i
        </span>
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
