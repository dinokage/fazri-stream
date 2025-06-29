import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import Link from "next/link"
import { PlayIcon } from "lucide-react"
import { Button } from "./ui/button"
import { getUserVideos } from "@/app/actions"


export function VideoCard({video}:{video:any}){
  return (
<Link key={video.id} href={`/dashboard/videos/${video.id}`}>
          <Card className="group cursor-pointer transition-all hover:shadow-md">
            <CardContent className="p-0">
              <div className="relative overflow-hidden rounded-t-lg">
                <img
                  src={"/placeholder.svg"}
                  alt={video.title}
                  className="aspect-video w-full object-cover transition-transform group-hover:scale-105"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90">
                    <PlayIcon className="h-5 w-5 text-black" />
                  </div>
                </div>
                <div className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-1 text-xs text-white">
                  {"0:0"}
                </div>
              </div>
            </CardContent>
            <CardHeader>
              <CardTitle className="line-clamp-2 text-base group-hover:text-primary">{video.title}</CardTitle>
              <CardDescription className="line-clamp-2 text-sm">{video.description}</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button>AI Generate Title</Button>
            </CardFooter>
          </Card>
        </Link>
  )
}


export async function SectionCards() {
  const videos = await getUserVideos()
  return (
    <div className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 lg:grid-cols-3 lg:px-6">
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} />
      ))}
    </div>
  )
}
