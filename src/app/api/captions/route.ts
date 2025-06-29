import { createClient } from '@deepgram/sdk';
import { webvtt, srt } from '@deepgram/captions';
import { NextRequest, NextResponse } from 'next/server';

const deepgram = createClient(process.env.DEEPGRAM_API_KEY!);

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const format = (formData.get('format') as string) || 'webvtt';
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Quick validation
    if (!['webvtt', 'srt'].includes(format)) {
      return NextResponse.json(
        { success: false, error: 'Invalid format. Use "webvtt" or "srt"' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Optimized settings for captions (need timestamps)
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      buffer,
      {
        model: 'nova', // Fast model
        language: 'en-US',
        smart_format: true,
        punctuate: true,
        
        // Essential for captions
        utterances: true, // Need for timing
        
        // Minimal other features
        diarize: false,
        paragraphs: false,
        summarize: false,
        
        // Caption-specific optimizations
        alternatives: 1,
        profanity_filter: false,
        redact: false,
      }
    );

    if (error || !result) {
      console.error('Caption transcription error:', error);
      return NextResponse.json(
        { success: false, error: 'Caption generation failed' },
        { status: 500 }
      );
    }

    // Generate captions quickly
    let captions: string;
    let mimeType: string;
    let filename: string;

    try {
      if (format === 'srt') {
        captions = srt(result);
        mimeType = 'application/x-subrip';
        filename = 'captions.srt';
      } else {
        captions = webvtt(result);
        mimeType = 'text/vtt';
        filename = 'captions.vtt';
      }
    } catch (captionError) {
      console.error('Caption formatting error:', captionError);
      return NextResponse.json(
        { success: false, error: 'Failed to format captions' },
        { status: 500 }
      );
    }

    console.log(`Caption generation completed in ${Date.now() - startTime}ms`);

    // Return captions as downloadable file
    return new Response(captions, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': captions.length.toString(),
        'X-Processing-Time': `${Date.now() - startTime}ms`,
      },
    });

  } catch (error) {
    console.error('Caption route error:', error);
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

export async function GET() {
  return NextResponse.json({
    message: 'Optimized captions API endpoint',
    supportedFormats: ['webvtt', 'srt'],
    usage: 'POST with file and format parameters'
  });
}