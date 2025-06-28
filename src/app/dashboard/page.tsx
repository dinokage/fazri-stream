"use server"
import { OPTIONS } from "@/auth.config";
import { getServerSession } from "next-auth/next";

import { UploadButton } from "./upload-button";

export default async function Page(){
    
    async function checkAuth(){
        "use server"
        const session = await getServerSession(OPTIONS);
        console.log(session)
        return !!session?.user?.id;
    }
    return (
        <div>
            <UploadButton/>
        </div>
    )
}