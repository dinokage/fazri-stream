import { getUserVideoById } from "@/app/actions"


export default async function VideoPage({ params }: { params: { id: string } }) {
  const {id} = await params
  console.log(id)
  const getUserVideoFunc = getUserVideoById.bind(null, id)

  const video = await getUserVideoFunc()

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
