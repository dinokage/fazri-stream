import { getUserVideoById } from "@/app/actions"

// FIX: Change params type to Promise
export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  console.log(id)
  
  // Simplify the function call
  const video = await getUserVideoById(id)

  if (!video) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Video Not Found</h1>
          <p className="text-muted-foreground">The requested video could not be found.</p>
        </div>
      </div>
    )
  }
  
  console.log(video)
  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
        {/* <VideoPlayer video={video} /> */}
      </div>
    </div>
  )
}