import { NextResponse, NextRequest } from "next/server";

import {prisma} from "@/lib/prisma"
import { getToken } from "next-auth/jwt";
import { getServerSession } from "next-auth";
import { OPTIONS } from "@/auth.config";

export async function POST(request:NextRequest){
    try{

    const session = await getServerSession(OPTIONS)
    if(!session){
        return NextResponse.json(
            {
                error:"Not authenticated"
            },
            {status:401}
        )
    }

        const {videoId} = await request.json();

        if(!videoId){
            return NextResponse.json({ error: 'videoId required' }, { status: 400 });
        }
        
        const video = await prisma.videoFile.findUnique({
            where: {
                id: videoId
            }
        })

        if(!video){
            return NextResponse.json({ error: 'videoId not found' }, { status: 404 });
        }

        console.log("video generation begins:", video.id)

        const taskId = await prisma.$transaction(async (tx) => {
            await tx.videoFile.update({
                where:{
                    id:video.id
                },
                data:{
                    isUploaded:true
                }
            })

            const task = await tx.videoTask.create({
                data:{
                    videoId:video.id,
                }
            })


            return task.id
        })

        
        console.log("video generation task created:", taskId)  

        return NextResponse.json({
            success: true,
            taskId
        })

    }catch(error){
        console.error("Error generating video", error);
        return NextResponse.json({ error: 'Error generating video' }, { status: 500 });
    }
}