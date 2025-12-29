"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Upload, ImagePlus, Loader2, X, AlertTriangle, CheckCircle, RefreshCw, Pause, Play, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { ChunkedUploadManager, type ChunkedFile } from "@/lib/chunked-upload-service"

export function ChunkedUploadForm() {
  const [files, setFiles] = useState<ChunkedFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadManagerRef = useRef<ChunkedUploadManager | null>({} as any)
  const { toast } = useToast()

  // Initialize upload manager
  useEffect(() => {
    uploadManagerRef.current = new ChunkedUploadManager({
      chunkSize: 2 * 1024 * 1024, // 2MB chunks
      maxRetries: 3,
      retryDelay: 2000,
      maxConcurrentChunks: 3,
      onProgress: (fileId, progress) => {
        setFiles((prevFiles) => prevFiles.map((file) => (file.id === fileId ? { ...file, progress } : file)))
      },
      onFileStatusChange: (fileId, status, queuePosition) => {
        // Use a callback form of setFiles to ensure we're working with the latest state
        setFiles((prevFiles) => {
          const updatedFiles = prevFiles.map((file) => {
            if (file.id === fileId) {
              return {
                ...file,
                status,
                queuePosition: queuePosition !== undefined ? queuePosition : file.queuePosition,
              }
            }
            return file
          })

          // Check if any file is uploading and update the uploading state
          const anyUploading = updatedFiles.some((f) => f.status === "uploading")

          // Use setTimeout to avoid state update conflicts
          setTimeout(() => {
            setIsUploading(anyUploading)
          }, 0)

          return updatedFiles
        })
      },
      onChunkStatusChange: (fileId, chunkIndex, status) => {
        setFiles((prevFiles) =>
          prevFiles.map((file) => {
            if (file.id === fileId) {
              const chunks = [...file.chunks]
              chunks[chunkIndex] = { ...chunks[chunkIndex], status }
              const uploadedChunks = chunks.filter((c) => c.status === "completed").length
              return { ...file, chunks, uploadedChunks }
            }
            return file
          }),
        )
      },
      onFileComplete: (fileId, result) => {
        const fileName = files.find((f) => f.id === fileId)?.name || "file"
        toast({
          title: "Upload complete",
          description: `${fileName} has been uploaded successfully.`,
        })
      },
      onError: (fileId, error) => {
        const fileName = files.find((f) => f.id === fileId)?.name || "file"
        toast({
          title: "Upload failed",
          description: `Failed to upload ${fileName}: ${error.message}`,
          variant: "destructive",
        })
      },
      onAllComplete: (results) => {
        setIsUploading(false)
        setIsPaused(false)

        if (results.success > 0) {
          toast({
            title: `${results.success} photo${results.success !== 1 ? "s" : ""} uploaded successfully`,
            description:
              results.failed > 0
                ? `${results.failed} upload${results.failed !== 1 ? "s" : ""} failed. You can retry failed uploads.`
                : "All uploads completed successfully!",
          })
        }
      },
      onQueueUpdate: (queuedFiles) => {
        // Update UI with queue information
        console.log("Queue updated:", queuedFiles)
      },
    })

    return () => {
      // Clean up previews and chunks when component unmounts
      files.forEach((file) => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview)
        }
      })

      // Cancel all uploads and clean up chunks
      if (uploadManagerRef.current) {
        uploadManagerRef.current.cancelAllWithCleanup()
      }
    }
  }, [toast])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return

    const selectedFiles = Array.from(e.target.files)

    if (uploadManagerRef.current) {
      const chunkedFiles = uploadManagerRef.current.addFiles(selectedFiles)
      setFiles((prev) => [...prev, ...chunkedFiles])
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleUpload = () => {
    if (!files.length || isUploading) return

    // Set uploading state first
    setIsUploading(true)
    setIsPaused(false)

    // Use setTimeout to ensure state updates have completed
    setTimeout(() => {
      if (uploadManagerRef.current) {
        // Log the current files before starting upload
        console.log(
          "Starting upload with files:",
          files.map((f) => ({
            id: f.id,
            name: f.name,
            status: f.status,
          })),
        )

        uploadManagerRef.current.startUpload()
      }
    }, 10)
  }

  const handlePauseResume = () => {
    if (!isUploading) return

    if (isPaused) {
      setIsPaused(false)
      if (uploadManagerRef.current) {
        uploadManagerRef.current.resumeAll()
      }
    } else {
      setIsPaused(true)
      if (uploadManagerRef.current) {
        uploadManagerRef.current.pauseAll()
      }
    }
  }

  const handleRetry = () => {
    if (uploadManagerRef.current) {
      uploadManagerRef.current.retryFailed()
      setIsUploading(true)
      setIsPaused(false)
    }
  }

  const handleClearCompleted = () => {
    // Remove completed files from local state
    setFiles((prevFiles) => {
      const completedFiles = prevFiles.filter((f) => f.status === "completed")
      completedFiles.forEach((file) => {
        URL.revokeObjectURL(file.preview)
      })
      return prevFiles.filter((f) => f.status !== "completed")
    })

    // Clear from upload manager
    if (uploadManagerRef.current) {
      uploadManagerRef.current.clearCompleted()
    }
  }

  const removeFile = async (fileId: string) => {
    // Remove from local state first
    setFiles((prevFiles) => {
      const fileToRemove = prevFiles.find((f) => f.id === fileId)
      if (fileToRemove) {
        URL.revokeObjectURL(fileToRemove.preview)
      }
      return prevFiles.filter((f) => f.id !== fileId)
    })

    // Then remove from upload manager with cleanup
    if (uploadManagerRef.current) {
      await uploadManagerRef.current.removeFileWithCleanup(fileId)
    }
  }

  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    if (e.dataTransfer.files?.length) {
      const droppedFiles = Array.from(e.dataTransfer.files).filter((file) => file.type.startsWith("image/"))

      if (droppedFiles.length === 0) return

      if (uploadManagerRef.current) {
        const chunkedFiles = uploadManagerRef.current.addFiles(droppedFiles)
        setFiles((prev) => [...prev, ...chunkedFiles])
      }
    }
  }

  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }

  // Count files by status
  const pendingCount = files.filter((f) => f.status === "pending").length
  const queuedCount = files.filter((f) => f.status === "queued").length
  const uploadingCount = files.filter((f) => f.status === "uploading").length
  const pausedCount = files.filter((f) => f.status === "paused").length
  const completedCount = files.filter((f) => f.status === "completed").length
  const errorCount = files.filter((f) => f.status === "error").length

  return (
    <div className="space-y-6">
      <div
        onClick={triggerFileInput}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/20 hover:border-primary/40 hover:bg-accent/50",
        )}
      >
        <div className="rounded-full bg-accent p-3 mb-4">
          <ImagePlus className="h-6 w-6 text-primary" />
        </div>
        <p className="text-center font-medium mb-1">Tap to select photos</p>
        <p className="text-sm text-muted-foreground text-center">or drag and drop images here</p>
        <p className="text-xs text-muted-foreground text-center mt-2">Supports large images up to 100MB</p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {files.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {files.map((file) => (
              <div key={file.id} className="relative aspect-square group animate-fade-in">
                <div className="absolute inset-0 rounded-lg overflow-hidden">
                  <Image
                    src={file.preview || "/placeholder.svg"}
                    alt={`Preview ${file.name}`}
                    fill
                    className="object-cover transition-transform group-hover:scale-105"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 flex justify-between">
                    <span>{formatFileSize(file.size)}</span>
                    {file.status === "queued" && file.queuePosition !== undefined && (
                      <span className="flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        Queue: #{file.queuePosition + 1}
                      </span>
                    )}
                  </div>
                </div>

                {/* Status overlay */}
                {file.status !== "pending" && (
                  <div
                    className={cn(
                      "absolute inset-0 flex items-center justify-center",
                      file.status === "uploading"
                        ? "bg-black/30"
                        : file.status === "queued"
                          ? "bg-blue-500/10"
                          : file.status === "paused"
                            ? "bg-yellow-500/20"
                            : file.status === "completed"
                              ? "bg-green-500/20"
                              : "bg-red-500/20",
                    )}
                  >
                    {file.status === "uploading" && (
                      <div className="bg-black/60 text-white text-xs font-medium rounded-full px-2 py-1">
                        {file.progress}%
                      </div>
                    )}
                    {file.status === "queued" && (
                      <div className="bg-blue-500/60 text-white text-xs font-medium rounded-full px-2 py-1 flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        In queue
                      </div>
                    )}
                    {file.status === "paused" && (
                      <div className="bg-yellow-500/60 text-white text-xs font-medium rounded-full px-2 py-1">
                        Paused
                      </div>
                    )}
                    {file.status === "completed" && (
                      <CheckCircle className="h-8 w-8 text-white bg-green-500 rounded-full p-1" />
                    )}
                    {file.status === "error" && (
                      <AlertTriangle className="h-8 w-8 text-white bg-red-500 rounded-full p-1" />
                    )}
                  </div>
                )}

                {/* Progress bar */}
                {(file.status === "uploading" || file.status === "paused") && (
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
                    <div
                      className={cn(
                        "h-full transition-all duration-300 ease-in-out",
                        file.status === "uploading" ? "bg-primary" : "bg-yellow-500",
                      )}
                      style={{ width: `${file.progress}%` }}
                    />
                  </div>
                )}

                {/* Remove button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    removeFile(file.id)
                  }}
                  className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-7 h-7 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Remove image"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Status summary */}
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs">
              {pendingCount > 0 && (
                <span className="bg-gray-100 text-gray-800 rounded-full px-2 py-1">{pendingCount} pending</span>
              )}
              {queuedCount > 0 && (
                <span className="bg-blue-100 text-blue-800 rounded-full px-2 py-1 flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  {queuedCount} in queue
                </span>
              )}
              {uploadingCount > 0 && (
                <span className="bg-blue-100 text-blue-800 rounded-full px-2 py-1 flex items-center">
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  {uploadingCount} uploading
                </span>
              )}
              {pausedCount > 0 && (
                <span className="bg-yellow-100 text-yellow-800 rounded-full px-2 py-1 flex items-center">
                  <Pause className="h-3 w-3 mr-1" />
                  {pausedCount} paused
                </span>
              )}
              {completedCount > 0 && (
                <span className="bg-green-100 text-green-800 rounded-full px-2 py-1 flex items-center">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  {completedCount} complete
                </span>
              )}
              {errorCount > 0 && (
                <span className="bg-red-100 text-red-800 rounded-full px-2 py-1 flex items-center">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {errorCount} failed
                </span>
              )}

              {completedCount > 0 && (
                <button
                  onClick={handleClearCompleted}
                  className="ml-auto bg-gray-100 text-gray-800 rounded-full px-2 py-1 hover:bg-gray-200"
                >
                  Clear completed
                </button>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleUpload}
              disabled={
                !files.length ||
                isUploading ||
                files.every((f) => f.status === "completed" || f.status === "uploading" || f.status === "queued")
              }
              className="flex-1 rounded-full h-11 transition-all"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload {pendingCount ? `${pendingCount} photo${pendingCount > 1 ? "s" : ""}` : "photos"}
                </>
              )}
            </Button>

            {isUploading && (
              <Button
                variant="outline"
                onClick={handlePauseResume}
                className="rounded-full h-11 w-11 p-0 flex items-center justify-center"
              >
                {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </Button>
            )}

            {errorCount > 0 && (
              <Button
                variant="outline"
                onClick={handleRetry}
                disabled={isUploading && !isPaused}
                className="rounded-full h-11"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry Failed
              </Button>
            )}
          </div>

          {/* Upload queue information */}
          {queuedCount > 0 && (
            <div className="text-sm text-muted-foreground bg-accent/50 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>
                  {uploadingCount > 0
                    ? "Uploading 1 photo at a time to ensure reliability"
                    : "Ready to start uploading"}
                </span>
              </div>
              <div className="mt-1 text-xs">
                {queuedCount} photo{queuedCount !== 1 ? "s" : ""} waiting in queue
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
