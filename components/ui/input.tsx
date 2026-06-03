import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground border-input h-12 w-full min-w-0 rounded-2xl border bg-card/75 px-4 py-2 text-base shadow-sm outline-none transition-[background-color,border-color,box-shadow,color,transform] duration-200 ease-[var(--ease-out-ios)] file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/40 md:text-sm',
        'focus-visible:border-ring focus-visible:bg-card focus-visible:ring-ring/35 focus-visible:ring-[3px]',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
