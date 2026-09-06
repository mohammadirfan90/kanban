import * as React from "react"

import { cn } from "@/lib/utils"

/*
 * forwardRef is deliberate. These primitives came from shadcn's v4 registry,
 * which targets React 19 where `ref` is an ordinary prop on function
 * components. This project is on React 18 (Next 14), where a plain function
 * component silently drops any `ref` passed to it — no error, just a null ref.
 *
 * That is not cosmetic here: `<Card ref={setNodeRef}>` in TaskCard is how
 * dnd-kit learns the card's DOM node. Without it `activeNodeRect` stays null,
 * collision detection never runs, `over` is always null, and drag-and-drop
 * cannot complete a drop at all. Three `inputRef.current?.focus()` calls were
 * failing the same silent way.
 *
 * Remove these wrappers only when the app moves to React 19.
 */

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  function Input({ className, type, ...props }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        data-slot="input"
        className={cn(
        "h-10 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-2 text-base transition-colors outline-none file:inline-flex file:h-8 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/30 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
          className
        )}
        {...props}
      />
    )
  },
)

export { Input }
