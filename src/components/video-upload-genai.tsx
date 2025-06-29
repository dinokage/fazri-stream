"use client";

import Image from 'next/image';
import { useState, useRef, useEffect } from 'react';
import { TranscriptionResponse } from '@/types/transcription';
import { Upload, CheckCircle, AlertCircle, X, FileVideo, Sparkles, Check } from 'lucide-react';
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface ProcessingStage {
  name: string;
  description: string;
  estimatedDuration: number;
  completed: boolean;
  active: boolean;
}

interface Screenshot {
  frameNumber: number;
  timestamp: number;
  hasData: boolean;
}

interface ThumbnailAnalysis {
  titles: string[];
  description: string;
  thumbnailConcept: {
    visual_layout: string;
    text_overlay: string;
    color_scheme: string;
    key_elements: string[];
    mobile_optimization: string;
  };
  thumbnailPrompt: string;
  generatedImages?: string[];
}

/**
 * Extracts a specified number of random frames from a video file.
 */
const extractRandomFrames = (
  videoFile: File,
  frameCount: number,
): Promise<Blob[]> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const frames: Blob[] = [];

    if (!ctx) {
      return reject(new Error('Could not get 2D canvas context.'));
    }

    video.preload = 'metadata';
    video.src = URL.createObjectURL(videoFile);
    video.muted = true;

    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const duration = video.duration;
      const timestamps: number[] = [];

      // Generate unique random timestamps
      while (timestamps.length < frameCount && duration > 0) {
        const time = Math.random() * duration;
        if (!timestamps.some(t => Math.abs(t - time) < 1)) {
          timestamps.push(time);
        }
      }
      timestamps.sort((a, b) => a - b);

      let capturedFrames = 0;

      const captureFrame = () => {
        if (capturedFrames >= frameCount) {
          URL.revokeObjectURL(video.src);
          resolve(frames);
          return;
        }
        video.currentTime = timestamps[capturedFrames];
      };

      video.onseeked = () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          blob => {
            if (blob) {
              frames.push(blob);
            }
            capturedFrames++;
            captureFrame();
          },
          'image/jpeg',
          0.9,
        );
      };

      video.onerror = e => {
        URL.revokeObjectURL(video.src);
        reject(e);
      };

      captureFrame();
    };

    video.onerror = e => {
      reject(e);
    };
  });
};

export function VideoUploadWithGenAI() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStage, setCurrentStage] = useState<number>(0);
  const [stages, setStages] = useState<ProcessingStage[]>([]);
  const [overallProgress, setOverallProgress] = useState<number>(0);
  const [transcription, setTranscription] = useState<string>('');
  const [captions, setCaptions] = useState<{
    webvtt: string | null;
    srt: string | null;
  }>({ webvtt: null, srt: null });
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [thumbnailAnalysis, setThumbnailAnalysis] = useState<ThumbnailAnalysis | null>(null);
  const [error, setError] = useState<string>('');
  const [processingStartTime, setProcessingStartTime] = useState<number>(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<string>('');
  const [videoId, setVideoId] = useState<string | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<string>('');
  const [selectedThumbnail, setSelectedThumbnail] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [youtubeConnected, setYoutubeConnected] = useState(false);
  const [isYoutubeUploading, setIsYoutubeUploading] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const calculateProcessingStages = (fileSize: number): ProcessingStage[] => {
    const fileSizeMB = fileSize / (1024 * 1024);

    return [
      {
        name: 'Upload',
        description: 'Uploading video file...',
        estimatedDuration: Math.max(5, fileSizeMB * 0.5),
        completed: false,
        active: false,
      },
      {
        name: 'Screenshot Extraction',
        description: 'Extracting key frames from video...',
        estimatedDuration: 5,
        completed: false,
        active: false,
      },
      {
        name: 'AI Analysis',
        description: 'Analyzing content with GenAI...',
        estimatedDuration: 15,
        completed: false,
        active: false,
      },
      {
        name: 'Audio Processing',
        description: 'Extracting audio for transcription...',
        estimatedDuration: Math.max(3, fileSizeMB * 0.2),
        completed: false,
        active: false,
      },
      {
        name: 'Transcription & Captions',
        description: 'Generating transcripts and captions...',
        estimatedDuration: Math.max(15, fileSizeMB * 1.0),
        completed: false,
        active: false,
      },
      {
        name: 'Finalizing',
        description: 'Formatting results...',
        estimatedDuration: 3,
        completed: false,
        active: false,
      },
    ];
  };

  const updateStageProgress = (stageIndex: number, isComplete: boolean = false) => {
    setStages(prevStages => {
      const newStages = [...prevStages];

      for (let i = 0; i < stageIndex; i++) {
        newStages[i].completed = true;
        newStages[i].active = false;
      }

      if (stageIndex < newStages.length) {
        newStages[stageIndex].active = !isComplete;
        newStages[stageIndex].completed = isComplete;
      }

      return newStages;
    });

    setCurrentStage(stageIndex);
    console.log(`Processing stage ${currentStage + 1} of ${stages.length}`);
    const totalStages = stages.length;
    const completedStages = stageIndex + (isComplete ? 1 : 0);
    const progress = Math.round((completedStages / totalStages) * 100);
    setOverallProgress(progress);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
      setTranscription('');
      setCaptions({ webvtt: null, srt: null });
      setScreenshots([]);
      setThumbnailAnalysis(null);
      setStages(calculateProcessingStages(selectedFile.size));
      setOverallProgress(0);
      setCurrentStage(0);
      setSelectedTitle('');
      setSelectedThumbnail('');
      setDebugInfo('');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);
    const videoFile = droppedFiles.find(file => file.type.startsWith('video/'));
    
    if (videoFile) {
      setFile(videoFile);
      setError('');
      setTranscription('');
      setCaptions({ webvtt: null, srt: null });
      setScreenshots([]);
      setThumbnailAnalysis(null);
      setStages(calculateProcessingStages(videoFile.size));
      setOverallProgress(0);
      setCurrentStage(0);
      setSelectedTitle('');
      setSelectedThumbnail('');
      setDebugInfo('');
    } else {
      toast.error("Please upload a valid video file");
    }
  };

  const uploadAndProcess = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError('');
    setTranscription('');
    setCaptions({ webvtt: null, srt: null });
    setScreenshots([]);
    setThumbnailAnalysis(null);
    setProcessingStartTime(Date.now());
    setDebugInfo('');

    const processingStages = calculateProcessingStages(file.size);
    setStages(processingStages);

    try {
      // Stage 1: Upload video
      updateStageProgress(0);

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          uploadType: 'video',
        }),
      });

      const data = await response.json();
      const uploadUrl = data.uploadUrl;
      const newVideoId = data.videoFileId;
      setVideoId(newVideoId);

      const upload2bucket = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
      });

      if (!upload2bucket.ok) {
        throw new Error('Failed to upload video');
      }

      updateStageProgress(0, true);

      // Stage 2: Screenshot Extraction & AI Analysis
      updateStageProgress(1);

      // Extract 3 random frames from the video on the client-side
      const frameBlobs = await extractRandomFrames(file, 3);
      console.log('Extracted frames:', frameBlobs.length);

      const analysisFormData = new FormData();
      analysisFormData.append('videoId', newVideoId);
      
      frameBlobs.forEach((screenshot, index) => {
        if (screenshot instanceof Blob) {
          analysisFormData.append('screenshots', screenshot, `screenshot-${index}.png`);
          console.log(`Added screenshot ${index + 1} to form data`);
        }
      });

      setDebugInfo('Sending screenshots to AI analysis...');
      
      const analysisResponse = await fetch('/api/analyze-video', {
        method: 'POST',
        credentials: 'include',
        body: analysisFormData,
      });

      if (analysisResponse.ok) {
        const analysisData = await analysisResponse.json();
        console.log('Full AI Analysis Response:', analysisData);

        if (analysisData.success) {
          setScreenshots(analysisData.screenshots);
          setThumbnailAnalysis(analysisData.analysis);
          
          // Debug logging for thumbnails
          const imageCount = analysisData.analysis?.generatedImages?.length || 0;
          console.log('Generated images count:', imageCount);
          console.log('Generated images array:', analysisData.analysis?.generatedImages);
          
          setDebugInfo(`AI Analysis completed. Generated ${imageCount} thumbnails.`);
          
          if (imageCount === 0) {
            console.warn('No images were generated by AI');
            setDebugInfo('AI Analysis completed but no thumbnail images were generated.');
          }
          
          toast.success(`AI Analysis completed! Generated ${imageCount} thumbnails.`);
        } else {
          console.error('AI analysis failed:', analysisData.error);
          setDebugInfo(`AI Analysis failed: ${analysisData.error || 'Unknown error'}`);
        }
      } else {
        const errorText = await analysisResponse.text();
        console.error('AI analysis request failed:', analysisResponse.status, errorText);
        setDebugInfo(`AI analysis request failed: ${analysisResponse.status}`);
        toast.error('AI analysis failed, continuing with transcription...');
      }

      updateStageProgress(1, true);
      updateStageProgress(2, true);

      // Stage 3: Audio Processing
      updateStageProgress(3);
      await new Promise(resolve => setTimeout(resolve, 1000));
      updateStageProgress(3, true);

      // Stage 4: Transcription and Captions
      updateStageProgress(4);

      const transcriptionFormData = new FormData();
      transcriptionFormData.append('file', file);
      transcriptionFormData.append('videoId', newVideoId);

      const captionFormDataWebVTT = new FormData();
      captionFormDataWebVTT.append('file', file);
      captionFormDataWebVTT.append('format', 'webvtt');
      captionFormDataWebVTT.append('videoId', newVideoId);

      const captionFormDataSRT = new FormData();
      captionFormDataSRT.append('file', file);
      captionFormDataSRT.append('format', 'srt');
      captionFormDataSRT.append('videoId', newVideoId);

      const [transcriptionResponse, webvttResponse, srtResponse] =
        await Promise.allSettled([
          fetch('/api/transcribe', {
            method: 'POST',
            credentials: 'include',
            body: transcriptionFormData,
          }),
          fetch('/api/captions', {
            method: 'POST',
            credentials: 'include',
            body: captionFormDataWebVTT,
          }),
          fetch('/api/captions', {
            method: 'POST',
            credentials: 'include',
            body: captionFormDataSRT,
          }),
        ]);

      updateStageProgress(4, true);

      // Stage 5: Finalizing
      updateStageProgress(5);

      // Process transcription response
      if (
        transcriptionResponse.status === 'fulfilled' &&
        transcriptionResponse.value.ok
      ) {
        const transcriptionData: TranscriptionResponse =
          await transcriptionResponse.value.json();
        if (transcriptionData.success && transcriptionData.result) {
          setTranscription(transcriptionData.result.text);
        }
      }

      // Process caption responses
      const captionResults = { webvtt: '', srt: '' };

      if (
        webvttResponse.status === 'fulfilled' &&
        webvttResponse.value.ok
      ) {
        const webvttText = await webvttResponse.value.text();
        captionResults.webvtt = webvttText;
      }

      if (srtResponse.status === 'fulfilled' && srtResponse.value.ok) {
        const srtText = await srtResponse.value.text();
        captionResults.srt = srtText;
      }

      setCaptions(captionResults);

      updateStageProgress(5, true);
      setOverallProgress(100);
      
      toast.success("Video processing completed successfully!");
    } catch (err) {
      console.error('Processing error:', err);
      setError('An error occurred during processing');
      setDebugInfo(`Processing error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      toast.error("Video processing failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const resetUpload = () => {
    setFile(null);
    setTranscription('');
    setCaptions({ webvtt: null, srt: null });
    setScreenshots([]);
    setThumbnailAnalysis(null);
    setError('');
    setStages([]);
    setOverallProgress(0);
    setCurrentStage(0);
    setVideoId(null);
    setEstimatedTimeRemaining('');
    setSelectedTitle('');
    setSelectedThumbnail('');
    setDebugInfo('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmitSelections = async () => {
    if (!videoId || !selectedTitle) {
      toast.error("Please select a title before submitting");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/update-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          videoId,
          title: selectedTitle,
          thumbnailKey: selectedThumbnail || null,
        }),
      });

      if (response.ok) {
        toast.success("Video updated successfully!");
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to update video");
      }
    } catch (error) {
      console.error('Error updating video:', error);
      toast.error("An error occurred while updating the video");
    } finally {
      setIsSubmitting(false);
    }
  };

  const connectYouTube = async () => {
    try {
      const response = await fetch('/api/youtube/connect');
      const data = await response.json();
      
      if (data.success) {
        window.open(data.authUrl, 'youtube_auth', 'width=500,height=600');
        
        // Listen for the popup to close
        const checkClosed = setInterval(() => {
          setTimeout(() => {
            checkYouTubeStatus();
            clearInterval(checkClosed); // Use the variable here
          }, 1000);
        }, 5000); // Also changed to 5 seconds to be more reasonable        
      }
    } catch (error) {
      toast.error(`Failed to connect YouTube account ${error}`);
    }
  };

  const checkYouTubeStatus = async () => {
    try {
      const response = await fetch('/api/youtube/status');
      const data = await response.json();
      setYoutubeConnected(data.connected);
    } catch (error) {
      console.error('Error checking YouTube status:', error);
    }
  };

  const uploadToYouTube = async () => {
    if (!selectedTitle || !videoId) {
      toast.error("Please select a title first");
      return;
    }

    setIsYoutubeUploading(true);
    try {
      const response = await fetch('/api/youtube/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          videoId,
          title: selectedTitle,
          description: thumbnailAnalysis?.description || '',
          thumbnailBase64: selectedThumbnail,
          privacyStatus: 'private',
          tags: ['AI Generated', 'StreamGenius']
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success("Video uploaded to YouTube successfully!");
        
        if (data.youtubeUrl) {
          window.open(data.youtubeUrl, '_blank');
        }
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to upload to YouTube");
      }
    } catch (error) {
      console.error('YouTube upload error:', error);
      toast.error("An error occurred during YouTube upload");
    } finally {
      setIsYoutubeUploading(false);
    }
  };

  // Check YouTube connection status on mount
  useEffect(() => {
    checkYouTubeStatus();
  }, []);

  // Update time remaining every second
  useEffect(() => {
    const calculateTimeRemaining = () => {
      if (!processingStartTime || stages.length === 0) return '';
  
      const elapsed = (Date.now() - processingStartTime) / 1000;
      const totalEstimatedTime = stages.reduce(
        (sum, stage) => sum + stage.estimatedDuration,
        0,
      );
      const remaining = Math.max(0, totalEstimatedTime - elapsed);
  
      if (remaining < 60) {
        return `${Math.round(remaining)}s remaining`;
      } else {
        const minutes = Math.floor(remaining / 60);
        const seconds = Math.round(remaining % 60);
        return `${minutes}m ${seconds}s remaining`;
      }
    };
  
    const interval = setInterval(() => {
      if (isProcessing) {
        setEstimatedTimeRemaining(calculateTimeRemaining());
      }
    }, 1000);
  
    return () => clearInterval(interval);
  }, [isProcessing, processingStartTime, stages]);

  return (
    <div className="space-y-6">
      {/* Debug Info Card */}
      {debugInfo && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-blue-700">
              <Sparkles className="h-4 w-4" />
              <p className="text-sm">{debugInfo}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* File Upload Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileVideo className="h-5 w-5" />
            Video Upload
          </CardTitle>
          <CardDescription>
            Drag and drop your video file here, or click to browse. Supported formats: MP4, AVI, MOV, WMV, FLV, WebM, MKV
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="relative rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 text-center transition-colors hover:border-muted-foreground/50"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              disabled={isProcessing}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-full bg-muted p-4">
                <Upload className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-medium">Drop your video file here</p>
                <p className="text-sm text-muted-foreground">
                  or{" "}
                  <Button
                    variant="link"
                    className="h-auto p-0 text-primary"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessing}
                  >
                    browse files
                  </Button>
                </p>
              </div>
            </div>
          </div>

          {/* File Info */}
          {file && (
            <div className="mt-4 p-3 bg-muted rounded-md">
              <p className="text-sm font-medium">
                {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4 mt-6">
            <Button
              onClick={uploadAndProcess}
              disabled={!file || isProcessing}
              className="flex items-center gap-2"
            >
              {isProcessing && (
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
              )}
              <Sparkles className="h-4 w-4" />
              {isProcessing ? 'Processing...' : 'Process with AI'}
            </Button>

            <Button
              variant="outline"
              onClick={resetUpload}
              disabled={isProcessing}
            >
              <X className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <p>{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Processing Stages */}
      {isProcessing && stages.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                AI Processing Pipeline
              </CardTitle>
              <div className="text-right">
                <div className="text-2xl font-bold text-primary">
                  {overallProgress}%
                </div>
                {estimatedTimeRemaining && (
                  <div className="text-sm text-muted-foreground">
                    {estimatedTimeRemaining}
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Progress value={overallProgress} className="mb-6" />
            
            <div className="space-y-4">
              {stages.map((stage, index) => (
                <div key={index} className="flex items-center gap-4">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors
                    ${
                      stage.completed
                        ? 'bg-primary text-primary-foreground'
                        : stage.active
                          ? 'bg-primary/20 text-primary animate-pulse'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {stage.completed ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : stage.active ? (
                      <div className="h-2 w-2 bg-current rounded-full" />
                    ) : (
                      index + 1
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`font-medium ${
                        stage.completed
                          ? 'text-primary'
                          : stage.active
                            ? 'text-foreground'
                            : 'text-muted-foreground'
                      }`}>
                        {stage.name}
                      </p>
                      {stage.completed && (
                        <Badge variant="secondary" className="text-xs">
                          Complete
                        </Badge>
                      )}
                      {stage.active && (
                        <Badge variant="default" className="text-xs">
                          Processing
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {stage.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Analysis Results */}
      {thumbnailAnalysis && (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <Sparkles className="h-5 w-5" />
              AI Content Analysis
            </CardTitle>
            <CardDescription>
              AI-generated titles, descriptions, and thumbnail concepts for your video
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Generated Titles */}
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                📝 Choose Your Title
              </h4>
              <RadioGroup value={selectedTitle} onValueChange={setSelectedTitle}>
                <div className="space-y-2">
                  {thumbnailAnalysis.titles.map((title, index) => (
                    <Card key={index} className={`p-3 cursor-pointer transition-colors ${
                      selectedTitle === title ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                    }`}>
                      <div className="flex items-start gap-3">
                        <RadioGroupItem value={title} id={`title-${index}`} className="mt-1" />
                        <div className="flex-1">
                          <Label htmlFor={`title-${index}`} className="cursor-pointer">
                            <Badge variant="outline" className="mb-2">
                              Option {index + 1}
                            </Badge>
                            <p className="font-medium">{title}</p>
                          </Label>
                        </div>
                        {selectedTitle === title && (
                          <Check className="h-4 w-4 text-primary mt-1" />
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </RadioGroup>
            </div>

            <Separator />

            {/* Description */}
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                📄 Generated Description
              </h4>
              <Card className="p-4">
                <p className="text-sm whitespace-pre-wrap mb-4">
                  {thumbnailAnalysis.description}
                </p>
                <Button
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(thumbnailAnalysis.description);
                    toast.success("Description copied to clipboard");
                  }}
                >
                  Copy Description
                </Button>
              </Card>
            </div>

            <Separator />

            {/* Thumbnail Concept */}
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                🎨 Thumbnail Concept
              </h4>
              <Card className="p-4 space-y-4">
                <div>
                  <p className="font-medium text-sm">Visual Layout:</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {thumbnailAnalysis.thumbnailConcept.visual_layout}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-sm">Text Overlay:</p>
                  <p className="text-sm font-bold mt-1">
                    {thumbnailAnalysis.thumbnailConcept.text_overlay}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-sm">Color Scheme:</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {thumbnailAnalysis.thumbnailConcept.color_scheme}
                  </p>
                </div>
                <div>
                  <p className="font-medium text-sm">Key Elements:</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {thumbnailAnalysis.thumbnailConcept.key_elements.map((element, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {element}
                      </Badge>
                    ))}
                  </div>
                </div>
              </Card>
            </div>

            <Separator />

            {/* AI Prompt */}
            <div>
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                🎯 AI Image Generation Prompt
              </h4>
              <Card className="p-4">
                <pre className="text-xs bg-muted p-3 rounded text-wrap whitespace-pre-wrap font-mono">
                  {thumbnailAnalysis.thumbnailPrompt}
                </pre>
                <Button
                  size="sm"
                  className="mt-3"
                  onClick={() => {
                    navigator.clipboard.writeText(thumbnailAnalysis.thumbnailPrompt);
                    toast.success("AI prompt copied to clipboard");
                  }}
                >
                  Copy AI Prompt
                </Button>
              </Card>
            </div>

            <Separator />

            {/* Generated Images */}
            {thumbnailAnalysis.generatedImages && thumbnailAnalysis.generatedImages.length > 0 ? (
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  🖼️ Choose Your Thumbnail ({thumbnailAnalysis.generatedImages.length} generated)
                </h4>
                <RadioGroup value={selectedThumbnail} onValueChange={setSelectedThumbnail}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {thumbnailAnalysis.generatedImages.map((imageBase64, index) => (
                      <Card key={index} className={`p-3 cursor-pointer transition-colors ${
                        selectedThumbnail === imageBase64 ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      }`}>
                        <div className="space-y-3">
                          <div className="relative">
                            <Image
                              height={200}
                              width={400}
                              src={`data:image/png;base64,${imageBase64}`}
                              alt={`Generated thumbnail ${index + 1}`}
                              className="w-full h-auto rounded border"
                              onError={(e) => {
                                console.error(`Failed to load thumbnail ${index + 1}`);
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                            {selectedThumbnail === imageBase64 && (
                              <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                                <Check className="h-4 w-4" />
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <RadioGroupItem value={imageBase64} id={`thumbnail-${index}`} />
                            <Label htmlFor={`thumbnail-${index}`} className="cursor-pointer font-medium">
                              Thumbnail {index + 1}
                            </Label>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              const link = document.createElement('a');
                              link.download = `ai-thumbnail-${index + 1}.png`;
                              link.href = `data:image/png;base64,${imageBase64}`;
                              link.click();
                            }}
                          >
                            Download Image
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </RadioGroup>
              </div>
            ) : (
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  🖼️ AI Thumbnail Generation
                </h4>
                <Card className="p-4 border-amber-200 bg-amber-50">
                  <div className="flex items-center gap-2 text-amber-700">
                    <AlertCircle className="h-4 w-4" />
                    <p className="text-sm">
                      No thumbnails were generated by AI. This might be due to:
                    </p>
                  </div>
                  <ul className="mt-2 text-sm text-amber-600 list-disc list-inside">
                    <li>AI service temporarily unavailable</li>
                    <li>Content policy restrictions</li>
                    <li>Processing limitations</li>
                  </ul>
                  <p className="mt-2 text-xs text-amber-600">
                    You can still proceed with the generated titles and descriptions.
                  </p>
                </Card>
              </div>
            )}

            {/* Submit Selection Button */}
            {(selectedTitle || selectedThumbnail) && (
              <div className="pt-4">
                <Separator className="mb-4" />
                
                {/* YouTube Connection Status */}
                <div className="mb-4 p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    📺 YouTube Publishing
                  </h4>
                  {youtubeConnected ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="text-sm text-green-600">YouTube account connected</span>
                      </div>
                      <Button
                        onClick={uploadToYouTube}
                        disabled={isYoutubeUploading || !selectedTitle}
                        className="flex items-center gap-2"
                        variant="default"
                      >
                        {isYoutubeUploading && (
                          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                        )}
                        {isYoutubeUploading ? 'Uploading to YouTube...' : 'Upload to YouTube'}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Connect your YouTube account to upload directly</span>
                      <Button
                        onClick={connectYouTube}
                        variant="outline"
                        className="flex items-center gap-2"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                        </svg>
                        Connect YouTube
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {selectedTitle && <p>✓ Title selected</p>}
                    {selectedThumbnail && <p>✓ Thumbnail selected</p>}
                    {!selectedThumbnail && thumbnailAnalysis.generatedImages?.length === 0 && (
                      <p>⚠️ No thumbnail selected (none generated)</p>
                    )}
                  </div>
                  <Button 
                    onClick={handleSubmitSelections}
                    disabled={isSubmitting || !selectedTitle}
                    className="flex items-center gap-2"
                    variant="secondary"
                  >
                    {isSubmitting && (
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    )}
                    {isSubmitting ? 'Updating...' : 'Save to Database'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Screenshots Display */}
      {screenshots.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              📸 Extracted Screenshots
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {screenshots.map(screenshot => (
                <Card key={screenshot.frameNumber} className="p-3">
                  <div className="w-full h-32 bg-muted rounded flex items-center justify-center mb-2">
                    <span className="text-muted-foreground text-sm">
                      Frame {screenshot.frameNumber}
                    </span>
                  </div>
                  <div className="text-xs space-y-1">
                    <p><strong>Frame:</strong> {screenshot.frameNumber}</p>
                    <p><strong>Time:</strong> {formatTime(screenshot.timestamp)}</p>
                    <div className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3 text-green-500" />
                      <span className="text-green-600">Processed</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Traditional Results Section */}
      {(transcription || captions.webvtt || captions.srt) && (
        <div className="space-y-6">
          {/* Transcription Result */}
          {transcription && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  📝 Transcription Result
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48 w-full rounded border p-4 mb-4">
                  <p className="text-sm whitespace-pre-wrap">{transcription}</p>
                </ScrollArea>
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(transcription);
                    toast.success("Transcription copied to clipboard");
                  }}
                >
                  Copy Transcription
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Caption Results */}
          {(captions.webvtt || captions.srt) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  💬 Caption Files
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {captions.webvtt && (
                  <div>
                    <h4 className="font-medium mb-2">WebVTT Format:</h4>
                    <ScrollArea className="h-32 w-full rounded border p-4 mb-3">
                      <pre className="text-xs whitespace-pre-wrap font-mono">
                        {captions.webvtt.substring(0, 300)}...
                      </pre>
                    </ScrollArea>
                    <Button
                      onClick={() => {
                        const blob = new Blob([captions.webvtt!], {
                          type: 'text/vtt',
                        });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'captions.vtt';
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      Download WebVTT
                    </Button>
                  </div>
                )}

                {captions.srt && (
                  <div>
                    <h4 className="font-medium mb-2">SRT Format:</h4>
                    <ScrollArea className="h-32 w-full rounded border p-4 mb-3">
                      <pre className="text-xs whitespace-pre-wrap font-mono">
                        {captions.srt.substring(0, 300)}...
                      </pre>
                    </ScrollArea>
                    <Button
                      onClick={() => {
                        const blob = new Blob([captions.srt!], {
                          type: 'application/x-subrip',
                        });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'captions.srt';
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      Download SRT
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}