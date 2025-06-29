import VideoUpload from '@/components/VideoUpload';
import { getServerSession } from 'next-auth';
import { OPTIONS } from "@/auth.config";
import { redirect } from 'next/navigation';

const VideoPage = async () => {
  const session = await getServerSession(OPTIONS);

  if (!session || !session.user) {
    redirect("/auth");
  }

  return (
    <main className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">
          Video Transcription with Deepgram
        </h1>
        <VideoUpload />
      </div>
    </main>
  );
}

export default VideoPage;