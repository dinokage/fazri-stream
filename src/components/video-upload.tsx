"use client"

import * as React from "react"
import { UploadIcon, VideoIcon, XIcon, CheckCircleIcon, AlertCircleIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { useRouter } from "next/navigation"

interface UploadedFile {
  file: File
  id: string
  progress: number
  status: "uploading" | "completed" | "error"
  preview?: string
}

export function VideoUpload() {
  const router = useRouter()
  const [dragActive, setDragActive] = React.useState(false)
  const [uploadedFiles, setUploadedFiles] = React.useState<UploadedFile[]>([])
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = Array.from(e.dataTransfer.files)
    const response = await fetch("/api/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileName: files[0].name,
        fileType: files[0].type,
        uploadType: "video",
      }),
    })

    const data = await response.json()
    const uploadUrl = data.uploadUrl
    const videoId = data.videoId

    const response2 = await fetch(uploadUrl, {
      method: "PUT",
      body: files[0],
      redirect:"follow"
    })

    if (response2.ok) {
      
      const transcriptionFormData = new FormData();
      transcriptionFormData.append("videoId", videoId);

      const captionFormDataWebVTT = new FormData();
      captionFormDataWebVTT.append("videoId", videoId)
      captionFormDataWebVTT.append("format", videoId)
    
      const captionFormSrt = new FormData();
      captionFormSrt.append("videoId", videoId)
      captionFormSrt.append("format", videoId)

      const [transcriptionResponse, webvttResponse, srtResponse] = await Promise.allSettled([
        fetch('/api/transcribe', {
          method: 'POST',
          credentials:"include",
          body: transcriptionFormData,
        }),
        fetch('/api/captions', {
          method: 'POST',
          credentials:"include",
          body: captionFormDataWebVTT,
        }),
        fetch('/api/captions', {
          method: 'POST',
          credentials:"include",
          body: captionFormSrt,
        })
      ]);

      if (transcriptionResponse.status === "fulfilled") {
        toast.success("Transcription completed!")
      }else{
        toast.error("Transcription failed!")
      }
      if (webvttResponse.status === "fulfilled" && srtResponse.status === "fulfilled" ) {
        toast.success("Captions completed!") 

      }else{
        toast.error("Captions failed!")
      }
      router.push(`/video/${videoId}`)
    }

    handleFiles(files)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    handleFiles(files)
  }

  const handleFiles = (files: File[]) => {
    const videoFiles = files.filter((file) => file.type.startsWith("video/"))

    if (videoFiles.length !== files.length) {
      toast.error("Only video files are allowed")
    }

    videoFiles.forEach((file) => {
      const id = Math.random().toString(36).substring(7)
      const newFile: UploadedFile = {
        file,
        id,
        progress: 0,
        status: "uploading",
      }

      // Create video preview
      const videoUrl = URL.createObjectURL(file)
      newFile.preview = videoUrl

      setUploadedFiles((prev) => [...prev, newFile])

      // Simulate upload progress
      simulateUpload(id)
    })
  }

  const simulateUpload = (fileId: string) => {
    const interval = setInterval(() => {
      setUploadedFiles((prev) =>
        prev.map((file) => {
          if (file.id === fileId) {
            const newProgress = Math.min(file.progress + Math.random() * 15, 100)
            const isCompleted = newProgress >= 100

            return {
              ...file,
              progress: newProgress,
              status: isCompleted ? "completed" : "uploading",
            }
          }
          return file
        }),
      )
    }, 200)

    // Clear interval when upload is complete
    setTimeout(
      () => {
        clearInterval(interval)
        setUploadedFiles((prev) =>
          prev.map((file) => (file.id === fileId ? { ...file, progress: 100, status: "completed" } : file)),
        )
        toast.success("Video uploaded successfully!")
      },
      3000 + Math.random() * 2000,
    )
  }

  const removeFile = (fileId: string) => {
    setUploadedFiles((prev) => {
      const fileToRemove = prev.find((f) => f.id === fileId)
      if (fileToRemove?.preview) {
        URL.revokeObjectURL(fileToRemove.preview)
      }
      return prev.filter((file) => file.id !== fileId)
    })
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <VideoIcon className="h-5 w-5" />
            Upload Videos
          </CardTitle>
          <CardDescription>
            Drag and drop your video files here, or click to browse. Only video files are supported.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`relative rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
              dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="video/*"
              onChange={handleFileInput}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-full bg-muted p-4">
                <UploadIcon className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-medium">Drop your video files here</p>
                <p className="text-sm text-muted-foreground">
                  or{" "}
                  <Button
                    variant="link"
                    className="h-auto p-0 text-primary"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    browse files
                  </Button>
                </p>
              </div>
              <div className="text-xs text-muted-foreground">Supported formats: MP4, AVI, MOV, WMV, FLV, MKV</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload Progress */}
      {uploadedFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Progress</CardTitle>
            <CardDescription>Track the progress of your video uploads</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {uploadedFiles.map((uploadedFile) => (
                <div key={uploadedFile.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {uploadedFile.preview && (
                        <div className="relative h-12 w-16 overflow-hidden rounded bg-muted">
                          <video src={uploadedFile.preview} className="h-full w-full object-cover" muted />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium">{uploadedFile.file.name}</p>
                        <p className="text-xs text-muted-foreground">{formatFileSize(uploadedFile.file.size)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {uploadedFile.status === "completed" && <CheckCircleIcon className="h-5 w-5 text-green-500" />}
                      {uploadedFile.status === "error" && <AlertCircleIcon className="h-5 w-5 text-red-500" />}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeFile(uploadedFile.id)}
                      >
                        <XIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        {uploadedFile.status === "uploading" && "Uploading..."}
                        {uploadedFile.status === "completed" && "Upload complete"}
                        {uploadedFile.status === "error" && "Upload failed"}
                      </span>
                      <span className="text-muted-foreground">{Math.round(uploadedFile.progress)}%</span>
                    </div>
                    <Progress value={uploadedFile.progress} className="h-2" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Video Details Form */}
      {uploadedFiles.some((file) => file.status === "completed") && (
        <Card>
          <CardHeader>
            <CardTitle>Video Details</CardTitle>
            <CardDescription>Add title and description for your uploaded videos</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="video-title">Title</Label>
                <Input id="video-title" placeholder="Enter video title..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="video-description">Description</Label>
                <Textarea id="video-description" placeholder="Enter video description..." className="min-h-[100px]" />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="flex-1">
                  Save Video Details
                </Button>
                <Button type="button" variant="outline">
                  Save as Draft
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
