# Video Background Setup Guide

## Vercel Deployment Considerations

Vercel has **file size limits** for static assets:
- **Free tier**: 100MB total deployment size
- **Pro tier**: 1GB total deployment size
- Large videos can easily exceed these limits

## Options for Hosting Your Video

### Option 1: Google Drive (Free, Easy)
1. Upload your video to Google Drive
2. Right-click → "Get link" → Set to "Anyone with the link"
3. Get the direct download link:
   - Replace `file/d/FILE_ID` with `uc?id=FILE_ID&export=download`
   - Or use: `https://drive.google.com/uc?export=download&id=FILE_ID`

**Example:**
```tsx
<BackgroundVideo videoSrc="https://drive.google.com/uc?export=download&id=YOUR_FILE_ID" />
```

### Option 2: Cloudinary (Recommended for Production)
- Free tier: 25GB storage, 25GB bandwidth/month
- Automatic video optimization
- CDN delivery

### Option 3: Vercel Blob Storage
- Integrated with Vercel
- Good for Vercel deployments
- Pay-as-you-go pricing

### Option 4: YouTube (Free, but requires embed)
- Use YouTube embed iframe
- Not ideal for background videos (autoplay restrictions)

### Option 5: Small Videos (< 50MB)
- Can stay in `public/` folder
- Works fine for small, optimized videos

## Using Environment Variables

For production, use environment variables:

1. Create `.env.local`:
```
NEXT_PUBLIC_VIDEO_URL=https://drive.google.com/uc?export=download&id=YOUR_FILE_ID
```

2. Update `layout.tsx` to use it:
```tsx
<BackgroundVideo videoSrc={process.env.NEXT_PUBLIC_VIDEO_URL || "/background-video.mp4"} />
```

## Video Optimization Tips

- Use MP4 format (H.264 codec)
- Compress video: Aim for 5-10MB for web
- Resolution: 1080p or 720p is usually sufficient
- Frame rate: 24-30fps
- Tools: HandBrake, FFmpeg, or online compressors

