"use client";

import { Button } from "@/components/ui/button";

export function UploadButton(){
    async function gibUploadUrl(){
        const response = await fetch("/api/upload", {
            method:"POST",
            headers:{
                "Content-Type":"application/json",
            },
            credentials:"include",
            body:JSON.stringify({
                fileName:"test.mp4",
                fileType:"video/mp4"
            })
        })

        const data = await response.json()
        console.log(data)
    }
    return (
        <Button onClick={gibUploadUrl}>Upload</Button>
    )
}