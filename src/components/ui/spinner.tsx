"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg
      data-slot="spinner"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("size-4 animate-spin", className)}
      {...props}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.18"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="3"
        d="M22 12a10 10 0 0 1-10 10"
      />
    </svg>
  )
}

export { Spinner }
