"use client";

import { useState, useEffect } from "react";
import ReactDOM from "react-dom";

type MediaAttachment = {
  key: string;
  fileName: string;
  contentType: string;
};

/**
 * A simple thumbnail component that shows an image preview or a file icon.
 */
export function MediaThumbnail({ 
  attachment, 
  onClick,
  size = "md",
  token
}: { 
  attachment: MediaAttachment; 
  onClick?: () => void;
  size?: "sm" | "md" | "lg";
  token?: string;
}) {
  const isImage = attachment.contentType.startsWith("image/");
  const src = `/api/media/${encodeURIComponent(attachment.key)}${token ? `?token=${encodeURIComponent(token)}` : ''}`;

  const sizeCls = {
    sm: "h-8 w-8",
    md: "h-12 w-12",
    lg: "h-20 w-20"
  }[size];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${sizeCls} relative group rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900 flex-shrink-0 hover:border-sky-500/50 transition-all`}
    >
      {isImage ? (
        <img 
          src={src} 
          alt={attachment.fileName} 
          className="h-full w-full object-cover transition-transform group-hover:scale-110"
          loading="lazy"
        />
      ) : (
        <div className="h-full w-full flex items-center justify-center text-[10px] font-bold text-zinc-600 bg-zinc-950 uppercase tracking-tighter">
          {attachment.fileName.split('.').pop() || "FILE"}
        </div>
      )}
      <div className="absolute inset-0 bg-sky-500/0 group-hover:bg-sky-500/10 transition-colors"></div>
    </button>
  );
}

/**
 * A lightweight full-screen modal for viewing media.
 */
export function MediaViewerModal({ 
  attachment, 
  onClose,
  token
}: { 
  attachment: MediaAttachment; 
  onClose: () => void;
  token?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const isImage = attachment.contentType.startsWith("image/");
  const src = `/api/media/${encodeURIComponent(attachment.key)}${token ? `?token=${encodeURIComponent(token)}` : ''}`;

  useEffect(() => {
    setMounted(true);
    // Prevent scrolling behind modal
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  if (!mounted) return null;

  return ReactDOM.createPortal(
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative max-w-[95vw] max-h-[95vh] flex flex-col items-center gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white/70 hover:text-white flex items-center gap-1.5 transition-colors group"
        >
          <span className="text-xs font-bold uppercase tracking-widest">Close</span>
          <span className="text-2xl font-light group-hover:scale-110 transition-transform">×</span>
        </button>

        <div className="bg-zinc-900/50 rounded-2xl overflow-hidden shadow-2xl border border-white/10">
          {isImage ? (
            <img 
              src={src} 
              alt={attachment.fileName} 
              className="max-w-full max-h-[80vh] object-contain block"
            />
          ) : (
            <div className="p-12 text-center space-y-4">
              <div className="text-6xl">📄</div>
              <div className="space-y-1">
                <p className="text-lg font-bold text-white">{attachment.fileName}</p>
                <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">
                  {attachment.contentType}
                </p>
              </div>
              <a 
                href={src} 
                download={attachment.fileName}
                className="inline-flex items-center gap-2 px-6 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-sm font-bold transition-colors"
              >
                Download File
              </a>
            </div>
          )}
        </div>

        <div className="text-center px-4">
          <p className="text-sm font-bold text-white tracking-tight">{attachment.fileName}</p>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mt-1">
            Media Proof Entry
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
