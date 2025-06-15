import { NextRequest, NextResponse } from 'next/server';
import YtDlpWrap from 'yt-dlp-wrap';

const ytDlpWrap = new YtDlpWrap();

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL parameter is missing' }, { status: 400 });
  }

  try {
    // Simple check for playlist URL
    const isPlaylist = url.includes('playlist');

    let metadata: any;

    if (isPlaylist) {
      // Fetch playlist info
      // For now, we'll just get basic playlist info. Detailed format extraction might be complex.
      const playlistInfo = await ytDlpWrap.getPlaylistInfo(url);
      metadata = {
        title: playlistInfo.title,
        thumbnail: playlistInfo.thumbnail, // May not be directly available, might need to pick first video's thumbnail
        videos: playlistInfo.videos?.map(video => ({
          title: video.title,
          thumbnail: video.thumbnail,
          // We'd ideally get formats per video, but getPlaylistInfo might not provide that directly.
          // This might require an additional call per video, which could be slow.
          // For simplicity, we'll omit detailed formats for playlist videos for now.
        })) || [],
      };
    } else {
      // Fetch single video info
      const videoInfo = await ytDlpWrap.getVideoInfo(url);
      metadata = {
        title: videoInfo.title,
        thumbnail: videoInfo.thumbnail,
        resolutions: videoInfo.formats
          ?.filter(f => f.vcodec !== 'none' && f.acodec !== 'none')
          .map(f => ({
            format_id: f.format_id,
            resolution: f.resolution || `${f.width}x${f.height}`,
            fps: f.fps,
            url: f.url, // Direct URL if available, useful for some formats
            ext: f.ext,
          }))
          .sort((a, b) => { // Simple sort by height
            const aHeight = parseInt(a.resolution?.split('x')[1] || '0');
            const bHeight = parseInt(b.resolution?.split('x')[1] || '0');
            return bHeight - aHeight;
          }),
        audioOnlyFormats: videoInfo.formats
          ?.filter(f => f.vcodec === 'none' && f.acodec !== 'none')
          .map(f => ({
            format_id: f.format_id,
            abr: f.abr,
            ext: f.ext,
            url: f.url,
          }))
          .sort((a,b) => (b.abr || 0) - (a.abr || 0)), // Sort by bitrate
      };
    }

    return NextResponse.json(metadata);
  } catch (error: any) {
    console.error('Error fetching metadata:', error);
    // yt-dlp-wrap might throw errors with specific messages
    const errorMessage = error.message || 'Failed to fetch metadata';
    // Check for common yt-dlp error patterns if needed
    if (error.stderr) {
        console.error('yt-dlp stderr:', error.stderr);
    }
    return NextResponse.json({ error: errorMessage, details: error.stderr }, { status: 500 });
  }
}
