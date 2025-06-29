import { generateThumbnail } from "@/genai/utils";
import { NextRequest, NextResponse } from "next/server";


export async function GET(request: NextRequest) {

    await generateThumbnail()  
    return NextResponse.json({ message: 'Hello, Next.js!' });
}