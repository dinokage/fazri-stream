import { createClient } from '@deepgram/sdk';
import { NextRequest, NextResponse } from 'next/server';

const deepgram = createClient(process.env.DEEPGRAM_API_KEY!);

// In-memory job tracking (use Redis in production)
const activeJobs = new Map<string, {
  status: 'pending' | 'processing' | 'completed' | 'failed',
  result?: unknown,
  error?: string,
  createdAt: number
}>();

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Generate unique job ID
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Initialize job status
    activeJobs.set(jobId, {
      status: 'pending',
      createdAt: Date.now()
    });

    // Process asynchronously (don't wait)
    processTranscriptionAsync(file, jobId);

    // Return job ID immediately
    return NextResponse.json({
      success: true,
      jobId,
      message: 'Transcription started. Use /api/transcribe-async/status to check progress.',
      estimatedTime: Math.ceil(file.size / (1024 * 1024)) * 2 // 2 seconds per MB estimate
    });

  } catch (error) {
    console.error('Async transcription error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to start transcription' },
      { status: 500 }
    );
  }
}

async function processTranscriptionAsync(file: File, jobId: string) {
  try {
    // Update status to processing
    const job = activeJobs.get(jobId);
    if (job) {
      job.status = 'processing';
      activeJobs.set(jobId, job);
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      buffer,
      {
        model: 'nova', // Fast model
        language: 'en-US',
        smart_format: true,
        punctuate: true,
        // Minimal features for speed
        diarize: false,
        utterances: false,
        paragraphs: false,
      }
    );

    if (error) {
      activeJobs.set(jobId, {
        status: 'failed',
        error: 'Transcription failed',
        createdAt: Date.now()
      });
      return;
    }

    const transcript = result?.results?.channels?.[0]?.alternatives?.[0];
    
    activeJobs.set(jobId, {
      status: 'completed',
      result: {
        text: transcript?.transcript,
        confidence: transcript?.confidence,
      },
      createdAt: Date.now()
    });

  } catch (error) {
    activeJobs.set(jobId, {
      status: 'failed',
      error: `Processing error - ${error}`,
      createdAt: Date.now()
    });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get('jobId');

  if (!jobId) {
    return NextResponse.json(
      { success: false, error: 'Job ID required' },
      { status: 400 }
    );
  }

  const job = activeJobs.get(jobId);
  
  if (!job) {
    return NextResponse.json(
      { success: false, error: 'Job not found' },
      { status: 404 }
    );
  }

  // Clean up old jobs (older than 1 hour)
  const oneHour = 60 * 60 * 1000;
  if (Date.now() - job.createdAt > oneHour) {
    activeJobs.delete(jobId);
    return NextResponse.json(
      { success: false, error: 'Job expired' },
      { status: 410 }
    );
  }

  return NextResponse.json({
    success: true,
    jobId,
    status: job.status,
    result: job.result,
    error: job.error
  });
}