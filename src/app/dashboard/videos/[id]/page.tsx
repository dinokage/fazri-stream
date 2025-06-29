import { AppSidebar } from "@/components/app-sidebar"
import { VideoPlayer } from "@/components/video-player"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

// Sample video data - in a real app this would come from an API
const videoData = {
  1: {
    id: 1,
    title: "Project Overview Presentation",
    description:
      "This comprehensive presentation covers the current project status, key milestones achieved, and upcoming deliverables. We'll walk through the technical architecture, discuss team responsibilities, and review the timeline for the next quarter. This session is essential for all stakeholders to understand the project's current state and future direction.",
    videoUrl: "/placeholder-video.mp4",
    duration: "12:34",
    subtitles: [
      { time: "00:00", text: "Welcome everyone to today's project overview presentation." },
      { time: "00:15", text: "Let's start by reviewing our current project status and key achievements." },
      { time: "00:45", text: "As you can see from this dashboard, we've completed 75% of our planned milestones." },
      { time: "01:20", text: "The technical architecture has been finalized and approved by the engineering team." },
      { time: "02:00", text: "Our user interface design is now in the final review stage." },
      { time: "02:30", text: "Security implementation is progressing well with all major components in place." },
      { time: "03:15", text: "Performance testing shows we're meeting all our benchmark requirements." },
      { time: "04:00", text: "The deployment strategy has been refined based on stakeholder feedback." },
      { time: "04:45", text: "Team collaboration has improved significantly with our new workflow processes." },
      { time: "05:30", text: "Budget allocation is on track with no major deviations from the original plan." },
      { time: "06:15", text: "Risk assessment shows minimal impact from identified potential issues." },
      { time: "07:00", text: "Quality assurance protocols are being implemented across all development phases." },
      { time: "07:45", text: "Documentation standards have been established and are being followed consistently." },
      { time: "08:30", text: "Client feedback has been overwhelmingly positive throughout this phase." },
      { time: "09:15", text: "Next quarter's roadmap includes three major feature releases." },
      { time: "10:00", text: "Resource allocation for the upcoming phase has been optimized." },
      { time: "10:45", text: "Training programs for new team members are scheduled for next month." },
      { time: "11:30", text: "Integration testing will begin once all components are finalized." },
      { time: "12:00", text: "Thank you for your attention. Questions and discussion will follow." },
    ],
  },
  2: {
    id: 2,
    title: "Technical Architecture Review",
    description:
      "Deep dive into the system architecture and technical decisions made throughout the development process.",
    videoUrl: "/placeholder-video.mp4",
    duration: "18:45",
    subtitles: [
      { time: "00:00", text: "Today we'll review our technical architecture decisions." },
      { time: "00:30", text: "The microservices approach has proven to be the right choice." },
      { time: "01:15", text: "Database optimization has improved query performance by 40%." },
      { time: "02:00", text: "API design follows RESTful principles with GraphQL integration." },
      { time: "02:45", text: "Security layers include authentication, authorization, and encryption." },
    ],
  },
}

export default function VideoPage({ params }: { params: { id: string } }) {
  const videoId = Number.parseInt(params.id)
  const video = videoData[videoId as keyof typeof videoData]

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

  return (
        <div className="flex flex-1 flex-col">
          <div className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
            <VideoPlayer video={video} />
          </div>
        </div>
  )
}
