# Fazri Stream

## AI-Powered Video Content Management Platform

A modern, full-stack application that transforms video content creation with AI-powered transcription, captioning, thumbnail generation, and seamless YouTube integration.

## ✨ Features

### 🎥 **Video Processing**

- **Drag & Drop Upload**: Intuitive file upload with progress tracking
- **AI Transcription**: Powered by Deepgram for accurate speech-to-text
- **Auto Captions**: Generate WebVTT and SRT caption files
- **Smart Screenshot Extraction**: Automatically extracts key frames for analysis

### 🤖 **AI-Powered Content Generation**

- **Smart Titles**: AI generates multiple SEO-optimized title options
- **Content Analysis**: Multi-modal analysis combining video frames and transcripts
- **Thumbnail Concepts**: AI-designed thumbnail layouts and concepts
- **AI Image Generation**: Automatic thumbnail creation using Google's Imagen
- **Viral Content Strategy**: Optimized for platform algorithms and engagement

### 📺 **YouTube Integration**

- **OAuth Authentication**: Secure YouTube account linking
- **Direct Upload**: Upload videos directly to YouTube from the platform
- **Metadata Sync**: Automatic title, description, and thumbnail upload
- **Privacy Controls**: Configurable video privacy settings

### 🔐 **Enterprise Authentication**

- **Email OTP**: Passwordless authentication system
- **Two-Factor Authentication**: TOTP support with backup codes
- **Google OAuth**: Social login integration
- **Session Management**: Secure JWT-based sessions

### 📊 **Modern Dashboard**

- **Video Library**: Organized content management
- **Processing Pipeline**: Real-time status tracking
- **Analytics Ready**: Built for future analytics integration
- **Responsive Design**: Mobile-first approach

## 🛠️ Tech Stack

### **Frontend**

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS 4** - Modern utility-first styling
- **Framer Motion** - Smooth animations and transitions
- **Radix UI** - Accessible component primitives
- **shadcn/ui** - Beautiful component library

### **Backend**

- **Next.js API Routes** - Serverless API endpoints
- **NextAuth.js** - Authentication framework
- **Prisma** - Type-safe database ORM
- **PostgreSQL** - Reliable relational database

### **AI & Processing**

- **Google Gemini 2.0** - Advanced AI content analysis
- **Google Imagen 4.0** - AI image generation
- **Deepgram Nova** - Speech recognition and captioning
- **Three.js** - 3D graphics and animations

### **Cloud Infrastructure**

- **AWS S3** - File storage and CDN
- **Vercel** - Deployment and hosting
- **YouTube Data API v3** - Video platform integration

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- PostgreSQL database
- AWS S3 bucket
- Google Cloud account (for AI services)
- YouTube Data API credentials

### Environment Setup

Create a `.env.local` file:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/fazri-stream"

# NextAuth
NEXTAUTH_SECRET="your-nextauth-secret"
NEXTAUTH_URL="http://localhost:3000"

# OAuth Providers
AUTH_GOOGLE_ID="your-google-client-id"
AUTH_GOOGLE_SECRET="your-google-client-secret"

# AWS S3
AWS_ACCESS_KEY_ID="your-aws-access-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret-key"
AWS_S3_BUCKET_NAME="your-s3-bucket"
AWS_REGION="us-east-1"

# AI Services
GEMINI_KEY="your-google-gemini-api-key"
DEEPGRAM_API_KEY="your-deepgram-api-key"

# YouTube API
GOOGLE_CLIENT_ID="your-youtube-client-id"
GOOGLE_CLIENT_SECRET="your-youtube-client-secret"

# Email Service
EMAIL_SERVER_HOST="smtp.gmail.com"
EMAIL_SERVER_PORT="587"
EMAIL_SERVER_USER="your-email@gmail.com"
EMAIL_SERVER_PASSWORD="your-app-password"
EMAIL_FROM="your-email@gmail.com"

# Encryption
ENCRYPTION_KEY="your-32-character-encryption-key"
```

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-username/fazri-stream.git
   cd fazri-stream
   ```

2. **Install dependencies**

   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. **Set up the database**

   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. **Start the development server**

   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Authentication pages
│   ├── api/               # API routes
│   ├── dashboard/         # Main application
│   └── globals.css        # Global styles
├── components/            # Reusable UI components
│   ├── ui/               # shadcn/ui components
│   └── video-upload-genai.tsx
├── lib/                   # Utility functions
│   ├── prisma.ts         # Database client
│   ├── utils.ts          # Common utilities
│   └── youtube-oauth.ts   # YouTube integration
├── genai/                 # AI service utilities
├── hooks/                 # Custom React hooks
└── types/                 # TypeScript definitions
```

## 🔧 Configuration

### Database Schema

The application uses Prisma with PostgreSQL. Key models include:

- **User**: Authentication and profile data
- **VideoFile**: Video metadata and processing status
- **Transcript/Subtitles**: AI-generated content
- **YouTubeIntegration**: Platform connections

### AI Services Setup

1. **Google Cloud**: Enable Gemini and Imagen APIs
2. **Deepgram**: Create account and get API key
3. **YouTube Data API**: Set up OAuth credentials

### AWS S3 Configuration

1. Create S3 bucket with appropriate CORS settings
2. Set up IAM user with S3 permissions
3. Configure bucket for file uploads

## 🚢 Deployment

### Vercel Deployment

1. **Connect GitHub repository**
2. **Configure environment variables**
3. **Deploy with automatic CI/CD**

```bash
npm run build
npm run start
```

### Database Migration

```bash
npx prisma migrate deploy
```

## 📖 API Documentation

### Video Upload Flow

1. **POST** `/api/upload` - Get presigned S3 URL
2. **PUT** `{presigned-url}` - Upload file to S3
3. **POST** `/api/transcribe` - Process transcription
4. **POST** `/api/captions` - Generate captions
5. **POST** `/api/analyze-video` - AI content analysis

### Authentication Endpoints

- **POST** `/api/check-user` - Verify user existence
- **POST** `/api/2fa/setup` - Initialize 2FA
- **POST** `/api/2fa/verify-setup` - Confirm 2FA setup

### YouTube Integration

- **GET** `/api/youtube/connect` - Get OAuth URL
- **POST** `/api/youtube/upload` - Upload to YouTube
- **GET** `/api/youtube/status` - Check connection status

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Code Style

- **ESLint**: Automatic code linting
- **Prettier**: Code formatting
- **TypeScript**: Strict type checking
- **Conventional Commits**: Structured commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Deepgram** for speech recognition technology
- **Google AI** for Gemini and Imagen services
- **Vercel** for hosting and deployment
- **shadcn/ui** for beautiful components
- **Open source community** for amazing tools and libraries

## 📞 Support

- 📧 Email: [support@rdpdatacenter.in](mailto:support@rdpdatacenter.in)
- 🌐 Website: [rdpdatacenter.in](https://rdpdatacenter.in)
- 🐛 Issues: [GitHub Issues](https://github.com/your-username/fazri-stream/issues)

---

**Built with ❤️ by RDP Datacenter Team**
