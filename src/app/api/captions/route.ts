import { createClient } from '@deepgram/sdk';
import { webvtt, srt } from '@deepgram/captions';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { createUploadURL } from '@/lib/utils';
import { prisma } from '@/lib/prisma';
import { OPTIONS } from '@/auth.config';

const deepgram = createClient(process.env.DEEPGRAM_API_KEY!);

export async function POST(request: NextRequest) {
  const session = await getServerSession(OPTIONS)
  if(!session) {
    return NextResponse.json(
      { success: false, error: 'Not authenticated' },
      { status: 401 }
    );
  }
  const startTime = Date.now();
  
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const format = (formData.get('format') as string) || 'webvtt';
    const videoId = formData.get('videoId') as string;
    console.log(videoId)
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

    //push to S3
    // console.log(request.headers.keys())
    // console.log(request.cookies.getAll())
    // const response = await fetch(`${process.env.NEXTAUTH_URL}/api/upload`, { 
    //   method: 'POST',
    //   credentials: 'same-origin',
    //   body: JSON.stringify({
    //     fileName: file.name,
    //     fileType: mimeType,
    //     uploadType: 'subtitle',
    //     videoId: videoId,
    //   }),
    // });
    // if (!response.ok) {
    //   console.error('Failed to get upload URL:', response.statusText);
    //   return NextResponse.json(
    //     { success: false, error: 'Failed to get upload URL' },
    //     { status: 500 }
    //   );
    // }

    const uploadUrl = await createUploadURL(`subtitles/${session.user.id}/${videoId}/${filename}`, mimeType);
    const uploadResponse = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': mimeType,
      },
      body: captions,
    })

    if (!uploadResponse.ok) {
      console.error('Failed to upload captions:', uploadResponse.statusText);
      return NextResponse.json(
        { success: false, error: 'Failed to upload captions' },
        { status: 500 }
      );
    }

    await prisma.subtitles.create({
      data: {
        videoId: videoId,
        fileKey: `subtitles/${session.user.id}/${videoId}/${filename}`,
        rawText: captions, // Store raw text for future use
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
          status:'CAPTIONING'
        }
      })
    }else{
      if(videoTask.status !== 'TRANSCRIBING'){
        await prisma.videoTask.update({
          where: {
            id: videoTask.id,
          },
          data: {
            status: 'CAPTIONING',
          },
        });
      }else if(videoTask.status === 'TRANSCRIBING'){
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

    // const uploadUrl = await createUploadURL(`subtitles/${session.user.id}/${videoId}/${filename}`, mimeType);
    // const uploadResponse = await fetch(uploadUrl, {
    //   method: 'PUT',
    //   headers: {
    //     'Content-Type': mimeType,
    //   },
    //   body: captions,
    // });

    // if (!uploadResponse.ok) {
    //   console.error('Failed to upload captions:', uploadResponse.statusText);
    //   return NextResponse.json(
    //     { success: false, error: 'Failed to upload captions' },
    //     { status: 500 }
    //   );
    // }

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