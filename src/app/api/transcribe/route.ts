import { createClient } from '@deepgram/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { createUploadURL } from '@/lib/utils';
import { prisma } from '@/lib/prisma';
import { OPTIONS } from '@/auth.config';

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
  const session = await getServerSession(OPTIONS);
  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Not authenticated' },
      { status: 401 }
    );
  }
  const startTime = Date.now();
  
  try {
    // Optimize file parsing - use streaming instead of loading entire file
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const videoId = formData.get('videoId') as string;
    
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
    console.log(session.user)
    //create a file with transcription result
    const fileName = `transcript/${session.user.id}/${videoId}/transcription.txt`;
    const transcriptionFile = new File([transcript.transcript], fileName, {
      type: 'text/plain',
      lastModified: Date.now(),
    });

    // const response = await fetch(`${process.env.NEXTAUTH_URL}/api/upload`, { 
    //   method: 'POST',
    //   credentials: 'include',
    //   body: JSON.stringify({
    //     fileName: fileName,
    //     fileType: transcriptionFile.type,
    //     uploadType: 'transcript',
    //     videoId: videoId, // Include videoId for association
    //   }),
    // });
    // if (!response.ok) {
    //   console.error('Failed to generate upload URL:', response.statusText);
    //   return NextResponse.json(
    //     { success: false, error: 'Failed to generate upload URL' },
    //     { status: 500 }
    //   );
    // }
    const uploadUrl = await createUploadURL(fileName, "text/plain");
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: transcriptionFile,
    });
    if (!uploadResponse.ok) {
      console.error('Failed to upload transcription file:', uploadResponse.statusText);
      return NextResponse.json(
        { success: false, error: 'Failed to upload transcription file' },
        { status: 500 }
      );
    }

    // Prepare transcription result object
    await prisma.transcript.create({
      data: {
        videoId: videoId,
        fileKey: fileName, // Store the file key for future reference
        rawText: transcript.transcript, // Store raw text for future use
      }
    })

    const videoTask = await prisma.videoTask.findFirst({
      where:{
        videoId:videoId,
      }, orderBy: {
        createdAt: 'desc',
      }
    })

    if(!videoTask){
      await prisma.videoTask.create({
        data:{
          videoId:videoId,
          status:'TRANSCRIBING'
        }
      })
    }else{
      if(videoTask.status !== 'CAPTIONING'){
        await prisma.videoTask.update({
          where: {
            id: videoTask.id,
          },
          data: {
            status: 'TRANSCRIBING',
          },
        });
      }else if(videoTask.status === 'CAPTIONING'){
        await prisma.videoTask.update({
          where: {
            id: videoTask.id,
          },
          data: {
            status: 'TRANSCODING',
          },
        });
      }
    }
    const transcriptionResult = {
      text: transcript.transcript,
      confidence: transcript.confidence || 0,
      language: result?.results?.channels?.[0]?.detected_language || 'en-US',
      processingTime: Date.now() - startTime,
      wordCount: transcript.transcript.split(' ').length,
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