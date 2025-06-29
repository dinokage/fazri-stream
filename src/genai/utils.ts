// src/genai/utils.ts - Updated version
import { GoogleGenAI, SafetyFilterLevel } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_KEY!
});

interface Screenshot {
  base64Data: string;
  timestamp: number;
  frameNumber: number;
}

interface ThumbnailGenerationResult {
  titles: string[];
  description: string;
  thumbnail_concept: {
    visual_layout: string;
    text_overlay: string;
    color_scheme: string;
    key_elements: string[];
    mobile_optimization: string;
  };
  thumbnail_ai_prompt: string;
  generatedImages?: string[]; // Base64 encoded generated images
}

export async function generateThumbnailFromScreenshots(
  screenshots: Screenshot[],
  transcript: string
): Promise<ThumbnailGenerationResult | null> {
  try {
    // Prepare content array with screenshots and transcript
    const contents = [
      // Add the screenshots as inline data
      ...screenshots.map(screenshot => ({
        inlineData: {
          mimeType: "image/jpeg",
          data: screenshot.base64Data,
        }
      })),
      // Add the prompt with transcript
      {
        text: `
# Viral Video Content Analysis & Thumbnail Generation Prompt

You are a world-class videographer, content strategist, and social media expert. You create viral, family-friendly content optimized for all major platforms (YouTube, Instagram, TikTok, Facebook). You understand audience psychology, platform algorithms, and visual storytelling.

## TASK:
Given a **video transcript** and **three key video frames**, perform a multi-modal analysis and generate:
- SEO-optimized, viral-ready titles
- Engaging, platform-tailored description
- High-conversion thumbnail concept
- Detailed AI thumbnail image generation prompt

---

## INPUTS:
- **Transcript:** ${transcript}
- **Frames:** ${screenshots.length} video frames uploaded with timestamps: ${screenshots.map(s => `Frame ${s.frameNumber} at ${s.timestamp.toFixed(1)}s`).join(', ')}

---

## CRITICAL REQUIREMENTS:

### Content Safety:
- Remove or avoid any violent, harmful, or inappropriate content
- Focus on positive, inclusive, and family-friendly aspects only

### Multi-Modal Analysis:
- Integrate insights from both transcript and visual frames
- Identify key moments, emotions, and visual hooks

### Expert Strategy:
- Apply best practices for virality, engagement, and platform optimization
- Tailor output for the intended platform (YouTube, Instagram, etc.)

---

## OUTPUT FORMAT:

Return your response as a **well-structured JSON object** with the following fields:

### 1. "titles" (array of 3-5 options)
- Each title must be:
  - SEO-optimized (include relevant keywords)
  - Highly clickable (use curiosity, benefits, or questions)  
  - Varied in style (e.g., listicle, how-to, emotional, curiosity gap)

### 2. "description" (string)
- Start with a strong hook (1-2 sentences)
- Summarize key takeaways or value for the viewer
- Include a clear call-to-action (subscribe, comment, share, etc.)
- Add 10-15 strategic hashtags (mix of broad and niche)
- Include platform elements (timestamps, mentions, links if relevant)

### 3. "thumbnail_concept" (object)
- "visual_layout": Describe the composition (foreground, background, subject placement)
- "text_overlay": Suggest short, bold text (3-6 words) for maximum impact
- "color_scheme": Recommend colors for mood and visibility
- "key_elements": List visual elements to highlight (faces, objects, actions)
- "mobile_optimization": Tips for clarity and impact on small screens

### 4. "thumbnail_ai_prompt" (string)
- Write a detailed, comprehensive prompt for AI image generation tools (DALL-E, Midjourney, Stable Diffusion)
- Include: 
  - Scene description (main subject, action, setting, lighting, mood)
  - Technical specs (aspect ratio: 16:9 for YouTube, 1:1 for Instagram, high resolution)
  - Style (photography or illustration style, color palette, artistic approach)
  - Text elements (font style, placement, and color for overlays)
  - Emotional tone (what feeling should the image evoke)
  - Element positioning (foreground/background, depth, focus)
- Make this prompt detailed enough that any AI image generator can create a high-quality thumbnail

---

## GUIDELINES:
- Prioritize engagement, shareability, and platform trends
- Optimize for mobile and desktop viewing  
- Ensure all content is brand-safe and family-friendly
- Focus on delivering clear value and entertainment to the audience
- Use concise, actionable language
- Create comprehensive AI image generation prompts that leave no room for ambiguity

---

**MANDATORY:** Generate the response in **JSON format only**. Do not include any additional text outside the JSON structure.

---

**Expected JSON Structure:**
{
  "titles": [
    "Title Option 1",
    "Title Option 2",
    "Title Option 3",
    "Title Option 4",
    "Title Option 5"
  ],
  "description": "Complete description with hook, summary, CTA, and hashtags...",
  "thumbnail_concept": {
    "visual_layout": "Description of composition...",
    "text_overlay": "BOLD TEXT",
    "color_scheme": "Color recommendations...",
    "key_elements": ["element1", "element2", "element3"],
    "mobile_optimization": "Mobile optimization tips..."
  },
  "thumbnail_ai_prompt": "Detailed AI image generation prompt with all specifications..."
}
        `
      }
    ];


    console.log("Generating thumbnail analysis with Gemini...");
    console.log("Contents prepared for Gemini:", JSON.stringify(contents, null, 2));
    // Generate analysis with Gemini
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: contents,
    });

    if (!response.candidates || response.candidates?.length === 0) {
      console.error("No analysis generated");
      return null;
    }

    let analysisData: ThumbnailGenerationResult | null = null;

    // Parse the response
    for (const part of response.candidates[0].content!.parts!) {
      if (part.text) {
        console.log("Raw Gemini response:", part.text);
        try {
          // Clean up the JSON response
          const jsonData = part.text
            .replace(/```json\s*/, "")
            .replace(/```\s*$/, "")
            .trim();
          
          analysisData = JSON.parse(jsonData) as ThumbnailGenerationResult;
          console.log("Parsed analysis data successfully");
        } catch (parseError) {
          console.error("Failed to parse JSON response:", parseError);
          console.log("Raw text that failed to parse:", part.text);
          return null;
        }
      }
    }

    if (!analysisData) {
      console.error("No valid analysis data found");
      return null;
    }

    // Generate thumbnail images using Imagen (optional)
    try {
      console.log("Generating thumbnail images with Imagen...");
      
      const imageResponse = await ai.models.generateImages({
        model: "imagen-4.0-generate-preview-06-06",
        prompt: analysisData.thumbnail_ai_prompt,
        config: {
          numberOfImages: 4,
          aspectRatio: "16:9", // YouTube thumbnail ratio
          safetyFilterLevel: SafetyFilterLevel.BLOCK_LOW_AND_ABOVE,
        }
      });

      if (imageResponse.generatedImages) {
        const generatedImages: string[] = [];
        
        for (const generatedImage of imageResponse.generatedImages) {
          if (generatedImage.image?.imageBytes) {
            generatedImages.push(generatedImage.image.imageBytes);
          }
        }
        
        analysisData.generatedImages = generatedImages;
        console.log(`Generated ${generatedImages.length} thumbnail images`);
      }
    } catch (imageError) {
      console.error("Image generation failed (continuing without images):", imageError);
      // Continue without images - analysis is still valuable
    }

    return analysisData;

  } catch (error) {
    console.error("Error in generateThumbnailFromScreenshots:", error);
    return null;
  }
}

// Helper function to convert File to base64
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        // Remove the data URL prefix (e.g., "data:image/png;base64,")
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      } else {
        reject(new Error('Failed to convert file to base64'));
      }
    };
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.readAsDataURL(file);
  });
}

// Helper function to extract screenshots from video file
export async function extractScreenshotsFromVideo(
  videoFile: File,
  count: number = 3
): Promise<Screenshot[]> {
    "use client"
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    video.muted = true;
    video.preload = 'metadata';

    video.onloadedmetadata = async () => {
      try {
        // Generate random timestamps
        const timestamps = generateRandomTimestamps(video.duration, count);
        const screenshots: Screenshot[] = [];

        // Extract screenshots at each timestamp
        for (let i = 0; i < timestamps.length; i++) {
          const timestamp = timestamps[i];

          // Seek to timestamp
          video.currentTime = timestamp;

          // Wait for seek to complete
          await new Promise<void>((seekResolve) => {
            video.onseeked = () => seekResolve();
          });

          // Wait for frame to load
          await new Promise(resolve => setTimeout(resolve, 200));

          // Set canvas dimensions
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;

          // Draw frame to canvas
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          // Convert to base64
          const dataUrl = canvas.toDataURL('image/png', 0.9);
          const base64Data = dataUrl.split(',')[1]; // Remove data URL prefix

          screenshots.push({
            base64Data,
            timestamp,
            frameNumber: i + 1
          });
        }

        // Clean up
        URL.revokeObjectURL(video.src);
        resolve(screenshots);

      } catch (error) {
        reject(error);
      }
    };

    video.onerror = () => {
      reject(new Error('Failed to load video'));
    };

    // Set video source
    const videoUrl = URL.createObjectURL(videoFile);
    video.src = videoUrl;
  });
}

function generateRandomTimestamps(duration: number, count: number): number[] {
  const timestamps = [];
  const minTime = 2; // Skip first 2 seconds
  const maxTime = Math.max(duration - 2, minTime); // Skip last 2 seconds
  
  for (let i = 0; i < count; i++) {
    const timestamp = Math.random() * (maxTime - minTime) + minTime;
    timestamps.push(timestamp);
  }
  
  return timestamps.sort((a, b) => a - b);
}

// Legacy function for backward compatibility (if needed)
export async function generateThumbnail() {
  console.warn("generateThumbnail() is deprecated. Use generateThumbnailFromScreenshots() instead.");
  // Your existing implementation if you want to keep it
}