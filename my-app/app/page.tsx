"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import VideoDisplay, { VideoDetails, VideoFormat } from "@/components/custom/VideoDisplay";
import PlaylistDisplay, { PlaylistDetails, PlaylistItemVideo } from "@/components/custom/PlaylistDisplay";
import { Loader2, AlertCircle, YoutubeIcon, DownloadCloudIcon, CheckCircleIcon, LockIcon } from "lucide-react"; // Added LockIcon

// Keywords that suggest a video/playlist is private, members-only, or requires login
const PRIVACY_RELATED_KEYWORDS = [
  "private video",
  "private playlist",
  "members only",
  "login required",
  "authentication needed",
  "unavailable video",
  "video is unavailable",
  "this video is private",
  "this playlist is private",
  "sign in to view",
  "confirm your age",
  "age-restricted",
  "verification required",
  "copyright", // Copyright takedowns also make videos unavailable
  "geoblocked", "not available in your country", // Geoblocking
  "premium content"
];

function isPrivacyOrAuthError(errorMessage: string, errorDetails?: string): boolean {
  const combinedMessage = `${errorMessage.toLowerCase()} ${errorDetails ? errorDetails.toLowerCase() : ''}`;
  return PRIVACY_RELATED_KEYWORDS.some(keyword => combinedMessage.includes(keyword));
}


export default function HomePage() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingIndividualVideo, setIsFetchingIndividualVideo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPrivacyError, setIsPrivacyError] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null);

  const [fetchedData, setFetchedData] = useState<VideoDetails | PlaylistDetails | null>(null);
  const [currentVideoForDisplay, setCurrentVideoForDisplay] = useState<VideoDetails | null>(null);
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);


  const displayTemporaryMessage = (setter: React.Dispatch<React.SetStateAction<string | null>>, message: string, duration: number = 4000, isError: boolean = false) => {
    if (isError) setError(message);
    else setDownloadMessage(message);

    setTimeout(() => {
      if (isError) setError(null);
      else setDownloadMessage(null);
    }, duration);
  };

  const processFetchError = (err: any) => {
    console.error("Fetch error object:", err);
    const errorMessage = err.message || "An unknown error occurred.";
    // err.details might come from our backend's structured error { error: ..., details: ... }
    // If err.details is not present, err.message (from new Error(errorData.error)) might contain the backend error string.
    const errorDetails = typeof err.details === 'string' ? err.details : '';

    if (isPrivacyOrAuthError(errorMessage, errorDetails)) {
      setError("This video or playlist may be private, members-only, require login, or be otherwise restricted. Downloading such content is not supported.");
      setIsPrivacyError(true);
    } else {
      setError(`Failed to fetch information. ${errorMessage}`);
      setIsPrivacyError(false);
    }
  };

  const handleFetchClick = async () => {
    if (!url.trim()) {
      setError("Please enter a YouTube URL.");
      setIsPrivacyError(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    setIsPrivacyError(false);
    setDownloadMessage(null);
    setFetchedData(null);
    setCurrentVideoForDisplay(null);
    setActiveVideoUrl(null);

    try {
      const response = await fetch(`/api/yt-dlp/metadata?url=${encodeURIComponent(url)}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText, details: "" }));
        // Pass details to the Error constructor if available
        const err = new Error(errorData.error || `Request failed with status ${response.status}`);
        (err as any).details = errorData.details; // Attach details to the error object
        throw err;
      }
      const data = await response.json();

      setFetchedData(data);

      if (data && data.resolutions) {
        setCurrentVideoForDisplay(data as VideoDetails);
        setActiveVideoUrl(url);
      } else if (data && data.videos) {
        setActiveVideoUrl(null);
      } else {
        const err = new Error("Unrecognized data structure from API.");
        (err as any).details = JSON.stringify(data);
        throw err;
      }

    } catch (err: any) {
      processFetchError(err);
      setFetchedData(null);
      setCurrentVideoForDisplay(null);
      setActiveVideoUrl(null);
    } finally {
      setIsLoading(false);
    }
  };

  const triggerDownload = (downloadUrl: string, filename: string) => {
    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    displayTemporaryMessage(setDownloadMessage, `Download started: ${filename}`);
  };

  const handleDownloadVideo = (formatId: string, filename: string, ext: string) => {
    if (!activeVideoUrl) {
      displayTemporaryMessage(setError, "No active video URL found for download. Please select a video.", 4000, true);
      setIsPrivacyError(false);
      return;
    }
    if (!formatId) {
      displayTemporaryMessage(setError, "No video format selected.", 4000, true);
      setIsPrivacyError(false);
      return;
    }
    if (!currentVideoForDisplay || !currentVideoForDisplay.resolutions) {
        displayTemporaryMessage(setError, "Video details or resolutions not available.", 4000, true);
        setIsPrivacyError(false);
        return;
    }

    const selectedFormat = currentVideoForDisplay.resolutions.find(f => f.format_id === formatId);
    if (!selectedFormat) {
        displayTemporaryMessage(setError, "Selected format details not found.", 4000, true);
        setIsPrivacyError(false);
        return;
    }

    const actualExt = selectedFormat.ext || ext || 'mp4';
    const cleanFilename = `${filename.replace(/[<>:"/\\|?*]+/g, '_')}.${actualExt}`;

    const downloadUrl = `/api/yt-dlp/download-video?url=${encodeURIComponent(activeVideoUrl)}&formatId=${formatId}&filename=${encodeURIComponent(filename)}&ext=${actualExt}`;
    triggerDownload(downloadUrl, cleanFilename);
  };

  const handleDownloadAudio = (filename: string, ext: string = "mp3") => {
    if (!activeVideoUrl) {
      displayTemporaryMessage(setError, "No active video URL found for audio download. Please select a video.", 4000, true);
      setIsPrivacyError(false);
      return;
    }
     if (!currentVideoForDisplay) {
        displayTemporaryMessage(setError, "Video details not available for audio download.", 4000, true);
        setIsPrivacyError(false);
        return;
    }

    const cleanFilename = `${filename.replace(/[<>:"/\\|?*]+/g, '_')}.${ext}`;
    const downloadUrl = `/api/yt-dlp/download-audio?url=${encodeURIComponent(activeVideoUrl)}&filename=${encodeURIComponent(filename)}&ext=${ext}`;
    triggerDownload(downloadUrl, cleanFilename);
  };

  const handlePlaylistVideoSelect = async (playlistItem: PlaylistItemVideo) => {
    if (!playlistItem.id) {
      displayTemporaryMessage(setError, "Video ID is missing for the selected playlist item.", 4000, true);
      setIsPrivacyError(false);
      return;
    }
    const videoUrl = `https://www.youtube.com/watch?v=${playlistItem.id}`;

    setIsFetchingIndividualVideo(true);
    setError(null);
    setIsPrivacyError(false);
    setDownloadMessage(null);

    try {
      const response = await fetch(`/api/yt-dlp/metadata?url=${encodeURIComponent(videoUrl)}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText, details: "" }));
        const err = new Error(errorData.error || `Request failed with status ${response.status}`);
        (err as any).details = errorData.details;
        throw err;
      }
      const videoData = await response.json();
      if (videoData && videoData.resolutions) {
        setCurrentVideoForDisplay(videoData as VideoDetails);
        setActiveVideoUrl(videoUrl);
      } else {
        const err = new Error("Fetched data for playlist item is not a valid video structure.");
        (err as any).details = JSON.stringify(videoData);
        throw err;
      }
    } catch (err: any) {
      processFetchError(err);
    } finally {
      setIsFetchingIndividualVideo(false);
    }
  };

  const clearResults = () => {
    setUrl("");
    setIsLoading(false);
    setIsFetchingIndividualVideo(false);
    setError(null);
    setIsPrivacyError(false);
    setDownloadMessage(null);
    setFetchedData(null);
    setCurrentVideoForDisplay(null);
    setActiveVideoUrl(null);
  };

  const isPlaylist = fetchedData && 'videos' in fetchedData && Array.isArray(fetchedData.videos);

  return (
    <div className="flex flex-col items-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-slate-50 p-4 sm:p-6 font-sans">
      <div className="w-full max-w-3xl space-y-8">
        <header className="text-center space-y-2">
          {/* ... header content ... */}
           <div className="inline-flex items-center justify-center">
            <YoutubeIcon className="h-12 w-12 sm:h-16 sm:w-16 text-red-500 mr-3" />
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-pink-500 to-orange-400">
              YouTube Downloader
            </h1>
          </div>
          <p className="text-md sm:text-lg text-slate-400">
            Download videos and audio from YouTube quickly and easily.
          </p>
        </header>

        <main className="space-y-4 bg-slate-800/50 p-6 rounded-xl shadow-2xl border border-slate-700">
          {/* ... main input and button content ... */}
          <div className="flex flex-col sm:flex-row sm:space-x-3 space-y-3 sm:space-y-0">
            <Input
              type="url"
              placeholder="Paste YouTube video or playlist URL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="flex-grow text-base sm:text-lg p-3 bg-slate-700 border-slate-600 text-slate-50 placeholder-slate-400 focus:ring-red-500 focus:border-red-500 rounded-md"
              disabled={isLoading || isFetchingIndividualVideo}
            />
            <Button
              onClick={handleFetchClick}
              className="text-base sm:text-lg p-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-md transition-colors duration-150 ease-in-out flex items-center justify-center"
              disabled={isLoading || isFetchingIndividualVideo || !url.trim()}
            >
              {(isLoading && !isFetchingIndividualVideo) ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <DownloadCloudIcon className="mr-2 h-5 w-5"/>}
              Fetch Details
            </Button>
          </div>
           {(fetchedData || error || downloadMessage) && (
            <Button onClick={clearResults} variant="outline" className="w-full sm:w-auto border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-slate-100 rounded-md">
              Clear Results
            </Button>
          )}
        </main>

        {downloadMessage && !error && (
          <div className="mt-4 flex items-center justify-center bg-green-800/50 text-green-300 p-3 rounded-lg shadow-md border border-green-700">
            <CheckCircleIcon className="h-5 w-5 mr-2" />
            <p>{downloadMessage}</p>
          </div>
        )}
        {error && (
          <div className={`mt-4 flex flex-col items-center justify-center p-4 rounded-lg shadow-md ${isPrivacyError ? 'bg-yellow-900/30 text-yellow-400 border-yellow-700' : 'bg-red-900/30 text-red-400 border-red-700'}`}>
            {isPrivacyError ? <LockIcon className="h-8 w-8 mb-2" /> : <AlertCircle className="h-8 w-8 mb-2" />}
            <p className="text-md font-semibold">
              {isPrivacyError ? "Content Restriction" : "An Error Occurred"}
            </p>
            <p className="text-center text-sm">{error}</p>
          </div>
        )}

        <div id="results-section" className="w-full space-y-6 min-h-[200px]">
          {(isLoading || isFetchingIndividualVideo) && !error && (
            // ... loading indicator ...
            <div className="flex flex-col items-center justify-center text-slate-400 p-10 bg-slate-800/50 rounded-lg shadow-md border border-slate-700">
              <Loader2 className="h-12 w-12 animate-spin mb-4 text-red-500" />
              <p className="text-lg">
                {isFetchingIndividualVideo ? "Loading selected video..." : "Fetching details..."}
              </p>
            </div>
          )}

          <div className="space-y-6">
            {currentVideoForDisplay && !isLoading && !isFetchingIndividualVideo && !error && ( // Added !error here
              // ... VideoDisplay ...
              <section id="video-display-section" className="flex justify-center">
                  <VideoDisplay
                      video={currentVideoForDisplay}
                      onDownloadVideo={handleDownloadVideo}
                      onDownloadAudio={handleDownloadAudio}
                      isDownloadable={!!activeVideoUrl}
                  />
              </section>
            )}

            {isPlaylist && fetchedData && (!currentVideoForDisplay || isFetchingIndividualVideo || (currentVideoForDisplay && !error)) && !isLoading && ( // Adjusted logic slightly
              // ... PlaylistDisplay for main playlist view ...
              <section className="flex justify-center">
                  <PlaylistDisplay
                      playlist={fetchedData as PlaylistDetails}
                      onVideoSelect={handlePlaylistVideoSelect}
                      loadingVideoId={isFetchingIndividualVideo && activeVideoUrl ? activeVideoUrl.split("v=")[1] : undefined}
                  />
              </section>
            )}
            {isPlaylist && fetchedData && currentVideoForDisplay && !isLoading && !isFetchingIndividualVideo && !error && ( // Added !error here
                 // ... PlaylistDisplay for context when a video from it is selected ...
                 <div className="pt-6 border-t border-slate-700 mt-8">
                    <h3 className="text-xl font-semibold text-slate-300 mb-4 text-center">From playlist: <span className="text-red-400">{(fetchedData as PlaylistDetails).title}</span></h3>
                     <section className="flex justify-center">
                        <PlaylistDisplay
                            playlist={fetchedData as PlaylistDetails}
                            onVideoSelect={handlePlaylistVideoSelect}
                            selectedVideoId={activeVideoUrl ? activeVideoUrl.split("v=")[1] : undefined}
                        />
                    </section>
                 </div>
            )}
          </div>
        </div>

        <footer className="text-center text-xs sm:text-sm text-slate-500 pt-8">
          {/* ... footer content ... */}
          <p>
            Ensure you have the rights to download any content. This tool is for personal use only.
          </p>
        </footer>
      </div>
    </div>
  );
}
