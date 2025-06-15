import { NextRequest, NextResponse } from 'next/server';
import YtDlpWrap from 'yt-dlp-wrap';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const ytDlpWrap = new YtDlpWrap();

// Set a longer timeout for the API route
export const maxDuration = 600; // 10 minutes in seconds

// Sanitize filename to remove problematic characters
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9_\-.]/g, '_')
    .replace(/_{2,}/g, '_')
    .trim();
}

export async function GET(request: NextRequest) {
  console.log('Starting download request...');
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get('url');

  if (!url) {
    console.error('No URL provided');
    return NextResponse.json({ error: 'URL parameter is missing' }, { status: 400 });
  }

  console.log('Processing URL:', url);

  try {
    // Step 1: Get video title
    let videoTitle: string;
    try {
      console.log('Fetching video title...');
      const { stdout } = await execAsync(`yt-dlp --get-title "${url}"`);
      videoTitle = stdout.trim();
      console.log('Successfully retrieved video title:', videoTitle);
    } catch (error) {
      console.error('Error getting video title:', error);
      videoTitle = 'audio';
    }

    // Step 2: Sanitize title and create filename
    const sanitizedTitle = sanitizeFilename(videoTitle);
    const finalFilename = `${sanitizedTitle}.mp3`;
    console.log('Created sanitized filename:', finalFilename);

    const command = [
      url,
      '-x', // Extract audio
      '--audio-format', 'mp3',
      '--audio-quality', '0', // 0 for best quality VBR
      '-o', '-', // Output to stdout
      '--no-warnings',
      '--no-call-home',
      '--no-progress',
      '--verbose',
      '--no-playlist',
      '--extract-audio',
      '--prefer-ffmpeg',
      '--no-check-certificate',
      '--socket-timeout', '300', // 5 minutes socket timeout
    ];

    console.log('Executing yt-dlp with command:', command.join(' '));

    const ytDlpProcess = ytDlpWrap.exec(command) as unknown as {
      stdout: NodeJS.ReadableStream & { destroy(): void };
      stderr: NodeJS.ReadableStream;
      pid: number;
    };

    if (!ytDlpProcess.stdout) {
      console.error('Failed to get readable stream from yt-dlp');
      return NextResponse.json({ error: 'Failed to get readable stream from yt-dlp.' }, { status: 500 });
    }

    console.log('yt-dlp process started with PID:', ytDlpProcess.pid);

    let errorOutput = '';
    let hasError = false;
    let isDownloadComplete = false;
    let lastActivity = Date.now();

    // Keep-alive mechanism
    const keepAliveInterval = setInterval(() => {
      const now = Date.now();
      if (now - lastActivity > 300000) { // 5 minutes
        console.log('No activity for 5 minutes, checking process...');
        if (ytDlpProcess.pid) {
          try {
            process.kill(ytDlpProcess.pid, 0); // Check if process is still running
          } catch (e) {
            console.error('Process is not responding, cleaning up...');
            clearInterval(keepAliveInterval);
            if (ytDlpProcess.pid) {
              process.kill(ytDlpProcess.pid);
            }
          }
        }
      }
    }, 60000); // Check every minute

    ytDlpProcess.stderr?.on('data', (data: Buffer) => {
      lastActivity = Date.now();
      const errorMessage = data.toString();
      errorOutput += errorMessage;
      console.log(`yt-dlp output: ${errorMessage}`);
      
      if (errorMessage.includes('ERROR') || errorMessage.includes('Error')) {
        console.error('Error detected in yt-dlp output:', errorMessage);
        hasError = true;
      }

      if (errorMessage.includes('Destination:')) {
        console.log('Download completion detected');
        isDownloadComplete = true;
      }
    });

    ytDlpProcess.stderr?.on('error', (error: Error) => {
      console.error('yt-dlp process error:', error);
      hasError = true;
    });

    const nodeReadableStream = ytDlpProcess.stdout;
    let streamError: unknown = null;
    let bytesReceived = 0;
    let isStreamEnded = false;

    const stream = new ReadableStream({
      start(controller) {
        console.log('Starting stream processing...');
        nodeReadableStream.on('data', (chunk: Buffer) => {
          try {
            lastActivity = Date.now();
            bytesReceived += chunk.length;
            if (bytesReceived % 1024 * 1024 === 0) { // Log every MB
              console.log(`Received ${Math.round(bytesReceived / 1024 / 1024)}MB so far`);
            }
            controller.enqueue(chunk);
          } catch (error) {
            console.error('Error processing chunk:', error);
            streamError = error;
            controller.error(error);
          }
        });

        nodeReadableStream.on('end', () => {
          console.log('Stream ended successfully');
          isStreamEnded = true;
          clearInterval(keepAliveInterval);
          if (!hasError && isDownloadComplete) {
            console.log('Closing stream controller');
            controller.close();
          } else {
            console.error('Stream ended with errors or incomplete download');
            controller.error(new Error('Download failed: ' + errorOutput));
          }
        });

        nodeReadableStream.on('error', (err: Error) => {
          console.error('Stream error:', err);
          streamError = err;
          clearInterval(keepAliveInterval);
          controller.error(err);
        });
      },
      cancel() {
        console.log('Stream cancelled by client');
        clearInterval(keepAliveInterval);
        try {
          if (!isStreamEnded && !isDownloadComplete) {
            console.log('Cleaning up incomplete download...');
            nodeReadableStream.destroy();
            if (ytDlpProcess.pid) {
              process.kill(ytDlpProcess.pid);
            }
          }
        } catch (error) {
          console.error('Error during stream cancellation:', error);
        }
      }
    });

    if (hasError) {
      console.error('Download failed with errors:', errorOutput);
      clearInterval(keepAliveInterval);
      return NextResponse.json({ 
        error: 'Download failed', 
        details: errorOutput 
      }, { status: 500 });
    }

    if (streamError) {
      console.error('Stream error occurred:', streamError);
      clearInterval(keepAliveInterval);
      return NextResponse.json({ 
        error: 'Stream error', 
        details: streamError instanceof Error ? streamError.message : String(streamError)
      }, { status: 500 });
    }

    console.log('Sending response with stream...');
    return new NextResponse(stream, {
      headers: {
        'Content-Disposition': `attachment; filename="${encodeURIComponent(finalFilename)}"; filename*=UTF-8''${encodeURIComponent(finalFilename)}`,
        'Content-Type': 'audio/mpeg',
        'Transfer-Encoding': 'chunked',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    console.error('Error in download process:', error);
    if (error.stderr) {
      console.error('yt-dlp stderr during setup:', error.stderr.toString());
      return NextResponse.json({ 
        error: 'Failed to start download process', 
        details: error.stderr.toString() 
      }, { status: 500 });
    }
    return NextResponse.json({ 
      error: 'Download failed', 
      details: error.message 
    }, { status: 500 });
  }
}
