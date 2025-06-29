/* eslint-disable @typescript-eslint/no-unused-vars */
'use client';

import { useState, useRef } from 'react';
import { TranscriptionResponse, UploadProgress } from '@/types/transcription';

interface ProcessingStage {
  name: string;
  description: string;
  estimatedDuration: number; // in seconds
  completed: boolean;
  active: boolean;
}

interface CaptionFormat {
  format: 'webvtt' | 'srt';
  label: string;
}

export default function VideoUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({ loaded: 0, total: 0, percentage: 0 });
  const [currentStage, setCurrentStage] = useState<number>(0);
  const [stages, setStages] = useState<ProcessingStage[]>([]);
  const [overallProgress, setOverallProgress] = useState<number>(0);
  const [transcription, setTranscription] = useState<string>('');
  const [captions, setCaptions] = useState<{ webvtt: string | null; srt: string | null }>({ webvtt: null, srt: null });
  const [error, setError] = useState<string>('');
  const [processingStartTime, setProcessingStartTime] = useState<number>(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<string>('');
  const [selectedCaptionFormat, setSelectedCaptionFormat] = useState<'webvtt' | 'srt'>('webvtt');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const captionFormats: CaptionFormat[] = [
    { format: 'webvtt', label: 'WebVTT (.vtt)' },
    { format: 'srt', label: 'SubRip (.srt)' }
  ];

  // Calculate processing stages based on file size
  const calculateProcessingStages = (fileSize: number): ProcessingStage[] => {
    const fileSizeMB = fileSize / (1024 * 1024);
    
    return [
      {
        name: 'Upload',
        description: 'Uploading video file...',
        estimatedDuration: Math.max(5, fileSizeMB * 0.5),
        completed: false,
        active: false
      },
      {
        name: 'Processing',
        description: 'Preparing video for transcription...',
        estimatedDuration: Math.max(3, fileSizeMB * 0.2),
        completed: false,
        active: false
      },
      {
        name: 'Audio Extraction',
        description: 'Extracting audio from video...',
        estimatedDuration: Math.max(5, fileSizeMB * 0.3),
        completed: false,
        active: false
      },
      {
        name: 'AI Processing',
        description: 'Running transcription and caption generation...',
        estimatedDuration: Math.max(15, fileSizeMB * 1.0), // Slightly longer for dual processing
        completed: false,
        active: false
      },
      {
        name: 'Formatting',
        description: 'Formatting transcripts and captions...',
        estimatedDuration: 3,
        completed: false,
        active: false
      }
    ];
  };

  const updateStageProgress = (stageIndex: number, isComplete: boolean = false) => {
    setStages(prevStages => {
      const newStages = [...prevStages];
      
      // Mark previous stages as completed
      for (let i = 0; i < stageIndex; i++) {
        newStages[i].completed = true;
        newStages[i].active = false;
      }
      
      // Update current stage
      if (stageIndex < newStages.length) {
        newStages[stageIndex].active = !isComplete;
        newStages[stageIndex].completed = isComplete;
      }
      
      return newStages;
    });
    
    setCurrentStage(stageIndex);
    
    // Calculate overall progress
    const totalStages = stages.length;
    const completedStages = stageIndex + (isComplete ? 1 : 0);
    const progress = Math.round((completedStages / totalStages) * 100);
    setOverallProgress(progress);
  };

  const calculateTimeRemaining = () => {
    if (!processingStartTime || stages.length === 0) return '';
    
    const elapsed = (Date.now() - processingStartTime) / 1000;
    const totalEstimatedTime = stages.reduce((sum, stage) => sum + stage.estimatedDuration, 0);
    const remaining = Math.max(0, totalEstimatedTime - elapsed);
    
    if (remaining < 60) {
      return `${Math.round(remaining)}s remaining`;
    } else {
      const minutes = Math.floor(remaining / 60);
      const seconds = Math.round(remaining % 60);
      return `${minutes}m ${seconds}s remaining`;
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError('');
      setTranscription('');
      setCaptions({ webvtt: null, srt: null });
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
    setProcessingStartTime(Date.now());
    
    // Initialize stages
    const processingStages = calculateProcessingStages(file.size);
    setStages(processingStages);
    
    try {
      // Stage 1: Upload Progress (simulated for both requests)
      updateStageProgress(0);
      const response = await fetch("/api/upload", {
            method:"POST",
            headers:{
                "Content-Type":"application/json",
            },
            credentials:"include",
            body:JSON.stringify({
                fileName: file.name,
                fileType: file.type,
                uploadType: 'video'
            })
        })
        const data = await response.json()
        const uploadUrl = data.uploadUrl
        const videoId = data.videoFileId
      console.log(uploadUrl)
      const upload2bucket = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        redirect: "follow"
      }) 

      console.log(upload2bucket.status == 200)

      if (!upload2bucket.ok) {
        console.log("Chud gaye Guru")
      }

      
      // Create FormData for both requests
      const transcriptionFormData = new FormData();
      transcriptionFormData.append('file', file);
      transcriptionFormData.append('videoId', videoId)
      
      const captionFormDataWebVTT = new FormData();
      captionFormDataWebVTT.append('file', file);
      captionFormDataWebVTT.append('format', 'webvtt');
      captionFormDataWebVTT.append('videoId', videoId)
      
      const captionFormDataSRT = new FormData();
      captionFormDataSRT.append('file', file);
      captionFormDataSRT.append('format', 'srt');
      captionFormDataSRT.append('videoId', videoId)

      // Simulate upload progress
      await new Promise(resolve => setTimeout(resolve, 1000));
      updateStageProgress(0, true); // Upload complete
      updateStageProgress(1); // Start processing
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      updateStageProgress(1, true); // Processing complete
      updateStageProgress(2); // Audio extraction
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      updateStageProgress(2, true); // Audio extraction complete
      updateStageProgress(3); // AI Processing
      
      // Call both APIs simultaneously
      const [transcriptionResponse, webvttResponse, srtResponse] = await Promise.allSettled([
        fetch('/api/transcribe', {
          method: 'POST',
          credentials:"include",
          body: transcriptionFormData,
        }),
        fetch('/api/captions', {
          method: 'POST',
          credentials:"include",
          body: captionFormDataWebVTT,
        }),
        fetch('/api/captions', {
          method: 'POST',
          credentials:"include",
          body: captionFormDataSRT,
        })
      ]);

      updateStageProgress(3, true); // AI Processing complete
      updateStageProgress(4); // Formatting
      
      // Process transcription response
      if (transcriptionResponse.status === 'fulfilled' && transcriptionResponse.value.ok) {
        const transcriptionData: TranscriptionResponse = await transcriptionResponse.value.json();
        if (transcriptionData.success && transcriptionData.result) {
          setTranscription(transcriptionData.result.text);
        } else {
          console.error('Transcription error:', transcriptionData.error);
        }
      } else {
        console.error('Transcription request failed:', transcriptionResponse);
      }

      // Process caption responses
      const captionResults = { webvtt: "", srt: "" };
      
      if (webvttResponse.status === 'fulfilled' && webvttResponse.value.ok) {
        const webvttText = await webvttResponse.value.text();
        captionResults.webvtt = webvttText;
      } else {
        console.error('WebVTT caption request failed:', webvttResponse);
      }
      
      if (srtResponse.status === 'fulfilled' && srtResponse.value.ok) {
        const srtText = await srtResponse.value.text();
        captionResults.srt = srtText;
      } else {
        console.error('SRT caption request failed:', srtResponse);
      }
      
      setCaptions(captionResults);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      updateStageProgress(4, true); // All complete
      setOverallProgress(100);

      // Check if any processing failed
      const hasTranscription = !!transcription || 
        (transcriptionResponse.status === 'fulfilled' && transcriptionResponse.value.ok);
      const hasCaptions = captionResults.webvtt || captionResults.srt;
      
      if (!hasTranscription && !hasCaptions) {
        setError('Both transcription and caption generation failed');
      } else if (!hasTranscription) {
        setError('Transcription failed, but captions were generated successfully');
      } else if (!hasCaptions) {
        setError('Caption generation failed, but transcription was successful');
      }

    } catch (err) {
      console.error('Processing error:', err);
      setError('An error occurred during processing');
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadCaption = (format: 'webvtt' | 'srt') => {
    const captionText = captions[format];
    if (!captionText) return;
    
    const blob = new Blob([captionText], { 
      type: format === 'webvtt' ? 'text/vtt' : 'application/x-subrip' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `captions.${format === 'webvtt' ? 'vtt' : 'srt'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const resetUpload = () => {
    setFile(null);
    setTranscription('');
    setCaptions({ webvtt: null, srt: null });
    setError('');
    setUploadProgress({ loaded: 0, total: 0, percentage: 0 });
    setStages([]);
    setOverallProgress(0);
    setCurrentStage(0);
    setEstimatedTimeRemaining('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Update time remaining every second
  useState(() => {
    const interval = setInterval(() => {
      if (isProcessing) {
        setEstimatedTimeRemaining(calculateTimeRemaining());
      }
    }, 1000);
    
    return () => clearInterval(interval);
  });

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-4">Video Transcription & Caption Generation</h2>
        
        {/* File Upload */}
        <div className="mb-4">
          <label htmlFor="video-upload" className="block text-sm font-medium text-gray-700 mb-2">
            Select Video File
          </label>
          <input
            ref={fileInputRef}
            id="video-upload"
            type="file"
            accept="video/*,audio/*"
            onChange={handleFileSelect}
            disabled={isProcessing}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
          />
        </div>

        {/* File Info */}
        {file && (
          <div className="mb-4 p-3 bg-gray-50 rounded-md">
            <p className="text-sm text-gray-600">
              <strong>File:</strong> {file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)
            </p>
          </div>
        )}

        {/* Processing Stages */}
        {isProcessing && stages.length > 0 && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Processing Progress</h3>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600">{overallProgress}%</div>
                {estimatedTimeRemaining && (
                  <div className="text-sm text-gray-500">{estimatedTimeRemaining}</div>
                )}
              </div>
            </div>

            {/* Overall Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
              <div
                className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${overallProgress}%` }}
              ></div>
            </div>

            {/* Stage List */}
            <div className="space-y-3">
              {stages.map((stage, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                    ${stage.completed 
                      ? 'bg-green-500 text-white' 
                      : stage.active 
                        ? 'bg-blue-500 text-white animate-pulse' 
                        : 'bg-gray-300 text-gray-600'
                    }`}>
                    {stage.completed ? '✓' : stage.active ? '○' : index + 1}
                  </div>
                  
                  <div className="flex-1">
                    <div className={`text-sm font-medium
                      ${stage.completed 
                        ? 'text-green-700' 
                        : stage.active 
                          ? 'text-blue-700' 
                          : 'text-gray-500'
                      }`}>
                      {stage.name}
                    </div>
                    <div className="text-xs text-gray-500">{stage.description}</div>
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
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isProcessing && (
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
            )}
            <span>{isProcessing ? 'Processing...' : 'Generate Transcription & Captions'}</span>
          </button>
          
          <button
            onClick={resetUpload}
            disabled={isProcessing}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
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

        {/* Results Section */}
        <div className="space-y-6">
          {/* Transcription Result */}
          {transcription && (
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">Transcription Result:</h3>
              <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                <p className="text-gray-700 whitespace-pre-wrap">{transcription}</p>
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
              <h3 className="text-lg font-semibold mb-2">Caption Files:</h3>
              
              {/* Caption Format Selector */}
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Preview Format:
                </label>
                <select
                  value={selectedCaptionFormat}
                  onChange={(e) => setSelectedCaptionFormat(e.target.value as 'webvtt' | 'srt')}
                  className="block w-48 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  {captionFormats.map((format) => (
                    <option key={format.format} value={format.format}>
                      {format.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Caption Preview */}
              {captions[selectedCaptionFormat] && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-md mb-3">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono max-h-64 overflow-y-auto">
                    {captions[selectedCaptionFormat]}
                  </pre>
                </div>
              )}

              {/* Download Buttons */}
              <div className="flex space-x-2">
                {captions.webvtt && (
                  <button
                    onClick={() => downloadCaption('webvtt')}
                    className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    Download WebVTT
                  </button>
                )}
                {captions.srt && (
                  <button
                    onClick={() => downloadCaption('srt')}
                    className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    Download SRT
                  </button>
                )}
                {captions[selectedCaptionFormat] && (
                  <button
                    onClick={() => navigator.clipboard.writeText(captions[selectedCaptionFormat]!)}
                    className="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
                  >
                    Copy to Clipboard
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}