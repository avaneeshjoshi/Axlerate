# Uploading Video to Supabase Storage

## Step-by-Step Guide

### 1. Access Supabase Dashboard
1. Go to [supabase.com](https://supabase.com) and sign in
2. Select your project (or create a new one)

### 2. Create a Storage Bucket
1. Navigate to **Storage** in the left sidebar
2. Click **New bucket**
3. Name it (e.g., `videos` or `assets`)
4. Set it to **Public** (important for direct video access)
5. Click **Create bucket**

### 3. Upload Your Video
1. Click on your newly created bucket
2. Click **Upload file** or drag and drop your video
3. Select your video file (MP4 recommended)
4. Wait for upload to complete

### 4. Get the Public URL
1. Click on your uploaded video file
2. Copy the **Public URL** - it will look like:
   ```
   https://[project-id].supabase.co/storage/v1/object/public/[bucket-name]/[filename].mp4
   ```
   
   Example:
   ```
   https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/videos/hero-background.mp4
   ```

### 5. Use the URL in Your App

**Option A: Environment Variable (Recommended)**
1. Create or edit `.env.local` in the `frontend/` directory:
   ```
   NEXT_PUBLIC_VIDEO_URL=https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/videos/your-video.mp4
   ```
2. The hero component will automatically use this URL

**Option B: Direct Update**
- Update the `src` in `app/components/hero.tsx` directly

## Video Optimization Tips

- **Format**: MP4 (H.264 codec) works best
- **Size**: Compress large videos (aim for 5-20MB for web)
- **Resolution**: 1080p or 720p is usually sufficient
- **Duration**: Shorter loops (10-30 seconds) work better
- **Tools**: Use HandBrake, FFmpeg, or online compressors

## Troubleshooting

- **Video not playing?** Make sure the bucket is set to **Public**
- **CORS errors?** Supabase public buckets should work, but check browser console
- **Large file?** Consider compressing or using a CDN

