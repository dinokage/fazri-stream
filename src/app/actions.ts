"use server";
import { OPTIONS } from "@/auth.config";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

export async function getUserVideos(){
    const session = await getServerSession(OPTIONS);
    if(!session){
        return []
    }
    const videos = await prisma.videoFile.findMany({
        where:{
            userId:session.user.id
        },
        orderBy:{
            createdAt:"desc"
        }
    })

    return videos
}


export async function getUserVideoById(videoId:string){
    const video = await prisma.videoFile.findUnique({
        where:{
            id:videoId
        },
        select:{
            transcript:true,
            subtitles:true,
            title:true,
            description:true,
            fileKey:true,
        },
    })
    if(!video){
        return null
    }

    return video
}