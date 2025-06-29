import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createUploadURL } from '@/lib/utils';
import crypto from 'crypto';
import { getServerSession } from 'next-auth/next';
import { OPTIONS } from '@/auth.config';

export async function POST(request: NextRequest) {
  console.log(request);
  try {
    const session = await getServerSession(OPTIONS);
    if (!session) {
      return NextResponse.json(
        {
          error: "Not authenticated"
        },
        { status: 401 }
      );
    }

    const { fileName, fileType, uploadType, videoId } = await request.json();

    if (!fileName || !fileType || !uploadType) {
      return NextResponse.json(
        { error: 'fileName, fileType, and uploadType are required' }, 
        { status: 400 }
      );
    }

    const fileExtension = fileName.split('.').pop();
    const baseFileName = fileName.split('.')[0];
    let uniqueFileName = "";
    let createdRecord;
    let responseData = {};

    switch (uploadType) {
      case 'video':
        uniqueFileName = `uploads/${session.user.id}/${baseFileName}_${crypto.randomUUID()}.${fileExtension}`;
        
        createdRecord = await prisma.videoFile.create({
          data: {
            name: baseFileName,
            fileKey: uniqueFileName,
            userId: session.user.id,
            description: "",
            isUploaded: false
          }
        });

        // Also create a VideoTask for the uploaded video
        await prisma.videoTask.create({
          data: {
            videoId: createdRecord.id,
            status: 'NOT_STARTED',
          }
        });

        responseData = {
          videoFileId: createdRecord.id,
          recordId: createdRecord.id
        };
        break;

      case 'transcript':
        if (!videoId) {
          return NextResponse.json(
            { error: 'videoId is required for transcript uploads' },
            { status: 400 }
          );
        }

        // Verify the video exists and belongs to the user
        const videoForTranscript = await prisma.videoFile.findFirst({
          where: {
            id: videoId,
            userId: session.user.id
          }
        });

        if (!videoForTranscript) {
          return NextResponse.json(
            { error: 'Video not found or unauthorized' },
            { status: 404 }
          );
        }

        uniqueFileName = `transcripts/${session.user.id}/${baseFileName}_${crypto.randomUUID()}.${fileExtension}`;
        
        createdRecord = await prisma.transcript.create({
          data: {
            videoId: videoId,
            fileKey: uniqueFileName,
            rawText: null
          }
        });

        responseData = {
          transcriptId: createdRecord.id,
          recordId: createdRecord.id,
          videoId: videoId
        };
        break;

      case 'subtitle':
        if (!videoId) {
          return NextResponse.json(
            { error: 'videoId is required for subtitle uploads' },
            { status: 400 }
          );
        }

        // Verify the video exists and belongs to the user
        const videoForSubtitle = await prisma.videoFile.findFirst({
          where: {
            id: videoId,
            userId: session.user.id
          }
        });

        if (!videoForSubtitle) {
          return NextResponse.json(
            { error: 'Video not found or unauthorized' },
            { status: 404 }
          );
        }

        uniqueFileName = `subtitles/${session.user.id}/${baseFileName}_${crypto.randomUUID()}.${fileExtension}`;
        
        createdRecord = await prisma.subtitles.create({
          data: {
            videoId: videoId,
            fileKey: uniqueFileName,
            rawText: null
          }
        });

        responseData = {
          subtitleId: createdRecord.id,
          recordId: createdRecord.id,
          videoId: videoId
        };
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid uploadType. Must be: video, transcript, or subtitle' },
          { status: 400 }
        );
    }

    const uploadUrl = await createUploadURL(uniqueFileName, fileType);

    console.log({
      success: true,
      uploadUrl,
      uploadType,
      ...responseData
    });

    return NextResponse.json({
      success: true,
      uploadUrl,
      uploadType: uploadType,
      ...responseData
    });

  } catch (error) {
    console.error('Upload URL generation failed:', error);
    return NextResponse.json(
      { error: 'Failed to generate upload URL' }, 
      { status: 500 }
    );
  }
}