import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const baseUrl = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:3000' 
  : process.env.DOMAIN_URL;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}


const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});


export async function createUploadURL(fileName:string, fileType:string){
  console.log(process.env.AWS_S3_BUCKET_NAME)
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME!,
      Key: fileName,
      ContentType: fileType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { 
      expiresIn: 3600 
    });

    return uploadUrl
}


export async function getFileContentByFileId(fileId:string){
  try{
  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET_NAME!,
    Key: fileId,
  });

  const response = await s3Client.send(command);
    
  const fileContent = await response.Body?.transformToString();
  return fileContent;
  }catch(e){
    console.error("Error getting file content", e);
    throw e;
  }
}
