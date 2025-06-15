import { NextRequest, NextResponse } from 'next/server';
import YtDlpWrap from 'yt-dlp-wrap';

const ytDlpWrap = new YtDlpWrap();

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get('url');
  // Client should ideally pass a clean filename (e.g., from video title)
  const filename = searchParams.get('filename') || 'audio'; // Default filename if not provided

  if (!url) {
    return NextResponse.json({ error: 'URL parameter is missing' }, { status: 400 });
  }

  try {
    const finalFilename = `${decodeURIComponent(filename)}.mp3`;

    const command = [
      url,
      '-x', // Extract audio
      '--audio-format', 'mp3',
      '--audio-quality', '0', // 0 for best quality VBR
      '-o', '-', // Output to stdout
      '--no-warnings',
      '--no-call-home',
      '--no-progress',
      // '--embed-thumbnail', // Consider adding later if desired
    ];

    const ytDlpProcess = ytDlpWrap.exec(command);

    if (!ytDlpProcess.stdout) {
      console.error('Failed to get readable stream from yt-dlp for audio download.');
      return NextResponse.json({ error: 'Failed to get readable stream from yt-dlp.' }, { status: 500 });
    }

    ytDlpProcess.stderr?.on('data', (data: Buffer) => {
      console.error(`yt-dlp stderr (audio): ${data.toString()}`);
    });

    const nodeReadableStream = ytDlpProcess.stdout;
    const stream = new ReadableStream({
      start(controller) {
        nodeReadableStream.on('data', (chunk: Buffer) => controller.enqueue(chunk));
        nodeReadableStream.on('end', () => controller.close());
        nodeReadableStream.on('error', (err: Error) => controller.error(err));
      },
      cancel() {
        console.log('Audio stream cancelled by client');
        nodeReadableStream.destroy();
        if (ytDlpProcess.pid) {
            try {
                process.kill(ytDlpProcess.pid);
            } catch (killError) {
                console.error("Failed to kill yt-dlp process:", killError);
            }
        }
      }
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Disposition': `attachment; filename="${finalFilename}"`,
        'Content-Type': 'audio/mpeg',
      },
    });

  } catch (error: any) {
    console.error('Error downloading audio:', error);
    if (error.stderr) {
        console.error('yt-dlp stderr during audio exec setup:', error.stderr.toString());
        return NextResponse.json({ error: 'Failed to start audio download process.', details: error.stderr.toString() }, { status: 500 });
    }
    return NextResponse.json({ error: 'Failed to download audio', details: error.message }, { status: 500 });
  }
}
