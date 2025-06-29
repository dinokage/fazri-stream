import { GoogleGenAI, Modality } from "@google/genai";
import * as fs from "node:fs"
import * as path from "node:path"


const ai = new GoogleGenAI({})

const imagePath1 = path.join(process.cwd(), 'public', 'frame_1.png');
const imagePath2 = path.join(process.cwd(), 'public', 'frame_2.png');
const imagePath3 = path.join(process.cwd(), 'public', 'frame_3.png');

const frame1 = fs.readFileSync(imagePath1, "base64")
const frame2 = fs.readFileSync(imagePath2, "base64")
const frame3 = fs.readFileSync(imagePath3, "base64")



const transcript = `Good morning, Jean. How's everybody feeling? Hey, chef Sid, have you seen my iron? Also, when you have a stick, would you ask chef Carmen what the fuck you do with my tables out front? Chef Sid, would you please tell Richard, that I thought I would set him up for success and arrange his tables in a more efficient pattern. Is that what you did? Yes. That's what I did. It was really funny. I, I walked in, you know, so strange. It looked like the person who had done it previously had never left the city of Chicago. We can leave the city Chicago out of it. Zero flow. No efficiency looked like shit, so I thought I'd give you a hand. Shif said, would you tell chef Carmen that I can give him a fucking hand if he wants to give me a fucking hand. I'll give you a fucking hand. I'll give you a fucking hand. I'll give you a fucking hand. I just might suggest that that the both of you stop because, because I don't like this at all. I said it's fine. Schiff Carmen uses power phrases because he's a baby replicant who's not self actualized, which is maybe why he repeatedly referred to me as a loser. Rishi, I apologize. No. No. No. It's all good. I don't need your apology. I know how you feel now. Also, I respect your honesty and bravery from inside a locked vault. You know what? Matter of fact, chef Sydney? I don't remember Richard apologizing for all the shit. He was literally screaming at me while I was like I love you. No. What? You know what? I'm keeping our shit separate from this shit like a goddamn g out there, that's my dojo. Shit gets rearranged without my approval or consent. It creates an environment of fear and fear does not exist in that dojo. Richard, I added more two tops because all those four tops were fucking nonsense. Okay. Before tops in the first doll. I lose the flowers. You Jesus Christ. That was a lot of fun times. Who's butt? I'm sorry. I can't keep apologizing, and you're screaming. Am I? Yeah. Yeah. You all. Oh, yeah. That's fucking Is it is it fucking rich? Is it fucking rich, Richard? You wanna get this fucking out of my face, Carmen? Shut the fuck up, please. Sorry, Sid. It's just textbook sublimation. Once you've seen it a thousand times. I actually don't know what the fuck to do right now. Oh my god. Am I finally having this true?`

const contents = [
    {
        inlineData:{
            mimeType:"image/png",
            data:frame1,
        }
    },
    {
        inlineData:{
            mimeType:"image/png",
            data:frame2,
        }
    },
    {
        inlineData:{
            mimeType:"image/png",
            data:frame3,
        }
    },
    {
        text:`
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
- **Frames:** Uploaded along with the transcript

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
]


export async function generateThumbnail(){
    const ai = new GoogleGenAI({apiKey:process.env.GEMINI_KEY})
    const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents:contents,
    });
    if(!response.candidates || response.candidates?.length === 0){
        console.log("No image generated");
        return
    }

    let data=null
    for(const part of response.candidates[0].content!.parts!){

        if(part.inlineData){
            const imageData = part.inlineData.data;
            if(!imageData){
                console.log("No image data found");
                return
            }
            const buffer = Buffer.from(imageData, "base64");
            fs.writeFileSync("gemini-native-image.png", buffer);
            console.log("Image saved as gemini-native-image.png");
        }else if(part.text){
            console.log(part.text);
            const jsonData = part.text.replace("```json", "").replace("```", "");
            data = JSON.parse(jsonData)
        } 
    }

    const res = await ai.models.generateImages({
        model: "imagen-4.0-generate-preview-06-06",
        prompt:data.thumbnail_ai_prompt,
        config:{
            numberOfImages: 4
        }
    })

    if(!res.generatedImages){
        console.log("No image generated");
        return
    }
    let idx=1;
    for(const generatedImage of res.generatedImages){
        if(!generatedImage.image){
            console.log("No image found");
            return
        }
        let imgBytes = generatedImage.image.imageBytes;
        const buffer = Buffer.from(imgBytes!, "base64");
        fs.writeFileSync(`imagen-${idx}.png`, buffer);
        idx++;
    }
}