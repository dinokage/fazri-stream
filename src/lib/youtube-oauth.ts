import { google } from 'googleapis';
import fs from 'fs';
import https from 'https';
import { Readable } from 'stream';

export const YOUTUBE_OAUTH_CONFIG = {
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: `${process.env.NEXTAUTH_URL}/api/youtube/callback`,
  scopes: [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube',
    'https://www.googleapis.com/auth/youtube.force-ssl'
  ]
};

// YouTube OAuth URL generator
export function getYouTubeAuthUrl(userId: string): string {
  const params = new URLSearchParams({
    client_id: YOUTUBE_OAUTH_CONFIG.clientId,
    redirect_uri: YOUTUBE_OAUTH_CONFIG.redirectUri,
    scope: YOUTUBE_OAUTH_CONFIG.scopes.join(' '),
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    state: userId // Pass user ID for security
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// YouTube API client
export class YouTubeClient {
  private youtube;
  private auth;

  constructor(accessToken: string) {
    this.auth = new google.auth.OAuth2(
      YOUTUBE_OAUTH_CONFIG.clientId,
      YOUTUBE_OAUTH_CONFIG.clientSecret,
      YOUTUBE_OAUTH_CONFIG.redirectUri
    );

    this.auth.setCredentials({ access_token: accessToken });
    this.youtube = google.youtube({ version: 'v3', auth: this.auth });
  }

  // Helper to create stream from URL
  private createStreamFromUrl(url: string): Promise<Readable> {
    return new Promise((resolve, reject) => {
      https.get(url, (response) => {
        if (response.statusCode === 200) {
          resolve(response);
        } else {
          reject(new Error(`Failed to fetch video: ${response.statusCode}`));
        }
      }).on('error', reject);
    });
  }

  // Upload video with metadata
  async uploadVideo(params: {
    videoFilePath: string; // Can be local path or URL
    title: string;
    description: string;
    thumbnailBase64?: string;
    tags?: string[];
    categoryId?: string;
    privacyStatus?: 'private' | 'public' | 'unlisted';
  }) {
    try {
      console.log('Starting YouTube upload:', { title: params.title, privacyStatus: params.privacyStatus });
      
      let mediaBody;
      
      // Check if it's a URL or local file path
      if (params.videoFilePath.startsWith('http')) {
        // It's a URL - create stream from URL
        console.log('Creating stream from URL:', params.videoFilePath);
        mediaBody = await this.createStreamFromUrl(params.videoFilePath);
      } else {
        // It's a local file path
        console.log('Creating stream from local file:', params.videoFilePath);
        if (!fs.existsSync(params.videoFilePath)) {
          throw new Error(`Video file not found: ${params.videoFilePath}`);
        }
        mediaBody = fs.createReadStream(params.videoFilePath);
      }

      // Step 1: Upload video
      console.log('Uploading video to YouTube...');
      const videoResponse = await this.youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title: params.title,
            description: params.description,
            tags: params.tags || [],
            categoryId: params.categoryId || '22', // People & Blogs
          },
          status: {
            privacyStatus: params.privacyStatus || 'private',
          },
        },
        media: {
          body: mediaBody,
        },
      });

      const videoId = videoResponse.data.id;
      console.log('Video uploaded successfully. Video ID:', videoId);

      // Step 2: Upload thumbnail if provided
      if (params.thumbnailBase64 && videoId) {
        console.log('Uploading custom thumbnail...');
        try {
          await this.uploadThumbnail(videoId, params.thumbnailBase64);
          console.log('Thumbnail uploaded successfully');
        } catch (thumbnailError) {
          console.error('Thumbnail upload failed (continuing without):', thumbnailError);
          // Continue without thumbnail - don't fail the entire upload
        }
      }

      return {
        success: true,
        videoId,
        videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
        data: videoResponse.data
      };
    } catch (error) {
      console.error('YouTube upload error:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Handle common YouTube API errors
        if (errorMessage.includes('quotaExceeded')) {
          errorMessage = 'YouTube API quota exceeded. Please try again later.';
        } else if (errorMessage.includes('insufficientPermissions')) {
          errorMessage = 'Insufficient permissions. Please reconnect your YouTube account.';
        } else if (errorMessage.includes('videoTooLarge')) {
          errorMessage = 'Video file is too large for upload.';
        } else if (errorMessage.includes('invalidVideoFormat')) {
          errorMessage = 'Invalid video format. Please use MP4, MOV, or AVI.';
        }
      }
      
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  // Upload custom thumbnail
  async uploadThumbnail(videoId: string, thumbnailBase64: string) {
    try {
      // Convert base64 to buffer
      const buffer = Buffer.from(thumbnailBase64, 'base64');
      
      // Create a readable stream from the buffer
      const bufferStream = new Readable();
      bufferStream.push(buffer);
      bufferStream.push(null); // End the stream

      const response = await this.youtube.thumbnails.set({
        videoId,
        media: {
          mimeType: 'image/png',
          body: bufferStream,
        },
      });

      return response.data;
    } catch (error) {
      console.error('Thumbnail upload error:', error);
      throw error;
    }
  }

  // Get the authenticated user's channel information
  async getChannelInfo() {
    try {
      const response = await this.youtube.channels.list({
        part: ['snippet', 'statistics'],
        mine: true,
      });

      if (!response.data.items || response.data.items.length === 0) {
        return null;
      }

      const channel = response.data.items[0];
      return {
        id: channel.id,
        snippet: {
          title: channel.snippet?.title,
          description: channel.snippet?.description,
          thumbnails: channel.snippet?.thumbnails,
        },
        statistics: {
          subscriberCount: channel.statistics?.subscriberCount,
          videoCount: channel.statistics?.videoCount,
          viewCount: channel.statistics?.viewCount,
        }
      };
    } catch (error) {
      console.error('Error fetching channel info:', error);
      throw error;
    }
  }

  // Get specific channel information by ID
  async getChannelById(channelId: string) {
    try {
      const response = await this.youtube.channels.list({
        part: ['snippet', 'statistics'],
        id: [channelId],
      });

      if (!response.data.items || response.data.items.length === 0) {
        return null;
      }

      const channel = response.data.items[0];
      return {
        id: channel.id,
        snippet: {
          title: channel.snippet?.title,
          description: channel.snippet?.description,
          thumbnails: channel.snippet?.thumbnails,
        },
        statistics: {
          subscriberCount: channel.statistics?.subscriberCount,
          videoCount: channel.statistics?.videoCount,
          viewCount: channel.statistics?.viewCount,
        }
      };
    } catch (error) {
      console.error('Error fetching channel by ID:', error);
      throw error;
    }
  }

  // Get channel statistics
  async getChannelStats(channelId: string) {
    try {
      const channelInfo = await this.getChannelById(channelId);
      
      if (!channelInfo || !channelInfo.statistics) {
        return null;
      }

      return {
        subscriberCount: channelInfo.statistics.subscriberCount || 'Hidden',
        videoCount: channelInfo.statistics.videoCount || '0',
        viewCount: channelInfo.statistics.viewCount || '0',
      };
    } catch (error) {
      console.error('Error fetching channel stats:', error);
      return null;
    }
  }

  // Get my channel (shorthand for getChannelInfo)
  async getMyChannel() {
    try {
      const channelInfo = await this.getChannelInfo();
      
      if (!channelInfo) {
        return null;
      }

      return {
        id: channelInfo.id,
        title: channelInfo.snippet?.title || 'Unknown Channel',
        description: channelInfo.snippet?.description || '',
        thumbnail: channelInfo.snippet?.thumbnails?.default?.url,
        subscriberCount: channelInfo.statistics?.subscriberCount,
        videoCount: channelInfo.statistics?.videoCount,
        viewCount: channelInfo.statistics?.viewCount,
      };
    } catch (error) {
      console.error('Error fetching my channel:', error);
      throw error;
    }
  }

  // Check if the token is still valid
  async validateToken() {
    try {
      const channelInfo = await this.getChannelInfo();
      return !!channelInfo;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }

  // Get video details
  async getVideoDetails(videoId: string) {
    try {
      const response = await this.youtube.videos.list({
        part: ['snippet', 'statistics', 'status'],
        id: [videoId],
      });

      return response.data.items?.[0];
    } catch (error) {
      console.error('Get video details error:', error);
      throw error;
    }
  }

  // Get upload history for the authenticated user
  async getUploadHistory(maxResults: number = 50) {
    try {
      // First get the channel's uploads playlist
      const channelResponse = await this.youtube.channels.list({
        part: ['contentDetails'],
        mine: true,
      });

      const uploadsPlaylistId = channelResponse.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
      
      if (!uploadsPlaylistId) {
        return [];
      }

      // Get videos from uploads playlist
      const playlistResponse = await this.youtube.playlistItems.list({
        part: ['snippet'],
        playlistId: uploadsPlaylistId,
        maxResults: maxResults,
      });

      return playlistResponse.data.items || [];
    } catch (error) {
      console.error('Error fetching upload history:', error);
      return [];
    }
  }

  // Update video metadata
  async updateVideo(params: {
    videoId: string;
    title?: string;
    description?: string;
    tags?: string[];
    privacyStatus?: 'private' | 'public' | 'unlisted';
  }) {
    try {
      const response = await this.youtube.videos.update({
        part: ['snippet', 'status'],
        requestBody: {
          id: params.videoId,
          snippet: {
            title: params.title,
            description: params.description,
            tags: params.tags,
          },
          status: {
            privacyStatus: params.privacyStatus,
          },
        },
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Update video error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Delete video
  async deleteVideo(videoId: string) {
    try {
      await this.youtube.videos.delete({
        id: videoId,
      });

      return {
        success: true,
        message: 'Video deleted successfully'
      };
    } catch (error) {
      console.error('Delete video error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Refresh access token using refresh token
  async refreshAccessToken(refreshToken: string) {
    try {
      this.auth.setCredentials({
        refresh_token: refreshToken
      });

      const { credentials } = await this.auth.refreshAccessToken();
      
      return {
        success: true,
        accessToken: credentials.access_token,
        expiryDate: credentials.expiry_date
      };
    } catch (error) {
      console.error('Refresh token error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Search for videos
  async searchVideos(query: string, maxResults: number = 25) {
    try {
      const response = await this.youtube.search.list({
        part: ['snippet'],
        q: query,
        type: ['video'],
        maxResults: maxResults,
      });

      return response.data.items || [];
    } catch (error) {
      console.error('Error searching videos:', error);
      return [];
    }
  }

  // Get playlist items
  async getPlaylistItems(playlistId: string, maxResults: number = 50) {
    try {
      const response = await this.youtube.playlistItems.list({
        part: ['snippet'],
        playlistId: playlistId,
        maxResults: maxResults,
      });

      return response.data.items || [];
    } catch (error) {
      console.error('Error fetching playlist items:', error);
      return [];
    }
  }

  // Get user's playlists
  async getMyPlaylists(maxResults: number = 25) {
    try {
      const response = await this.youtube.playlists.list({
        part: ['snippet'],
        mine: true,
        maxResults: maxResults,
      });

      return response.data.items || [];
    } catch (error) {
      console.error('Error fetching playlists:', error);
      return [];
    }
  }

  // Get video categories
  async getVideoCategories(regionCode: string = 'US') {
    try {
      const response = await this.youtube.videoCategories.list({
        part: ['snippet'],
        regionCode: regionCode,
      });

      return response.data.items || [];
    } catch (error) {
      console.error('Error fetching video categories:', error);
      return [];
    }
  }
}