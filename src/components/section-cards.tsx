import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import Link from "next/link"
import { PlayIcon } from "lucide-react"
import { Button } from "./ui/button"


export function VideoCard({video}:{video:{id:string | number, title:string, description:string, thumbnail:string, duration:string}}){
  return (
<Link key={video.id} href={`/dashboard/videos/${video.id}`}>
          <Card className="group cursor-pointer transition-all hover:shadow-md">
            <CardContent className="p-0">
              <div className="relative overflow-hidden rounded-t-lg">
                <img
                  src={video.thumbnail || "/placeholder.svg"}
                  alt={video.title}
                  className="aspect-video w-full object-cover transition-transform group-hover:scale-105"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90">
                    <PlayIcon className="h-5 w-5 text-black" />
                  </div>
                </div>
                <div className="absolute bottom-2 right-2 rounded bg-black/70 px-2 py-1 text-xs text-white">
                  {video.duration}
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

const videos = [
  {
    id: 1,
    title: "Project Overview Presentation",
    description: "Comprehensive overview of the current project status and milestones",
    thumbnail: "/placeholder.svg?height=200&width=300",
    duration: "12:34",
  },
  {
    id: 2,
    title: "Technical Architecture Review",
    description: "Deep dive into the system architecture and technical decisions",
    thumbnail: "/placeholder.svg?height=200&width=300",
    duration: "18:45",
  },
  {
    id: 3,
    title: "User Experience Demo",
    description: "Walkthrough of the user interface and experience improvements",
    thumbnail: "/placeholder.svg?height=200&width=300",
    duration: "8:22",
  },
  {
    id: 4,
    title: "Security Implementation",
    description: "Overview of security measures and compliance requirements",
    thumbnail: "/placeholder.svg?height=200&width=300",
    duration: "15:17",
  },
  {
    id: 5,
    title: "Performance Optimization",
    description: "Analysis of performance improvements and benchmarking results",
    thumbnail: "/placeholder.svg?height=200&width=300",
    duration: "10:55",
  },
  {
    id: 6,
    title: "Deployment Strategy",
    description: "Step-by-step deployment process and rollback procedures",
    thumbnail: "/placeholder.svg?height=200&width=300",
    duration: "14:28",
  },
]

export function SectionCards() {
  return (
    <div className="grid grid-cols-1 gap-4 px-4 sm:grid-cols-2 lg:grid-cols-3 lg:px-6">
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} />
      ))}
    </div>
  )
}
