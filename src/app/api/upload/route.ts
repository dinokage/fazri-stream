import { NextRequest, NextResponse } from 'next/server';
import {prisma} from '@/lib/prisma'
import { createUploadURL } from '@/lib/utils';
import crypto from 'crypto'
import { getToken } from 'next-auth/jwt';
import { getServerSession } from 'next-auth/next';
import { OPTIONS } from '@/auth.config';



// Initialize S3 client

export async function POST(request:NextRequest) {
  try {

    const session = await getServerSession(OPTIONS)
    if(!session){
        return NextResponse.json(
            {
                error:"Not authenticated"
            },
            {status:401}
        )
    }
    const { fileName, fileType } = await request.json();
    
    if (!fileName || !fileType) {
      return NextResponse.json({ error: 'fileName and fileType required' }, { status: 400 });
    }

    const fileExtension = fileName.split('.').pop();
    const uniqueFileName = `uploads/${session.user.id}/${fileName.split('.')[0]}_${crypto.randomUUID()}.${fileExtension}`;
    const uploadUrl = await createUploadURL(uniqueFileName, fileType);

    const videoFile = await prisma.videoFile.create({
        data:{
            name: `${fileName.split('.')[0]}`,
            fileKey: uniqueFileName,
            userId: session.user.id
        }
    })
    console.log({
        success:true,
        uploadUrl,
        videoFileId:videoFile.id
    })
    return NextResponse.json({
      success: true,
      uploadUrl,
      videoFileId: videoFile.id,
    });

  } catch (error) {
    console.error('S3 upload URL generation failed:', error);
    return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 });
  }
}