import { generateThumbnail } from "@/genai/utils";
import { NextResponse } from "next/server";


export async function GET() {

    await generateThumbnail()  
    return NextResponse.json({ message: 'Hello, Next.js!' });
}