"use client";

import React, { useState } from "react";
import { RotateCw, Zap } from "lucide-react";

interface SpinningModelProps {
  isProcessing: boolean;
  isDone?: boolean;
  heightClass?: string;
  showModeToggle?: boolean;
}

export function SpinningModel({
  isProcessing,
  isDone = false,
  heightClass = "h-40 sm:h-48",
  showModeToggle = true,
}: SpinningModelProps) {
  // Default directly to literal 360° spin
  const [spinMode, setSpinMode] = useState<"literal" | "fast" | "3d">("literal");

  return (
    <div className="relative my-3 flex flex-col items-center justify-center">
      {/* Self-contained keyframes ensuring literal 360° continuous rotation */}
      <style>{`
        @keyframes literal360Spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
        @keyframes literal3DSpin {
          0% {
            transform: perspective(700px) rotateY(0deg);
          }
          100% {
            transform: perspective(700px) rotateY(360deg);
          }
        }
        @keyframes pedestalPulseLocal {
          0%, 100% {
            opacity: 0.5;
            transform: scale(0.95);
          }
          50% {
            opacity: 0.9;
            transform: scale(1.05);
          }
        }
      `}</style>

      {/* Center Rotation Stage */}
      <div className="relative w-56 h-56 sm:w-60 sm:h-60 flex items-center justify-center">
        {/* Concentric Rotating Tech Rings */}
        <div
          className={`absolute w-56 h-56 rounded-full border border-dashed border-purple-500/35 transition-transform ${
            isProcessing ? "animate-[spin_6s_linear_infinite]" : "opacity-30"
          }`}
        />
        <div
          className={`absolute w-48 h-48 rounded-full border border-fuchsia-500/30 transition-transform ${
            isProcessing
              ? "animate-[spin_4s_linear_infinite_reverse]"
              : "opacity-25"
          }`}
        />

        {/* Model Image with Literal Continuous Spin */}
        <div className="relative z-10 w-full h-full flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/tamad-creator.png"
            alt="Tamad Tips Model"
            className={`${heightClass} w-auto max-h-[196px] object-contain select-none transition-all duration-300 ${
              isProcessing
                ? spinMode === "fast"
                  ? "drop-shadow-[0_0_35px_rgba(236,72,153,0.95)]"
                  : "drop-shadow-[0_0_35px_rgba(168,85,247,0.9)]"
                : isDone
                ? "scale-105 drop-shadow-[0_0_35px_rgba(52,211,153,0.85)]"
                : "drop-shadow-[0_0_20px_rgba(168,85,247,0.5)]"
            }`}
            style={{
              transformOrigin: "center center",
              animation: isProcessing
                ? spinMode === "fast"
                  ? "literal360Spin 0.6s linear infinite"
                  : spinMode === "3d"
                  ? "literal3DSpin 1.8s linear infinite"
                  : "literal360Spin 1.2s linear infinite"
                : "none",
            }}
          />
        </div>

        {/* Glowing Pedestal beneath Model */}
        <div
          className="absolute bottom-1 w-44 h-4 bg-gradient-to-r from-transparent via-purple-500/50 to-transparent rounded-full blur-sm pointer-events-none"
          style={{ animation: "pedestalPulseLocal 2s ease-in-out infinite" }}
        />
      </div>

      {/* Optional Spin Mode Switcher Pill */}
      {isProcessing && showModeToggle && (
        <div className="mt-1 flex justify-center items-center gap-1.5">
          <span className="text-[11px] text-[#787895] flex items-center gap-1">
            <RotateCw className="h-3 w-3" />
            <span>Spin:</span>
          </span>
          <div className="inline-flex rounded-lg bg-[#181826] p-0.5 border border-[#2b2b40] text-[11px]">
            <button
              type="button"
              onClick={() => setSpinMode("literal")}
              className={`px-2 py-0.5 rounded-md transition font-medium flex items-center gap-1 ${
                spinMode === "literal"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-[#8e8ea6] hover:text-white"
              }`}
              title="Literal 360° spinning animation"
            >
              <span>Spinning 🌪️</span>
            </button>
            <button
              type="button"
              onClick={() => setSpinMode("fast")}
              className={`px-2 py-0.5 rounded-md transition font-medium flex items-center gap-1 ${
                spinMode === "fast"
                  ? "bg-fuchsia-600 text-white shadow-sm"
                  : "text-[#8e8ea6] hover:text-white"
              }`}
              title="Hyper fast spinning animation"
            >
              <Zap className="h-2.5 w-2.5" />
              <span>Fast ⚡</span>
            </button>
            <button
              type="button"
              onClick={() => setSpinMode("3d")}
              className={`px-2 py-0.5 rounded-md transition font-medium flex items-center gap-1 ${
                spinMode === "3d"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-[#8e8ea6] hover:text-white"
              }`}
              title="3D Turntable flip"
            >
              <span>3D Flip</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
