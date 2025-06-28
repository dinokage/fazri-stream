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

export default function VideoUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({ loaded: 0, total: 0, percentage: 0 });
  const [currentStage, setCurrentStage] = useState<number>(0);
  const [stages, setStages] = useState<ProcessingStage[]>([]);
  const [overallProgress, setOverallProgress] = useState<number>(0);
  const [transcription, setTranscription] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [processingStartTime, setProcessingStartTime] = useState<number>(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calculate processing stages based on file size
  const calculateProcessingStages = (fileSize: number): ProcessingStage[] => {
    const fileSizeMB = fileSize / (1024 * 1024);
    
    return [
      {
        name: 'Upload',
        description: 'Uploading video file...',
        estimatedDuration: Math.max(5, fileSizeMB * 0.5), // 0.5 seconds per MB
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
        name: 'AI Transcription',
        description: 'Converting speech to text with AI...',
        estimatedDuration: Math.max(10, fileSizeMB * 0.8), // Main processing time
        completed: false,
        active: false
      },
      {
        name: 'Formatting',
        description: 'Formatting and finalizing transcript...',
        estimatedDuration: 2,
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
      setStages(calculateProcessingStages(selectedFile.size));
      setOverallProgress(0);
      setCurrentStage(0);
    }
  };

  const uploadAndTranscribe = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError('');
    setTranscription('');
    setProcessingStartTime(Date.now());
    
    // Initialize stages
    const processingStages = calculateProcessingStages(file.size);
    setStages(processingStages);
    
    try {
      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();

      // Stage 1: Upload Progress
      updateStageProgress(0);
      
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentage = Math.round((event.loaded / event.total) * 100);
          setUploadProgress({
            loaded: event.loaded,
            total: event.total,
            percentage,
          });
          
          if (percentage === 100) {
            updateStageProgress(0, true); // Upload complete
            updateStageProgress(1); // Start processing
          }
        }
      });

      // Simulate processing stages with realistic timing
      xhr.addEventListener('loadstart', () => {
        updateStageProgress(0); // Start upload
      });

      xhr.addEventListener('load', async () => {
        if (xhr.status === 200) {
          // Stage 2-4: Simulate server-side processing
          updateStageProgress(1, true); // Processing complete
          updateStageProgress(2); // Audio extraction
          
          await new Promise(resolve => setTimeout(resolve, 2000));
          updateStageProgress(2, true); // Audio extraction complete
          updateStageProgress(3); // AI Transcription
          
          await new Promise(resolve => setTimeout(resolve, 1000));
          updateStageProgress(3, true); // AI Transcription complete
          updateStageProgress(4); // Formatting
          
          await new Promise(resolve => setTimeout(resolve, 500));
          updateStageProgress(4, true); // All complete
          
          const response: TranscriptionResponse = JSON.parse(xhr.responseText);
          if (response.success && response.result) {
            setTranscription(response.result.text);
            setOverallProgress(100);
          } else {
            setError(response.error || 'Transcription failed');
          }
        } else {
          setError('Upload failed');
        }
        setIsProcessing(false);
      });

      xhr.addEventListener('error', () => {
        setError('Upload failed');
        setIsProcessing(false);
      });

      // Update time remaining every second
      const timeInterval = setInterval(() => {
        if (!isProcessing) {
          clearInterval(timeInterval);
          return;
        }
        setEstimatedTimeRemaining(calculateTimeRemaining());
      }, 1000);

      xhr.open('POST', '/api/captions');
      xhr.send(formData);

    } catch (err) {
        console.log(err)
      setError('An error occurred during upload');
      setIsProcessing(false);
    }
  };

  const resetUpload = () => {
    setFile(null);
    setTranscription('');
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

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-4">Video Transcription</h2>
        
        {/* File Upload */}
        <div className="mb-4">
          <label htmlFor="video-upload" className="block text-sm font-medium text-gray-700 mb-2">
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
                  {/* Stage Icon */}
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                    ${stage.completed 
                      ? 'bg-green-500 text-white' 
                      : stage.active 
                        ? 'bg-blue-500 text-white animate-pulse' 
                        : 'bg-gray-300 text-gray-600'
                    }`}>
                    {stage.completed ? '✓' : stage.active ? '○' : index + 1}
                  </div>
                  
                  {/* Stage Info */}
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
                  
                  {/* Stage Progress Indicator */}
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

        {/* Upload Progress (for Stage 1) */}
        {isProcessing && currentStage === 0 && (
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Uploading file...</span>
              <span>{uploadProgress.percentage}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress.percentage}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-4 mb-6">
          <button
            onClick={uploadAndTranscribe}
            disabled={!file || isProcessing}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isProcessing && (
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
            )}
            <span>{isProcessing ? 'Processing...' : 'Upload & Transcribe'}</span>
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
              Copy to Clipboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}