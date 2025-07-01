// app/api/youtube/integration/route.ts
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

// GET - Fetch integration status and channel info
export async function GET() {
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
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!integration) {
      return NextResponse.json({
        success: true,
        integration: null,
        stats: null,
      });
    }

    let stats = null;
    
    // If token is not expired, try to fetch channel stats
    if (new Date(integration.expiresAt) > new Date()) {
      try {
        const accessToken = decrypt(integration.accessToken);
        const youtubeClient = new YouTubeClient(accessToken);
        const channelInfo = await youtubeClient.getChannelInfo();
        
        if (channelInfo && channelInfo.statistics) {
          stats = {
            subscriberCount: channelInfo.statistics.subscriberCount || 'Hidden',
            videoCount: channelInfo.statistics.videoCount || '0',
            viewCount: channelInfo.statistics.viewCount || '0',
          };
        }
      } catch (statsError) {
        console.error('Failed to fetch channel stats:', statsError);
        // Don't fail the request if stats fetching fails
      }
    }

    return NextResponse.json({
      success: true,
      integration: {
        id: integration.id,
        channelId: integration.channelId,
        channelTitle: integration.channelTitle,
        channelThumbnail: integration.channelThumbnail || null,
        isActive: integration.isActive,
        expiresAt: integration.expiresAt.toISOString(),
        createdAt: integration.createdAt.toISOString(),
      },
      stats,
    });
  } catch (mainError) {
    console.error('Error fetching YouTube integration:', mainError);
    return NextResponse.json(
      { error: 'Failed to fetch integration' },
      { status: 500 }
    );
  }
}

// DELETE - Disconnect YouTube account
export async function DELETE() {
  try {
    const session = await getServerSession(OPTIONS);
    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Deactivate all integrations for this user
    await prisma.youTubeIntegration.updateMany({
      where: {
        userId: session.user.id,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'YouTube account disconnected successfully',
    });
  } catch (deleteError) {
    console.error('Error disconnecting YouTube account:', deleteError);
    return NextResponse.json(
      { error: 'Failed to disconnect YouTube account' },
      { status: 500 }
    );
  }
}