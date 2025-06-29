/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';
import Image from 'next/image';
import { useState, useRef, useEffect } from 'react';
import { TranscriptionResponse } from '@/types/transcription';

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
 * @param videoFile The video file to process.
 * @param frameCount The number of random frames to extract.
 * @returns A promise that resolves to an array of image Blobs.
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
      timestamps.sort((a, b) => a - b); // Process in order

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

      // Start the process
      captureFrame();
    };

    video.onerror = e => {
      reject(e);
    };
  });
};

export default function VideoUploadWithGenAI() {
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
  const [thumbnailAnalysis, setThumbnailAnalysis] =
    useState<ThumbnailAnalysis | null>(null);
  const [error, setError] = useState<string>('');
  const [processingStartTime, setProcessingStartTime] = useState<number>(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] =
    useState<string>('');
  const [videoId, setVideoId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const calculateProcessingStages = (
    fileSize: number,
  ): ProcessingStage[] => {
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

  const updateStageProgress = (
    stageIndex: number,
    isComplete: boolean = false,
  ) => {
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
      console.log(frameBlobs)

      const analysisFormData = new FormData();
      analysisFormData.append('videoId', newVideoId);
      // frameBlobs.forEach((blobu, index) => {
      //   analysisFormData.append(
      //     'screenshots',
      //     blobu,
      //     `blobu-${index}.jpeg`
      //   );
      // });
      // On the client side
frameBlobs.forEach((screenshot, index) => {
  // If screenshot is a canvas or blob, convert to file
  if (screenshot instanceof HTMLCanvasElement) {
    screenshot.toBlob((blob) => {
      analysisFormData.append('screenshots', blob? blob : new Blob() , `screenshot-${index}.png`);
    });
  } else if (screenshot instanceof Blob) {
    analysisFormData.append('screenshots', screenshot, `screenshot-${index}.png`);
  }
});

      

      const analysisResponse = await fetch('/api/analyze-video', {
        method: 'POST',
        credentials: 'include',
        body: analysisFormData,
      });

      if (analysisResponse.ok) {
        const analysisData = await analysisResponse.json();

        if (analysisData.success) {
          setScreenshots(analysisData.screenshots);
          setThumbnailAnalysis(analysisData.analysis);
          console.log('AI Analysis completed:', analysisData.analysis);
        }
      } else {
        console.error('AI analysis failed, continuing with transcription...');
      }

      updateStageProgress(1, true);
      updateStageProgress(2, true); // AI Analysis completed

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
    } catch (err) {
      console.error('Processing error:', err);
      setError('An error occurred during processing');
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-4">
          AI-Powered Video Processing
        </h2>

        {/* File Upload */}
        <div className="mb-4">
          <label
            htmlFor="video-upload"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Select Video File
          </label>
          <input
            ref={fileInputRef}
            id="video-upload"
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            disabled={isProcessing}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
          />
        </div>

        {/* File Info */}
        {file && (
          <div className="mb-4 p-3 bg-gray-50 rounded-md">
            <p className="text-sm text-gray-600">
              <strong>File:</strong> {file.name} (
              {(file.size / (1024 * 1024)).toFixed(2)} MB)
            </p>
          </div>
        )}

        {/* Processing Stages */}
        {isProcessing && stages.length > 0 && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                AI Processing Pipeline
              </h3>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600">
                  {overallProgress}%
                </div>
                {estimatedTimeRemaining && (
                  <div className="text-sm text-gray-500">
                    {estimatedTimeRemaining}
                  </div>
                )}
              </div>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
              <div
                className="bg-gradient-to-r from-blue-500 to-purple-600 h-3 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${overallProgress}%` }}
              ></div>
            </div>

            {/* Stage List */}
            <div className="space-y-3">
              {stages.map((stage, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                    ${
                      stage.completed
                        ? 'bg-green-500 text-white'
                        : stage.active
                          ? 'bg-blue-500 text-white animate-pulse'
                          : 'bg-gray-300 text-gray-600'
                    }`}
                  >
                    {stage.completed ? '✓' : stage.active ? '○' : index + 1}
                  </div>

                  <div className="flex-1">
                    <div
                      className={`text-sm font-medium
                      ${
                        stage.completed
                          ? 'text-green-700'
                          : stage.active
                            ? 'text-blue-700'
                            : 'text-gray-500'
                      }`}
                    >
                      {stage.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      {stage.description}
                    </div>
                  </div>

                  {stage.active && (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-4 mb-6">
          <button
            onClick={uploadAndProcess}
            disabled={!file || isProcessing}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-md hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 font-medium"
          >
            {isProcessing && (
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
            )}
            <span>
              {isProcessing
                ? 'Processing with AI...'
                : 'Process Video with AI Analysis'}
            </span>
          </button>

          <button
            onClick={resetUpload}
            disabled={isProcessing}
            className="px-4 py-3 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reset
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* AI Analysis Results */}
        {thumbnailAnalysis && (
          <div className="mb-6 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-6 border border-purple-200">
            <h3 className="text-xl font-bold mb-4 text-purple-800">
              🤖 AI Content Analysis
            </h3>

            {/* Generated Titles */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-3 text-gray-800">
                📝 Suggested Titles
              </h4>
              <div className="space-y-2">
                {thumbnailAnalysis.titles.map((title, index) => (
                  <div
                    key={index}
                    className="bg-white p-3 rounded-md border-l-4 border-blue-500"
                  >
                    <span className="text-sm font-medium text-blue-600">
                      Option {index + 1}:
                    </span>
                    <p className="text-gray-800 font-medium">{title}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-3 text-gray-800">
                📄 Generated Description
              </h4>
              <div className="bg-white p-4 rounded-md border">
                <p className="text-gray-700 whitespace-pre-wrap">
                  {thumbnailAnalysis.description}
                </p>
              </div>
              <button
                onClick={() =>
                  navigator.clipboard.writeText(thumbnailAnalysis.description)
                }
                className="mt-2 px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Copy Description
              </button>
            </div>

            {/* Thumbnail Concept */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-3 text-gray-800">
                🎨 Thumbnail Concept
              </h4>
              <div className="bg-white p-4 rounded-md border space-y-3">
                <div>
                  <span className="font-medium text-gray-700">
                    Visual Layout:
                  </span>
                  <p className="text-gray-600 text-sm mt-1">
                    {thumbnailAnalysis.thumbnailConcept.visual_layout}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">
                    Text Overlay:
                  </span>
                  <p className="text-gray-600 text-sm mt-1 font-bold">
                    {thumbnailAnalysis.thumbnailConcept.text_overlay}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">
                    Color Scheme:
                  </span>
                  <p className="text-gray-600 text-sm mt-1">
                    {thumbnailAnalysis.thumbnailConcept.color_scheme}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">
                    Key Elements:
                  </span>
                  <ul className="text-gray-600 text-sm mt-1 list-disc list-inside">
                    {thumbnailAnalysis.thumbnailConcept.key_elements.map(
                      (element, index) => (
                        <li key={index}>{element}</li>
                      ),
                    )}
                  </ul>
                </div>
              </div>
            </div>

            {/* AI Prompt for Thumbnail Generation */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold mb-3 text-gray-800">
                🎯 AI Image Generation Prompt
              </h4>
              <div className="bg-gray-900 text-green-400 p-4 rounded-md font-mono text-sm">
                <p className="whitespace-pre-wrap">
                  {thumbnailAnalysis.thumbnailPrompt}
                </p>
              </div>
              <button
                onClick={() =>
                  navigator.clipboard.writeText(
                    thumbnailAnalysis.thumbnailPrompt,
                  )
                }
                className="mt-2 px-3 py-1 text-sm bg-gray-700 text-white rounded hover:bg-gray-800"
              >
                Copy AI Prompt
              </button>
            </div>

            {/* Generated Images */}
            {thumbnailAnalysis.generatedImages &&
              thumbnailAnalysis.generatedImages.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold mb-3 text-gray-800">
                    🖼️ AI-Generated Thumbnails
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {thumbnailAnalysis.generatedImages.map(
                      (imageBase64, index) => (
                        <div
                          key={index}
                          className="bg-white p-3 rounded-md border"
                        >
                          <Image
                            height={100}
                            width={1000}
                            src={`data:image/png;base64,${imageBase64}`}
                            alt={`Generated thumbnail ${index + 1}`}
                            className="w-full h-auto rounded border"
                          />
                          <button
                            onClick={() => {
                              const link = document.createElement('a');
                              link.download = `ai-thumbnail-${index + 1}.png`;
                              link.href = `data:image/png;base64,${imageBase64}`;
                              link.click();
                            }}
                            className="mt-2 w-full px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                          >
                            Download Image {index + 1}
                          </button>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}
          </div>
        )}

        {/* Screenshots Display */}
        {screenshots.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4">
              📸 Extracted Screenshots
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {screenshots.map(screenshot => (
                <div
                  key={screenshot.frameNumber}
                  className="border rounded-lg p-3 space-y-2 bg-gray-50"
                >
                  <div className="w-full h-32 bg-gray-200 rounded flex items-center justify-center">
                    <span className="text-gray-500 text-sm">
                      Frame {screenshot.frameNumber}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 space-y-1">
                    <p>
                      <strong>Frame:</strong> {screenshot.frameNumber}
                    </p>
                    <p>
                      <strong>Time:</strong> {formatTime(screenshot.timestamp)}
                    </p>
                    <p>
                      <strong>Status:</strong>
                      <span className="text-green-600"> ✓ Processed</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Traditional Results Section */}
        <div className="space-y-6">
          {/* Transcription Result */}
          {transcription && (
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">
                📝 Transcription Result:
              </h3>
              <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                <p className="text-gray-700 whitespace-pre-wrap">
                  {transcription}
                </p>
              </div>

              <button
                onClick={() => navigator.clipboard.writeText(transcription)}
                className="mt-2 px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Copy Transcription
              </button>
            </div>
          )}

          {/* Caption Results */}
          {(captions.webvtt || captions.srt) && (
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">
                💬 Caption Files:
              </h3>

              <div className="space-y-4">
                {captions.webvtt && (
                  <div>
                    <h4 className="font-medium mb-2">WebVTT Format:</h4>
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-md mb-3">
                      <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono max-h-32 overflow-y-auto">
                        {captions.webvtt.substring(0, 300)}...
                      </pre>
                    </div>
                    <button
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
                      className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600 mr-2"
                    >
                      Download WebVTT
                    </button>
                  </div>
                )}

                {captions.srt && (
                  <div>
                    <h4 className="font-medium mb-2">SRT Format:</h4>
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-md mb-3">
                      <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono max-h-32 overflow-y-auto">
                        {captions.srt.substring(0, 300)}...
                      </pre>
                    </div>
                    <button
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
                      className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                    >
                      Download SRT
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}