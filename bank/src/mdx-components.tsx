import type { MDXComponents } from "mdx/types"
import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

/**
 * Element-level styling for rendered MDX. Passed to <MDXProvider /> so every
 * memory-bank document gets consistent, themed typography without needing a
 * Tailwind typography plugin.
 */
export const mdxComponents: MDXComponents = {
  h1: ({ className, ...props }: ComponentProps<"h1">) => (
    <h1
      className={cn(
        "mt-2 scroll-m-20 text-3xl font-bold tracking-tight",
        className
      )}
      {...props}
    />
  ),
  h2: ({ className, ...props }: ComponentProps<"h2">) => (
    <h2
      className={cn(
        "mt-10 scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight first:mt-0",
        className
      )}
      {...props}
    />
  ),
  h3: ({ className, ...props }: ComponentProps<"h3">) => (
    <h3
      className={cn("mt-8 scroll-m-20 text-xl font-semibold tracking-tight", className)}
      {...props}
    />
  ),
  p: ({ className, ...props }: ComponentProps<"p">) => (
    <p
      className={cn("leading-7 text-foreground/90 [&:not(:first-child)]:mt-6", className)}
      {...props}
    />
  ),
  a: ({ className, ...props }: ComponentProps<"a">) => (
    <a
      className={cn("font-medium text-primary underline underline-offset-4", className)}
      {...props}
    />
  ),
  ul: ({ className, ...props }: ComponentProps<"ul">) => (
    <ul className={cn("my-6 ml-6 list-disc [&>li]:mt-2", className)} {...props} />
  ),
  ol: ({ className, ...props }: ComponentProps<"ol">) => (
    <ol className={cn("my-6 ml-6 list-decimal [&>li]:mt-2", className)} {...props} />
  ),
  blockquote: ({ className, ...props }: ComponentProps<"blockquote">) => (
    <blockquote
      className={cn("mt-6 border-l-2 pl-6 text-muted-foreground italic", className)}
      {...props}
    />
  ),
  code: ({ className, ...props }: ComponentProps<"code">) => (
    <code
      className={cn(
        "relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm",
        className
      )}
      {...props}
    />
  ),
  pre: ({ className, ...props }: ComponentProps<"pre">) => (
    <pre
      className={cn(
        "mt-6 overflow-x-auto rounded-lg border bg-muted p-4 text-sm",
        className
      )}
      {...props}
    />
  ),
  hr: ({ className, ...props }: ComponentProps<"hr">) => (
    <hr className={cn("my-8 border-border", className)} {...props} />
  ),
  table: ({ className, ...props }: ComponentProps<"table">) => (
    <div className="my-6 w-full overflow-y-auto">
      <table className={cn("w-full text-sm", className)} {...props} />
    </div>
  ),
  th: ({ className, ...props }: ComponentProps<"th">) => (
    <th
      className={cn("border px-4 py-2 text-left font-semibold", className)}
      {...props}
    />
  ),
  td: ({ className, ...props }: ComponentProps<"td">) => (
    <td className={cn("border px-4 py-2", className)} {...props} />
  ),
}
