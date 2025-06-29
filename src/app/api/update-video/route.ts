import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { OPTIONS } from '@/auth.config';
import { prisma } from '@/lib/prisma';
import { createUploadURL } from '@/lib/utils';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(OPTIONS);
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { videoId, title, thumbnailKey } = await request.json();

    if (!videoId || !title) {
      return NextResponse.json(
        { error: 'videoId and title are required' },
        { status: 400 }
      );
    }

    // Verify the video belongs to the user
    const existingVideo = await prisma.videoFile.findFirst({
      where: {
        id: videoId,
        userId: session.user.id
      }
    });

    if (!existingVideo) {
      return NextResponse.json(
        { error: 'Video not found or unauthorized' },
        { status: 404 }
      );
    }

    let finalThumbnailKey = "";

    // If a thumbnail was selected, upload it to S3
    if (thumbnailKey) {
      try {
        // Generate a unique filename for the thumbnail
        const thumbnailFileName = `thumbnails/${session.user.id}/${videoId}/${crypto.randomUUID()}.png`;
        
        // Create upload URL for the thumbnail
        const thumbnailUploadUrl = await createUploadURL(thumbnailFileName, 'image/png');
        
        // Convert base64 to blob and upload
        const base64Data = thumbnailKey;
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'image/png' });

        // Upload thumbnail to S3
        const uploadResponse = await fetch(thumbnailUploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'image/png',
          },
          body: blob,
        });

        if (uploadResponse.ok) {
          finalThumbnailKey = thumbnailFileName;
        } else {
          console.error('Failed to upload thumbnail to S3');
          // Continue without thumbnail if upload fails
        }
      } catch (thumbnailError) {
        console.error('Error processing thumbnail:', thumbnailError);
        // Continue without thumbnail if processing fails
      }
    }

    // Update the video file with the new title and thumbnail
    const updatedVideo = await prisma.videoFile.update({
      where: {
        id: videoId
      },
      data: {
        title: title,
        ...(finalThumbnailKey && { thumbnailKey: finalThumbnailKey })
      }
    });

    return NextResponse.json({
      success: true,
      video: {
        id: updatedVideo.id,
        title: updatedVideo.title,
        thumbnailKey: updatedVideo.thumbnailKey
      }
    });

  } catch (error) {
    console.error('Error updating video:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Update video API endpoint',
    description: 'Updates video title and thumbnail',
    usage: 'POST with videoId, title, and optional thumbnailKey',
    requiredFields: ['videoId', 'title'],
    optionalFields: ['thumbnailKey']
  });
}