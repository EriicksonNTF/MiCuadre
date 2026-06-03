import * as React from 'react'

import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/35 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 flex field-sizing-content min-h-24 w-full rounded-2xl border bg-card/75 px-4 py-3 text-base shadow-sm outline-none transition-[background-color,border-color,box-shadow,color] duration-200 ease-[var(--ease-out-ios)] focus-visible:bg-card focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/40 md:text-sm',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
