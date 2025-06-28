// Utility functions for file optimization

export async function compressFile(file: File): Promise<File> {
  // For video files, you might want to compress them before sending to Deepgram
  // This is a placeholder - implement based on your needs
  return file;
}

export function getOptimalChunkSize(fileSize: number): number {
  // Determine optimal chunk size for streaming large files
  if (fileSize < 10 * 1024 * 1024) return fileSize; // < 10MB: send as-is
  if (fileSize < 50 * 1024 * 1024) return 5 * 1024 * 1024; // < 50MB: 5MB chunks
  return 10 * 1024 * 1024; // >= 50MB: 10MB chunks
}

export function shouldUseAsyncProcessing(file: File): boolean {
  const sizeMB = file.size / (1024 * 1024);
  return sizeMB > 25; // Use async for files > 25MB
}

export function estimateProcessingTime(file: File): number {
  const sizeMB = file.size / (1024 * 1024);
  // Empirical formula: ~1-2 seconds per MB for audio/video transcription
  return Math.ceil(sizeMB * 1.5) * 1000; // Return in milliseconds
}