"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button"; // If needed for future individual download buttons
import { VideoDetails } from "./VideoDisplay"; // Re-use this type if structure is similar
import { PlayIcon } from "lucide-react";

// Simplified video item for playlist display
export interface PlaylistItemVideo {
  id?: string; // YouTube video ID, if available
  title: string;
  thumbnail: string;
  // Add other relevant fields if needed, e.g., duration
}

export interface PlaylistDetails {
  title: string;
  thumbnail?: string; // Playlist's own thumbnail
  videos: PlaylistItemVideo[];
}

interface PlaylistDisplayProps {
  playlist: PlaylistDetails;
  onVideoSelect: (video: PlaylistItemVideo) => void; // Callback when a video is selected
  // onDownloadAll?: () => void; // Optional: For downloading all videos in playlist
}

export default function PlaylistDisplay({ playlist, onVideoSelect }: PlaylistDisplayProps) {
  return (
    <div className="bg-card p-4 sm:p-6 rounded-lg shadow-lg w-full max-w-xl border border-border">
      <div className="flex flex-col sm:flex-row items-center mb-4 sm:mb-6">
        {playlist.thumbnail && (
          <div className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-md overflow-hidden mb-4 sm:mb-0 sm:mr-6 flex-shrink-0">
            <Image
              src={playlist.thumbnail}
              alt={playlist.title}
              layout="fill"
              objectFit="cover"
              unoptimized // External images
            />
          </div>
        )}
        <div>
          <h2 className="text-2xl sm:text-3xl font-semibold mb-1 text-card-foreground break-words">
            {playlist.title}
          </h2>
          <p className="text-sm text-muted-foreground">
            {playlist.videos.length} video{playlist.videos.length === 1 ? "" : "s"}
          </p>
          {/* Future: Add "Download All" button here if implementing */}
          {/*
          {onDownloadAll && (
            <Button onClick={onDownloadAll} className="mt-2">
              Download All (MP4)
            </Button>
          )}
          */}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-medium text-muted-foreground mb-2">Videos in this playlist:</h3>
        {playlist.videos.map((video, index) => (
          <div
            key={video.id || index} // Use video.id if available and unique, otherwise index
            className="flex items-center space-x-3 p-3 rounded-md hover:bg-muted/50 cursor-pointer border-b border-border last:border-b-0"
            onClick={() => onVideoSelect(video)}
            tabIndex={0}
            onKeyPress={(e) => e.key === 'Enter' && onVideoSelect(video)}
            role="button"
            aria-label={`Play or select ${video.title}`}
          >
            <div className="relative w-20 h-12 sm:w-24 sm:h-14 rounded overflow-hidden flex-shrink-0">
              {video.thumbnail && (
                <Image
                  src={video.thumbnail}
                  alt={video.title}
                  layout="fill"
                  objectFit="cover"
                  unoptimized
                />
              )}
              <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center">
                <PlayIcon className="w-6 h-6 text-white opacity-75" />
              </div>
            </div>
            <p className="text-sm font-medium text-card-foreground flex-grow break-words">
              {video.title}
            </p>
            {/*
              Future: Add individual download buttons per video if desired.
              For now, clicking the item selects it for the main VideoDisplay.
            */}
          </div>
        ))}
      </div>
    </div>
  );
}
