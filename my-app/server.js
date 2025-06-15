const express = require('express');
const next = require('next');
const { createServer } = require('http');
const YtDlpWrap = require('yt-dlp-wrap').default;

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const ytDlpWrap = new YtDlpWrap();

function sanitizeFilename(filename) {
    if (!filename) return "download";
    // Replace characters that are illegal in Windows filenames, and also / for Linux/Mac
    return filename
        .replace(/[<>:"/\\|?*]/g, '_') 
        .replace(/\s+/g, ' ') // Collapse consecutive whitespace
        .trim();
}

app.prepare().then(() => {
    const server = express();

    server.get('/api/yt-dlp/download-audio', async (req, res) => {
        const { url } = req.query;
        if (!url || typeof url !== 'string') {
            return res.status(400).json({ success: false, error: 'A valid video URL is required.' });
        }

        console.log(`[API] Received request for URL: ${url}`);

        let videoTitle = 'audio_download';
        try {
            const metadata = await ytDlpWrap.getVideoInfo(url);
            videoTitle = metadata.title || videoTitle;
            console.log(`[API] Fetched video title: ${videoTitle}`);
        } catch (e) {
            console.error('[API] Failed to fetch video title, using default.', e.message);
        }

        const sanitizedTitle = sanitizeFilename(videoTitle);
        const finalFilename = `${sanitizedTitle}.mp3`;

        try {
            const args = [
                url,
                '-x', // Extract audio
                '--audio-format', 'mp3',
                '--audio-quality', '0', // Best quality
                '-o', '-', // Pipe to stdout
                '--no-playlist',
            ];

            console.log(`[yt-dlp] Executing with args: ${args.join(' ')}`);
            const ytDlpProcess = ytDlpWrap.exec(args);

            console.log(`[yt-dlp] Spawned process with PID: ${ytDlpProcess.pid}`);

            res.setHeader('Content-Type', 'audio/mpeg');
            res.setHeader(
                'Content-Disposition',
                `attachment; filename="${encodeURIComponent(finalFilename)}"`
            );
            res.setHeader('Connection', 'keep-alive');

            // Pipe the audio data directly to the user
            ytDlpProcess.stdout.pipe(res);

            ytDlpProcess.stderr.on('data', (data) => {
                console.error(`[yt-dlp-stderr]: ${data.toString()}`);
            });

            req.on('close', () => {
                console.log('[API] Client disconnected. Terminating yt-dlp process.');
                ytDlpProcess.kill();
            });

            ytDlpProcess.on('error', (err) => {
                console.error('[yt-dlp] Failed to start process:', err);
                if (!res.headersSent) {
                    res.status(500).json({ success: false, error: 'Failed to start download process.' });
                }
                res.end();
            });

            ytDlpProcess.on('exit', (code) => {
                console.log(`[yt-dlp] Process exited with code ${code}.`);
                res.end();
            });

        } catch (error) {
            console.error('[API] A critical error occurred in the download endpoint:', error);
            if (!res.headersSent) {
                res.status(500).json({ success: false, error: 'An internal server error occurred.' });
            }
        }
    });

    // Let Next.js handle all other routes
    server.all('*', (req, res) => {
        return handle(req, res);
    });

    const port = process.env.PORT || 3000;
    const httpServer = createServer(server);
    
    // Set a long timeout for inactive sockets
    httpServer.setTimeout(600000); // 10 minutes

    httpServer.listen(port, (err) => {
        if (err) {
            console.error('[SERVER-FATAL] Failed to start server:', err);
            throw err;
        };
        console.log(`> Ready on http://localhost:${port}`);
    });

}).catch((ex) => {
    console.error('[APP-FATAL] An error occurred during app preparation:', ex.stack);
    process.exit(1);
});