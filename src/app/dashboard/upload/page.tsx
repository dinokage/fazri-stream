import { VideoUploadWithGenAI } from "@/components/video-upload-genai";

export default function UploadPage() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Upload Video</h1>
          <p className="text-muted-foreground">
            Upload your videos and let AI analyze them for titles, descriptions, and thumbnails.
          </p>
        </div>
        <VideoUploadWithGenAI />
      </div>
    </div>
  );
}