import { InfoIcon } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * The little "what is this?" marker beside a label.
 *
 * It is a real <button> rather than a bare icon so the explanation is reachable
 * by keyboard and by tap: Radix opens the tooltip on focus as well as hover,
 * which is the only way this works on a touchscreen, where hover does not
 * exist. type="button" keeps it from submitting the form it sits inside.
 */
export default function Hint({ children, label }) {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        aria-label={label}
        // The icon stays 16px, but a 16px tap target is well under the 24px
        // minimum and awkward to hit with a thumb. The ::after box widens the
        // pressable area to 32px without taking up any more room in the
        // layout, which a padded button would.
        className="text-muted-foreground/70 hover:text-foreground focus-visible:ring-ring relative inline-flex size-4 shrink-0 items-center justify-center rounded-full align-middle transition-colors after:absolute after:-inset-2 after:content-[''] focus-visible:ring-2 focus-visible:outline-none"
      >
        <InfoIcon className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent className="max-w-[15rem] text-pretty">{children}</TooltipContent>
    </Tooltip>
  )
}
