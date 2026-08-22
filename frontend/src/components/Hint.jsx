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
        className="text-muted-foreground/70 hover:text-foreground focus-visible:ring-ring inline-flex size-4 shrink-0 items-center justify-center rounded-full align-middle transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        <InfoIcon className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent className="max-w-[15rem] text-pretty">{children}</TooltipContent>
    </Tooltip>
  )
}
