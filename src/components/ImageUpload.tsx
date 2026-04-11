import React, { useCallback, useRef, useState } from "react";
import { supabase } from "@/lib/supabase.ts";

interface ImageUploadProps {
  bucket: string;
  path: string;
  currentUrl?: string;
  onUpload: (url: string) => void;
  label?: string;
}

export default function ImageUpload({
  bucket,
  path,
  currentUrl,
  onUpload,
  label,
}: ImageUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleSelectClick = () => {
    inputRef.current?.click();
  };

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      if (!file.type.startsWith("image/")) {
        setError("Please upload an image file.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError("Image must be smaller than 5MB.");
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
      setUploading(true);
      setProgress(10);

      try {
        const extension = file.name.split(".").pop() ?? "jpg";
        const fullPath = `${path}.${extension}`;

        // Simulate progress while the upload is in flight.
        const interval = window.setInterval(() => {
          setProgress((p) => (p < 90 ? p + 10 : p));
        }, 200);

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(fullPath, file, { upsert: true });

        window.clearInterval(interval);
        if (uploadError) {
          setUploading(false);
          setProgress(0);
          setError(uploadError.message ?? "Upload failed. Please try again.");
          return;
        }

        setProgress(100);
        const { data } = supabase.storage.from(bucket).getPublicUrl(fullPath);
        if (data?.publicUrl) {
          onUpload(data.publicUrl);
        }
      } catch (e: any) {
        setError(e?.message ?? "Upload failed. Please try again.");
      } finally {
        setUploading(false);
        setTimeout(() => setProgress(0), 500);
      }
    },
    [bucket, onUpload, path],
  );

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      void handleFile(file);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      void handleFile(file);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
  };

  return (
    <div className="space-y-3">
      {label && (
        <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-1">
          {label}
        </label>
      )}
      <div
        className={`border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors ${
          dragOver ? "border-olive-drab bg-olive-drab/5" : "border-stone-200 bg-stone-50"
        }`}
        onClick={handleSelectClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {previewUrl ? (
          <img
            src={previewUrl}
            alt="Preview"
            className="w-full max-h-56 object-cover rounded-xl mb-3"
            referrerPolicy="no-referrer"
          />
        ) : (
          <p className="text-sm text-stone-500 text-center">
            Drag &amp; drop an image here, or click to browse.
          </p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
        {uploading && (
          <div className="w-full mt-3">
            <div className="h-1.5 rounded-full bg-stone-200 overflow-hidden">
              <div
                className="h-full bg-olive-drab transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-stone-400 mt-1">Uploading...</p>
          </div>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          {error}
        </p>
      )}
    </div>
  );
}

