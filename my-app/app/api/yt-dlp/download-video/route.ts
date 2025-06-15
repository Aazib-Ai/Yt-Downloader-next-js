import { NextRequest, NextResponse } from 'next/server';
import YtDlpWrap from 'yt-dlp-wrap';
import { Writable } from 'stream';

const ytDlpWrap = new YtDlpWrap();

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get('url');
  const formatId = searchParams.get('formatId');
  const filename = searchParams.get('filename') || 'video'; // Default filename if not provided
  const ext = searchParams.get('ext') || 'mp4'; // Default extension if not provided

  if (!url) {
    return NextResponse.json({ error: 'URL parameter is missing' }, { status: 400 });
  }
  if (!formatId) {
    return NextResponse.json({ error: 'formatId parameter is missing' }, { status: 400 });
  }

  try {
    const finalFilename = `${decodeURIComponent(filename)}.${ext}`;

    // Command to stream the video data to stdout
    // Using '-o', '-' to pipe to stdout.
    const ytDlpProcess = ytDlpWrap.exec([
      url,
      '-f',
      formatId,
      '-o',
      '-', // Output to stdout
      '--no-warnings', // Optional: reduce stderr noise
      '--no-call-home', // Optional: disable phone home
      '--no-progress', // Optional: disable progress bar in stderr
    ]);

    if (!ytDlpProcess.stdout) {
      return NextResponse.json({ error: 'Failed to get readable stream from yt-dlp.' }, { status: 500 });
    }

    // Ensure errors from yt-dlp process are caught and logged
    ytDlpProcess.stderr?.on('data', (data: Buffer) => {
      console.error(`yt-dlp stderr: ${data.toString()}`);
    });

    // Create a ReadableStream for the Next.js Response
    const nodeReadableStream = ytDlpProcess.stdout;
    const stream = new ReadableStream({
      start(controller) {
        nodeReadableStream.on('data', (chunk: Buffer) => controller.enqueue(chunk));
        nodeReadableStream.on('end', () => controller.close());
        nodeReadableStream.on('error', (err: Error) => controller.error(err));
      },
      cancel() {
        console.log('Stream cancelled by client');
        nodeReadableStream.destroy();
        if (ytDlpProcess.pid) {
            process.kill(ytDlpProcess.pid);
        }
      }
    });

    // Determine Content-Type based on extension
    let contentType = 'application/octet-stream'; // Default
    if (ext === 'mp4') contentType = 'video/mp4';
    else if (ext === 'webm') contentType = 'video/webm';
    else if (ext === 'm4a') contentType = 'audio/mp4';
    else if (ext === 'mp3') contentType = 'audio/mpeg';
    // Add more mimetypes as needed

    return new NextResponse(stream, {
      headers: {
        'Content-Disposition': `attachment; filename="${finalFilename}"`,
        'Content-Type': contentType,
      },
    });

  } catch (error: any) {
    console.error('Error downloading video:', error);
    // Check if the error is from ytDlpProcess itself (e.g., command execution failed)
    if (error.stderr) {
        console.error('yt-dlp stderr during exec setup:', error.stderr.toString());
        return NextResponse.json({ error: 'Failed to start download process.', details: error.stderr.toString() }, { status: 500 });
    }
    return NextResponse.json({ error: 'Failed to download video', details: error.message }, { status: 500 });
  }
}
