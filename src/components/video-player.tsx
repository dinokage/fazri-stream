"use client"

import * as React from "react"
import { PlayIcon, PauseIcon, VolumeXIcon, Volume2Icon, MaximizeIcon, SettingsIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"

interface Subtitle {
  time: string
  text: string
}

interface Video {
  id: number
  title: string
  description: string
  videoUrl: string
  duration: string
  subtitles: Subtitle[]
}

interface VideoPlayerProps {
  video: Video
}

export function VideoPlayer({ video }: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = React.useState(false)
  const [isMuted, setIsMuted] = React.useState(false)
  const [currentTime, setCurrentTime] = React.useState(0)
  const [duration, setDuration] = React.useState(0)
  const [volume, setVolume] = React.useState([50])
  const [activeSubtitle, setActiveSubtitle] = React.useState<number | null>(null)

  const videoRef = React.useRef<HTMLVideoElement>(null)

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
    }
  }

  const handleVolumeChange = (value: number[]) => {
    setVolume(value)
    if (videoRef.current) {
      videoRef.current.volume = value[0] / 100
    }
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }

  const jumpToTime = (timeString: string) => {
    const [minutes, seconds] = timeString.split(":").map(Number)
    const totalSeconds = minutes * 60 + seconds

    if (videoRef.current) {
      videoRef.current.currentTime = totalSeconds
      setCurrentTime(totalSeconds)
    }
  }

  React.useEffect(() => {
    // Find active subtitle based on current time
    const currentSubtitleIndex = video.subtitles.findIndex((subtitle, index) => {
      const [minutes, seconds] = subtitle.time.split(":").map(Number)
      const subtitleTime = minutes * 60 + seconds

      const nextSubtitle = video.subtitles[index + 1]
      const nextSubtitleTime = nextSubtitle
        ? nextSubtitle.time
            .split(":")
            .map(Number)
            .reduce((acc, val, i) => acc + val * (i === 0 ? 60 : 1), 0)
        : Number.POSITIVE_INFINITY

      return currentTime >= subtitleTime && currentTime < nextSubtitleTime
    })

    setActiveSubtitle(currentSubtitleIndex >= 0 ? currentSubtitleIndex : null)
  }, [currentTime, video.subtitles])

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Video Player Section */}
      <div className="lg:col-span-2">
        <Card>
          <CardContent className="p-0">
            <div className="relative aspect-video overflow-hidden rounded-t-lg bg-black">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                poster="/placeholder.svg?height=400&width=600"
              >
                <source src={video.videoUrl} type="video/mp4" />
                Your browser does not support the video tag.
              </video>

              {/* Video Controls Overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                <div className="flex items-center gap-4">
                  <Button variant="ghost" size="icon" onClick={togglePlay} className="text-white hover:bg-white/20">
                    {isPlaying ? <PauseIcon className="h-5 w-5" /> : <PlayIcon className="h-5 w-5" />}
                  </Button>

                  <div className="flex flex-1 items-center gap-2">
                    <span className="text-sm text-white">{formatTime(currentTime)}</span>
                    <div className="flex-1">
                      <Slider
                        value={[currentTime]}
                        max={duration}
                        step={1}
                        className="w-full"
                        onValueChange={(value:any) => {
                          if (videoRef.current) {
                            videoRef.current.currentTime = value[0]
                            setCurrentTime(value[0])
                          }
                        }}
                      />
                    </div>
                    <span className="text-sm text-white">{formatTime(duration)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={toggleMute} className="text-white hover:bg-white/20">
                      {isMuted ? <VolumeXIcon className="h-5 w-5" /> : <Volume2Icon className="h-5 w-5" />}
                    </Button>

                    <div className="w-20">
                      <Slider value={volume} max={100} step={1} onValueChange={handleVolumeChange} />
                    </div>

                    <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
                      <SettingsIcon className="h-5 w-5" />
                    </Button>

                    <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
                      <MaximizeIcon className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Video Info */}
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-xl">{video.title}</CardTitle>
            <CardDescription className="text-base leading-relaxed">{video.description}</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Subtitles Section */}
      <div className="lg:col-span-1">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-lg">Subtitles & Timestamps</CardTitle>
            <CardDescription>Click on any timestamp to jump to that section</CardDescription>
          </CardHeader>
          <Separator />
          <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
              <div className="space-y-1 p-4">
                {video.subtitles.map((subtitle, index) => (
                  <div
                    key={index}
                    className={`cursor-pointer rounded-lg p-3 transition-colors hover:bg-muted ${
                      activeSubtitle === index ? "bg-primary/10 border-l-4 border-primary" : ""
                    }`}
                    onClick={() => jumpToTime(subtitle.time)}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-sm font-mono text-primary">{subtitle.time}</span>
                      <p className="flex-1 text-sm leading-relaxed">{subtitle.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
