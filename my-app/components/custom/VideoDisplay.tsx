"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { DownloadIcon, MusicIcon } from "lucide-react"; // Assuming lucide-react is available

// Define a more specific type for video format/resolution
export interface VideoFormat {
  format_id: string;
  resolution?: string; // For video
  fps?: number;
  ext: string;
  url?: string; // May not always be present or needed by client
  abr?: number; // For audio
}

export interface VideoDetails {
  title: string;
  thumbnail: string;
  resolutions?: VideoFormat[];
  audioOnlyFormats?: VideoFormat[];
}

interface VideoDisplayProps {
  video: VideoDetails;
  onDownloadVideo: (formatId: string, filename: string, ext: string) => void;
  onDownloadAudio: (filename: string, ext: string) => void; // Assuming MP3 download doesn't need formatId from UI
}

export default function VideoDisplay({ video, onDownloadVideo, onDownloadAudio }: VideoDisplayProps) {
  const [selectedFormat, setSelectedFormat] = useState<string | undefined>(
    video.resolutions && video.resolutions.length > 0 ? video.resolutions[0].format_id : undefined
  );

  const handleDownloadVideo = () => {
    if (selectedFormat) {
      const format = video.resolutions?.find(f => f.format_id === selectedFormat);
      if (format) {
        onDownloadVideo(selectedFormat, video.title, format.ext);
      } else {
        console.error("Selected format not found for video download.");
        // Optionally, inform the user via an alert or toast
      }
    } else {
      console.error("No format selected for video download.");
      // Optionally, inform the user
    }
  };

  const handleDownloadAudio = () => {
    onDownloadAudio(video.title, "mp3");
  };

  // Ensure resolutions exist and have at least one entry before trying to access them
  const defaultSelectValue = video.resolutions && video.resolutions.length > 0 && video.resolutions[0].format_id
    ? video.resolutions[0].format_id
    : undefined;


  return (
    <div className="bg-card p-4 sm:p-6 rounded-lg shadow-lg w-full max-w-lg border border-border">
      <div className="relative w-full aspect-video rounded-md overflow-hidden mb-4">
        {video.thumbnail && (
          <Image
            src={video.thumbnail}
            alt={video.title}
            layout="fill"
            objectFit="cover"
            unoptimized // Since these are external images
          />
        )}
      </div>
      <h2 className="text-xl sm:text-2xl font-semibold mb-3 text-card-foreground break-words">
        {video.title}
      </h2>

      {video.resolutions && video.resolutions.length > 0 && (
        <div className="space-y-3 mb-4">
          <label htmlFor="resolution-select" className="block text-sm font-medium text-muted-foreground">
            Choose video quality:
          </label>
          <div className="flex space-x-2">
            <Select
              value={selectedFormat}
              onValueChange={setSelectedFormat}
              defaultValue={defaultSelectValue}
            >
              <SelectTrigger id="resolution-select" className="flex-grow">
                <SelectValue placeholder="Select resolution" />
              </SelectTrigger>
              <SelectContent>
                {video.resolutions.map((format) => (
                  <SelectItem key={format.format_id} value={format.format_id}>
                    {format.resolution || "Unknown resolution"} ({format.ext}, {format.fps ? `${format.fps}fps` : 'N/A fps'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleDownloadVideo}
              disabled={!selectedFormat}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              aria-label="Download video"
            >
              <DownloadIcon className="mr-2 h-5 w-5" /> Download Video
            </Button>
          </div>
        </div>
      )}

      {video.audioOnlyFormats && video.audioOnlyFormats.length > 0 && (
         <Button
            onClick={handleDownloadAudio}
            className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground"
            aria-label="Download MP3 audio"
          >
            <MusicIcon className="mr-2 h-5 w-5" /> Download MP3
        </Button>
      )}
       {!video.resolutions?.length && !video.audioOnlyFormats?.length && (
        <p className="text-muted-foreground">No downloadable formats found for this video.</p>
      )}
    </div>
  );
}
