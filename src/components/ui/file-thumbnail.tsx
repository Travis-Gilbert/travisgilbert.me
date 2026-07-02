"use client"

import * as React from "react"
import { FileIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/spinner"

type ThumbnailFile = {
  name: string
  type?: string
}

type FileThumbnailProps = React.ComponentProps<"div"> & {
  file: ThumbnailFile
  previewAspectRatio?: number
  previewClassName?: string
  previewImageUrl?: string
  isLoading?: boolean
  previewContent?: React.ReactNode
}

function extensionFor(file: ThumbnailFile) {
  const byName = file.name.split(".").pop()
  if (byName && byName !== file.name) return byName.slice(0, 5).toUpperCase()
  const byType = file.type?.split("/").pop()
  return byType ? byType.slice(0, 5).toUpperCase() : "FILE"
}

function FileThumbnail({
  file,
  className,
  previewAspectRatio = 3 / 4,
  previewClassName,
  previewImageUrl,
  isLoading = false,
  previewContent,
  ...props
}: FileThumbnailProps) {
  const ratio = Number.isFinite(previewAspectRatio) ? previewAspectRatio : 3 / 4

  return (
    <div
      data-slot="file-thumbnail"
      className={cn("relative overflow-hidden rounded-xl", className)}
      style={{ aspectRatio: ratio }}
      {...props}
    >
      <div
        data-slot="file-thumbnail-preview"
        className={cn(
          "flex size-full items-center justify-center overflow-hidden rounded-[inherit] border border-border/70 bg-muted/40 text-muted-foreground",
          previewClassName
        )}
        style={
          previewImageUrl
            ? {
                backgroundImage: `url("${previewImageUrl}")`,
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
                backgroundSize: "cover",
              }
            : undefined
        }
      >
        {isLoading ? (
          <Spinner className="size-5" />
        ) : previewImageUrl ? null : (
          previewContent ?? (
            <div className="flex flex-col items-center gap-2 text-center">
              <FileIcon className="size-7" />
              <span className="max-w-20 truncate text-[0.65rem] font-medium">
                {extensionFor(file)}
              </span>
            </div>
          )
        )}
      </div>
    </div>
  )
}

export { FileThumbnail, type FileThumbnailProps }
