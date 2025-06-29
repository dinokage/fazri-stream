// src/app/api/analyze-video-client/route.ts
// This route accepts base64 screenshots from the client instead of extracting them server-side

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { OPTIONS } from '@/auth.config';
import { prisma } from '@/lib/prisma';
import { generateThumbnailFromScreenshots } from '@/genai/utils';

interface ClientScreenshot {
  base64Data: string;
  timestamp: number;
  frameNumber: number;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(OPTIONS);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const screenshots = formData.getAll('screenshots');
    const videoId = formData.get('videoId') as string;
    const transcriptText = formData.get('transcriptText') as string | null;

    if (!screenshots || !Array.isArray(screenshots) || screenshots.length === 0) {
      console.error('Invalid screenshots data:', screenshots);
      return NextResponse.json(
        { success: false, error: 'Screenshots array is required' },
        { status: 400 }
      );
    }

    if (!videoId) {
      console.error('Video ID is required but not provided');
      return NextResponse.json(
        { success: false, error: 'Video ID is required' },
        { status: 400 }
      );
    }

    // Verify the video belongs to the user
    const videoRecord = await prisma.videoFile.findFirst({
      where: {
        id: videoId,
        userId: session.user.id
      },
      include: {
        transcript: true
      }
    });

    if (!videoRecord) {
      return NextResponse.json(
        { success: false, error: 'Video not found or unauthorized' },
        { status: 404 }
      );
    }

    console.log(`Received ${screenshots.length} screenshots from client`);

    // Process screenshots correctly
    const validScreenshots: ClientScreenshot[] = [];
    
    for (let i = 0; i < screenshots.length; i++) {
      const screenshot = screenshots[i];
      
      if (screenshot instanceof File) {
        // Convert File to base64
        const arrayBuffer = await screenshot.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString('base64');
        
        validScreenshots.push({
          base64Data: base64Data,
          timestamp: 0, // You might want to extract this from filename or metadata
          frameNumber: i + 1
        });
      } else if (typeof screenshot === 'string') {
        // If it's already a base64 string, use it directly
        // Remove data URL prefix if present
        const base64Data = screenshot.startsWith('data:') 
          ? screenshot.split(',')[1] 
          : screenshot;
          
        validScreenshots.push({
          base64Data: base64Data,
          timestamp: 0,
          frameNumber: i + 1
        });
      } else {
        console.warn(`Skipping invalid screenshot at index ${i}:`, typeof screenshot);
      }
    }

    if (validScreenshots.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid screenshots could be processed' },
        { status: 400 }
      );
    }

    console.log(`Successfully processed ${validScreenshots.length} screenshots`);

    // Use provided transcript or get from database
    const finalTranscriptText = transcriptText || 
      videoRecord.transcript?.rawText || 
      'No transcript available for this video.';

    // Generate thumbnail analysis using GenAI
    console.log('Generating thumbnail analysis with GenAI...');
    const analysisResult = await generateThumbnailFromScreenshots(validScreenshots, finalTranscriptText);

    if (!analysisResult) {
      return NextResponse.json(
        { success: false, error: 'Failed to generate thumbnail analysis' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      analysis: {
        titles: analysisResult.titles,
        description: analysisResult.description,
        thumbnailConcept: analysisResult.thumbnail_concept,
        thumbnailPrompt: analysisResult.thumbnail_ai_prompt,
        generatedImages: analysisResult.generatedImages
      },
      screenshots: validScreenshots.map(s => ({
        frameNumber: s.frameNumber,
        timestamp: s.timestamp,
        hasData: !!s.base64Data
      })),
      videoInfo: {
        id: videoRecord.id,
        name: videoRecord.name,
        hasTranscript: !!videoRecord.transcript?.rawText
      }
    });

  } catch (error) {
    console.error('Client video analysis error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to analyze video',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Client-side video analysis API endpoint',
    description: 'Accepts base64 screenshots from client and generates AI analysis',
    endpoints: {
      POST: 'Analyze video with pre-extracted screenshots'
    },
    requiredFields: ['screenshots', 'videoId'],
    optionalFields: ['transcriptText'],
    screenshotFormat: {
      base64Data: 'string (base64 encoded image)',
      timestamp: 'number (seconds)',
      frameNumber: 'number (1, 2, 3, etc.)'
    },
    usage: 'POST with JSON body containing screenshots array and videoId'
  });
}