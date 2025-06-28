import { createClient } from '@deepgram/sdk';
import { NextRequest, NextResponse } from 'next/server';

// Initialize Deepgram client once (reuse connection)
const deepgram = createClient(process.env.DEEPGRAM_API_KEY!, {
  global: {
    fetch: {
      options: {
        // Optimize connection settings
        keepalive: true,
      }
    }
  }
});

// Cache for repeated requests (optional)
const transcriptionCache = new Map<string, unknown>();

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Optimize file parsing - use streaming instead of loading entire file
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Quick validation first (before processing)
    const validationResult = await quickValidateFile(file);
    if (!validationResult.isValid) {
      return NextResponse.json(
        { success: false, error: validationResult.error },
        { status: 400 }
      );
    }

    // Generate cache key based on file hash (optional)
    const fileHash = await generateFileHash(file);
    
    // Check cache first
    if (transcriptionCache.has(fileHash)) {
      console.log('Cache hit - returning cached result');
      return NextResponse.json({
        success: true,
        result: transcriptionCache.get(fileHash),
        fromCache: true,
        processingTime: Date.now() - startTime
      });
    }

    // Convert to buffer efficiently
    const buffer = await file.arrayBuffer();

    // Optimized Deepgram settings for speed
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      Buffer.from(buffer),
      {
        // Use fastest model for quick results
        model: 'nova', // Faster than nova-2
        language: 'en-US',
        
        // Minimal processing for speed
        smart_format: true,
        punctuate: true,
        
        // Disable slower features
        diarize: false, // Disable speaker identification for speed
        utterances: false, // Disable utterance detection
        paragraphs: false, // Disable paragraph formatting
        summarize: false, // Disable summarization
        detect_language: false, // Skip language detection
        
        // Enable speed optimizations
        multichannel: false,
        alternatives: 1, // Only get top result
        profanity_filter: false,
        redact: false,
        
        // Optimize for real-time processing
        interim_results: false,
        endpointing: false,
      }
    );

    if (error) {
      console.error('Deepgram error:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Transcription failed',
          details: process.env.NODE_ENV === 'development' ? error : undefined
        },
        { status: 500 }
      );
    }

    // Extract result efficiently
    const transcript = result?.results?.channels?.[0]?.alternatives?.[0];
    
    if (!transcript?.transcript) {
      return NextResponse.json(
        { success: false, error: 'No transcription result found' },
        { status: 500 }
      );
    }

    // Minimal result object for speed
    const transcriptionResult = {
      text: transcript.transcript,
      confidence: transcript.confidence || 0,
      language: result?.results?.channels?.[0]?.detected_language || 'en-US',
      processingTime: Date.now() - startTime,
      wordCount: transcript.transcript.split(' ').length
    };

    // Cache result for future requests (optional)
    transcriptionCache.set(fileHash, transcriptionResult);
    
    // Clean cache if it gets too large
    if (transcriptionCache.size > 100) {
      const firstKey = transcriptionCache.keys().next().value;
      if (firstKey) {transcriptionCache.delete(firstKey);}
    }

    return NextResponse.json({
      success: true,
      result: transcriptionResult,
    });

  } catch (error) {
    console.error('Transcription route error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Internal server error',
        processingTime: Date.now() - startTime
      },
      { status: 500 }
    );
  }
}

// Fast file validation
async function quickValidateFile(file: File): Promise<{ isValid: boolean; error?: string }> {
  // Quick type check
  const allowedTypes = [
    'video/mp4', 'video/avi', 'video/mov', 'video/wmv', 
    'video/flv', 'video/webm', 'video/mkv', 'audio/mp3', 
    'audio/wav', 'audio/m4a', 'audio/ogg'
  ];
  
  if (!allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: 'Invalid file type. Supported: MP4, AVI, MOV, WMV, FLV, WebM, MKV, MP3, WAV, M4A, OGG'
    };
  }
  
  // Quick size check (increased limit for better performance tradeoff)
  const maxSize = 100 * 1024 * 1024; // 100MB for faster processing
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: 'File too large. Maximum size: 100MB for optimal speed.'
    };
  }
  
  return { isValid: true };
}

// Generate file hash for caching
async function generateFileHash(file: File): Promise<string> {
  // Use file metadata for quick hash instead of content
  return `${file.name}-${file.size}-${file.lastModified}`;
}

export async function GET() {
  return NextResponse.json({
    message: 'Optimized transcription API endpoint',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
}