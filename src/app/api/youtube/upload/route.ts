import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { OPTIONS } from '@/auth.config';
import { prisma } from '@/lib/prisma';
import { YouTubeClient } from '@/lib/youtube-oauth';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;
const ALGORITHM = 'aes-256-cbc';

// Create a proper 32-byte key from the environment variable
function createKey(key: string): Buffer {
  if (key.length === 64) {
    return Buffer.from(key, 'hex');
  }
  return crypto.createHash('sha256').update(key).digest();
}

function isValidHex(str: string): boolean {
  return /^[0-9a-fA-F]+$/.test(str) && str.length % 2 === 0;
}

function decrypt(encryptedText: string): string {
  console.log('Attempting to decrypt token. Encrypted text length:', encryptedText.length);
  console.log('Encrypted text format (first 50 chars):', encryptedText.substring(0, 50));
  console.log('Number of colons in encrypted text:', (encryptedText.match(/:/g) || []).length);
  
  // Check if the encrypted text looks like the old format (no IV)
  const parts = encryptedText.split(':');
  
  // If there's only one part or it doesn't look like hex:hex format, try legacy method first
  if (parts.length === 1 || !isValidHex(parts[0])) {
    console.log('Trying legacy decryption method first (no IV detected)');
    try {
      const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      console.log('Legacy decryption successful');
      return decrypted;
    } catch (legacyError) {
      console.log('Legacy decryption failed:', (legacyError as Error).message);
    }
  }
  
  // Try new method (with IV)
  try {
    console.log('Trying new decryption method (with IV)');
    const textParts = encryptedText.split(':');
    const ivHex = textParts.shift()!;
    const encryptedDataHex = textParts.join(':');
    
    console.log('IV hex length:', ivHex.length);
    console.log('Encrypted data hex length:', encryptedDataHex.length);
    
    // Validate hex strings
    if (!isValidHex(ivHex) || !isValidHex(encryptedDataHex)) {
      throw new Error('Invalid hex format in encrypted data');
    }
    
    const iv = Buffer.from(ivHex, 'hex');
    const encryptedData = Buffer.from(encryptedDataHex, 'hex');
    const key = createKey(ENCRYPTION_KEY);
    
    console.log('IV buffer length:', iv.length);
    console.log('Key buffer length:', key.length);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedData, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    
    console.log('New decryption successful');
    return decrypted;
  } catch (newError) {
    console.log('New decryption failed:', (newError as Error).message);
    
    // Final fallback: try legacy method if we haven't already
    if (parts.length > 1 && isValidHex(parts[0])) {
      try {
        console.log('Trying legacy decryption as final fallback');
        const textParts = encryptedText.split(':');
        textParts.shift(); // Remove what we thought was IV
        const encryptedData = textParts.join(':');
        
        const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY);
        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        console.log('Legacy fallback decryption successful');
        return decrypted;
      } catch (finalError) {
        console.log('Final fallback failed:', (finalError as Error).message);
      }
    }
    
    throw new Error(`All decryption methods failed. This token may have been encrypted with a different key or method.`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(OPTIONS);
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const { 
      videoId, 
      title, 
      description, 
      thumbnailBase64,
      privacyStatus = 'private',
      tags = []
    } = await request.json();

    console.log('YouTube upload request:', { videoId, title, privacyStatus });

    if (!videoId || !title) {
      return NextResponse.json(
        { error: 'videoId and title are required' },
        { status: 400 }
      );
    }

    // Get user's YouTube integration
    const youtubeIntegration = await prisma.youTubeIntegration.findFirst({
      where: {
        userId: session.user.id,
        isActive: true,
        expiresAt: {
          gt: new Date(), // Token not expired
        },
      },
    });

    if (!youtubeIntegration) {
      return NextResponse.json(
        { error: 'YouTube account not connected or token expired' },
        { status: 400 }
      );
    }

    // Get video file
    const videoFile = await prisma.videoFile.findFirst({
      where: {
        id: videoId,
        userId: session.user.id,
      },
    });

    if (!videoFile) {
      return NextResponse.json(
        { error: 'Video not found or unauthorized' },
        { status: 404 }
      );
    }

    // Check if video is already uploaded to this channel
    const existingUpload = await prisma.youTubeUpload.findFirst({
      where: {
        videoFileId: videoId,
        youtubeIntegrationId: youtubeIntegration.id,
      },
    });

    if (existingUpload) {
      return NextResponse.json(
        { 
          error: 'Video already uploaded to this YouTube channel',
          youtubeUrl: existingUpload.youtubeUrl 
        },
        { status: 409 }
      );
    }

    // Decrypt access token
    let accessToken: string;
    try {
      accessToken = decrypt(youtubeIntegration.accessToken);
    } catch (decryptError) {
      console.error('Failed to decrypt access token:', decryptError);
      return NextResponse.json(
        { error: 'Invalid access token. Please reconnect your YouTube account.' },
        { status: 400 }
      );
    }
    
    // Create YouTube client
    const youtubeClient = new YouTubeClient(accessToken);

    // Create video URL from S3
    const videoUrl = `https://${process.env.AWS_S3_BUCKET_NAME}.s3.amazonaws.com/${videoFile.fileKey}`;
    
    console.log('Uploading video to YouTube:', { videoUrl, title });

    // Upload to YouTube
    const uploadResult = await youtubeClient.uploadVideo({
      videoFilePath: videoUrl, // Using S3 URL
      title,
      description: description || '',
      thumbnailBase64,
      tags,
      privacyStatus: privacyStatus as 'private' | 'public' | 'unlisted',
    });

    if (uploadResult.success) {
      // Save upload record
      const youtubeUpload = await prisma.youTubeUpload.create({
        data: {
          videoFileId: videoId,
          youtubeIntegrationId: youtubeIntegration.id,
          youtubeVideoId: uploadResult.videoId!,
          title,
          description: description || '',
          thumbnailUrl: thumbnailBase64 ? 'custom' : null,
          status: 'PUBLISHED',
          privacyStatus,
          youtubeUrl: uploadResult.videoUrl,
        },
      });

      console.log('YouTube upload successful:', uploadResult.videoUrl);

      return NextResponse.json({
        success: true,
        youtubeUrl: uploadResult.videoUrl,
        youtubeVideoId: uploadResult.videoId,
        uploadId: youtubeUpload.id,
        channelTitle: youtubeIntegration.channelTitle,
      });
    } else {
      console.error('YouTube upload failed:', uploadResult.error);
      
      // Log failed upload attempt
      await prisma.youTubeUpload.create({
        data: {
          videoFileId: videoId,
          youtubeIntegrationId: youtubeIntegration.id,
          youtubeVideoId: 'failed',
          title,
          description: description || '',
          thumbnailUrl: thumbnailBase64 ? 'custom' : null,
          status: 'FAILED',
          privacyStatus,
          youtubeUrl: null,
        },
      });

      return NextResponse.json(
        { error: uploadResult.error || 'Failed to upload to YouTube' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('YouTube upload error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to upload to YouTube',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Get upload history for user
export async function GET() {
  try {
    const session = await getServerSession(OPTIONS);
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const uploads = await prisma.youTubeUpload.findMany({
      where: {
        youtubeIntegration: {
          userId: session.user.id,
        },
      },
      include: {
        videoFile: {
          select: {
            id: true,
            name: true,
            title: true,
          },
        },
        youtubeIntegration: {
          select: {
            channelTitle: true,
            channelId: true,
          },
        },
      },
      orderBy: {
        uploadedAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      uploads,
    });
  } catch (error) {
    console.error('Error fetching YouTube uploads:', error);
    return NextResponse.json(
      { error: 'Failed to fetch upload history' },
      { status: 500 }
    );
  }
}