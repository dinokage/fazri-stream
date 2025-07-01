// app/api/youtube/integration/refresh/route.ts
import { NextResponse } from 'next/server';
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
  // Check if the encrypted text looks like the old format (no IV)
  const parts = encryptedText.split(':');
  
  // If there's only one part or it doesn't look like hex:hex format, try legacy method first
  if (parts.length === 1 || !isValidHex(parts[0])) {
    try {
      const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (legacyError) {
      console.log('Legacy decryption failed:', (legacyError as Error).message);
      // Continue to try new method
    }
  }
  
  // Try new method (with IV)
  try {
    const textParts = encryptedText.split(':');
    const ivHex = textParts.shift()!;
    const encryptedDataHex = textParts.join(':');
    
    // Validate hex strings
    if (!isValidHex(ivHex) || !isValidHex(encryptedDataHex)) {
      throw new Error('Invalid hex format in encrypted data');
    }
    
    const iv = Buffer.from(ivHex, 'hex');
    const encryptedData = Buffer.from(encryptedDataHex, 'hex');
    const key = createKey(ENCRYPTION_KEY);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedData, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (newError) {
    console.log('New decryption failed:', (newError as Error).message);
    
    // Final fallback: try legacy method if we haven't already
    if (parts.length > 1 && isValidHex(parts[0])) {
      try {
        const textParts = encryptedText.split(':');
        textParts.shift(); // Remove what we thought was IV
        const encryptedData = textParts.join(':');
        
        const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY);
        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      } catch (finalError) {
        console.log('Final fallback failed:', (finalError as Error).message);
      }
    }
    
    throw new Error('Failed to decrypt access token. Please reconnect your YouTube account.');
  }
}

export async function POST() {
  try {
    const session = await getServerSession(OPTIONS);
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const integration = await prisma.youTubeIntegration.findFirst({
      where: {
        userId: session.user.id,
        isActive: true,
      },
    });

    if (!integration) {
      return NextResponse.json(
        { error: 'No YouTube integration found' },
        { status: 404 }
      );
    }

    // Check if token is expired
    if (new Date(integration.expiresAt) <= new Date()) {
      return NextResponse.json(
        { error: 'Token expired. Please reconnect your YouTube account.' },
        { status: 400 }
      );
    }

    try {
      const accessToken = decrypt(integration.accessToken);
      const youtubeClient = new YouTubeClient(accessToken);
      
      // Refresh channel info and stats
      const channelInfo = await youtubeClient.getChannelInfo();

      if (!channelInfo) {
        return NextResponse.json(
          { error: 'Failed to fetch channel information' },
          { status: 400 }
        );
      }

      let stats = null;
      if (channelInfo.statistics) {
        stats = {
          subscriberCount: channelInfo.statistics.subscriberCount || 'Hidden',
          videoCount: channelInfo.statistics.videoCount || '0',
          viewCount: channelInfo.statistics.viewCount || '0',
        };
      }

      // Update integration with fresh channel info
      const updatedIntegration = await prisma.youTubeIntegration.update({
        where: { id: integration.id },
        data: {
          channelTitle: channelInfo.snippet?.title || integration.channelTitle,
          channelThumbnail: channelInfo.snippet?.thumbnails?.default?.url || integration.channelThumbnail,
          updatedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        integration: {
          id: updatedIntegration.id,
          channelId: updatedIntegration.channelId,
          channelTitle: updatedIntegration.channelTitle,
          channelThumbnail: updatedIntegration.channelThumbnail,
          isActive: updatedIntegration.isActive,
          expiresAt: updatedIntegration.expiresAt.toISOString(),
          createdAt: updatedIntegration.createdAt.toISOString(),
        },
        stats,
      });
    } catch (refreshError) {
      console.error('Failed to refresh integration:', refreshError);
      return NextResponse.json(
        { error: 'Failed to refresh integration. Token may be invalid.' },
        { status: 400 }
      );
    }
  } catch (mainError) {
    console.error('Error refreshing YouTube integration:', mainError);
    return NextResponse.json(
      { error: 'Failed to refresh integration' },
      { status: 500 }
    );
  }
}