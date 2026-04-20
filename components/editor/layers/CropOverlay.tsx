'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Crop, { type Area, type Point } from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';
import { marginsFromNaturalCropRect } from '@/components/editor/crop-display-margins';
import { useEditorStore } from '@/store/editorStore';
import type { CropPixelRect } from '@/store/editorStore';

type CropOverlayProps = {
  videoWidth: number;
  videoHeight: number;
  videoSrc: string;
  mainVideoRef: React.RefObject<HTMLVideoElement | null>;
};

function buildMediaTransform(
  x: number,
  y: number,
  rotation: number,
  zoom: number,
  flipH: boolean,
  flipV: boolean,
) {
  const sx = flipH ? -1 : 1;
  const sy = flipV ? -1 : 1;
  if (sx === 1 && sy === 1) {
    return undefined;
  }
  return `translate(${x}px, ${y}px) rotate(${rotation}deg) scale(${zoom}) scale(${sx}, ${sy})`;
}

export function CropOverlay({
  videoWidth: fw,
  videoHeight: fh,
  videoSrc,
  mainVideoRef,
}: CropOverlayProps) {
  const cropSettings = useEditorStore((s) => s.cropSettings);
  const setCropSettings = useEditorStore((s) => s.setCropSettings);
  const setVideoElement = useEditorStore((s) => s.setVideoElement);
  const currentTime = useEditorStore((s) => s.currentTime);
  const isPlaying = useEditorStore((s) => s.isPlaying);
  const setCurrentTime = useEditorStore((s) => s.setCurrentTime);
  const setIsPlaying = useEditorStore((s) => s.setIsPlaying);
  const videoNaturalWidth = useEditorStore((s) => s.videoNaturalWidth);
  const videoNaturalHeight = useEditorStore((s) => s.videoNaturalHeight);
  const canvasFrameWidth = useEditorStore((s) => s.canvasFrameWidth);
  const canvasFrameHeight = useEditorStore((s) => s.canvasFrameHeight);
  const playbackSpeed = useEditorStore((s) => s.playbackSpeed);
  const [cropSurfaceToken, setCropSurfaceToken] = useState(0);

  const {
    easyCrop,
    easyZoom,
    easyRotation,
    easyAspect,
    flipHorizontal,
    flipVertical,
  } = cropSettings;

  const onCropChange = useCallback(
    (loc: Point) => {
      setCropSettings({ easyCrop: loc });
    },
    [setCropSettings],
  );

  const onCropComplete = useCallback(
    (croppedArea: Area, croppedAreaPixels: Area) => {
      const st = useEditorStore.getState();
      const cs = st.cropSettings;
      const px: CropPixelRect = {
        x: croppedAreaPixels.x,
        y: croppedAreaPixels.y,
        width: croppedAreaPixels.width,
        height: croppedAreaPixels.height,
      };
      const pct: CropPixelRect = {
        x: croppedArea.x,
        y: croppedArea.y,
        width: croppedArea.width,
        height: croppedArea.height,
      };
      const m = marginsFromNaturalCropRect(
        px,
        st.canvasFrameWidth,
        st.canvasFrameHeight,
        st.videoNaturalWidth,
        st.videoNaturalHeight,
        cs.easyRotation,
        cs.flipHorizontal,
        cs.flipVertical,
      );
      st.setCropSettings({
        croppedAreaPixels: px,
        croppedAreaPercentages: pct,
        ...m,
      });
    },
    [],
  );

  const handleSetVideoRef = useCallback(
    (ref: React.RefObject<HTMLVideoElement | null>) => {
      const cropEl = ref.current;
      const main = mainVideoRef.current;
      if (cropEl && main) {
        cropEl.currentTime = main.currentTime;
        if (!main.paused) {
          void cropEl.play();
        }
      }
      if (cropEl) {
        setVideoElement(cropEl);
        setCropSurfaceToken((t) => t + 1);
      }
    },
    [mainVideoRef, setVideoElement],
  );

  useEffect(() => {
    const mainAtMount = mainVideoRef.current;
    return () => {
      const crop = useEditorStore.getState().videoElement;
      const main = mainAtMount;
      if (crop && main && crop !== main) {
        main.currentTime = crop.currentTime;
      }
      if (main) {
        setVideoElement(main);
      }
    };
  }, [mainVideoRef, setVideoElement]);

  useEffect(() => {
    const v = useEditorStore.getState().videoElement;
    if (!v) return;
    if (isPlaying) {
      void v.play();
    } else {
      v.pause();
    }
  }, [isPlaying, cropSurfaceToken]);

  useEffect(() => {
    const v = useEditorStore.getState().videoElement;
    if (!v || !Number.isFinite(currentTime)) return;
    if (Math.abs(v.currentTime - currentTime) > 0.05) {
      v.currentTime = currentTime;
    }
  }, [currentTime, cropSurfaceToken]);

  useEffect(() => {
    const v = useEditorStore.getState().videoElement;
    if (v) v.playbackRate = playbackSpeed;
  }, [playbackSpeed, cropSurfaceToken]);

  const transform = useMemo(
    () =>
      buildMediaTransform(
        easyCrop.x,
        easyCrop.y,
        easyRotation,
        easyZoom,
        flipHorizontal,
        flipVertical,
      ),
    [
      easyCrop.x,
      easyCrop.y,
      easyRotation,
      easyZoom,
      flipHorizontal,
      flipVertical,
    ],
  );

  const normRot = ((easyRotation % 360) + 360) % 360;

  if (fw <= 0 || fh <= 0) return null;

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-30"
      role="presentation"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Crop
        video={videoSrc}
        crop={easyCrop}
        zoom={easyZoom}
        rotation={easyRotation}
        aspect={easyAspect > 0 ? easyAspect : 16 / 9}
        transform={transform}
        onCropChange={onCropChange}
        onZoomChange={(z) => setCropSettings({ easyZoom: z })}
        onRotationChange={(r) => setCropSettings({ easyRotation: r })}
        onCropComplete={onCropComplete}
        restrictPosition={normRot === 0}
        minZoom={1}
        maxZoom={3}
        zoomWithScroll
        showGrid
        keyboardStep={1}
        style={{
          containerStyle: {
            width: fw,
            height: fh,
            position: 'relative',
            background: '#000',
          },
          cropAreaStyle: {},
          mediaStyle: {},
        }}
        classes={{}}
        mediaProps={{
          muted: false,
          loop: false,
          playsInline: true,
          preload: 'metadata',
          onTimeUpdate: (e) => {
            const v = e.currentTarget as HTMLVideoElement;
            setCurrentTime(v.currentTime);
          },
          onPlay: () => setIsPlaying(true),
          onPause: () => setIsPlaying(false),
          onEnded: () => setIsPlaying(false),
        }}
        cropperProps={{}}
        setVideoRef={handleSetVideoRef}
        onMediaLoaded={() => {
          const cropEl = useEditorStore.getState().videoElement;
          const main = mainVideoRef.current;
          if (cropEl && main) {
            cropEl.currentTime = main.currentTime;
          }
        }}
      />
      <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-[10px] font-medium tabular-nums text-white/90">
        {canvasFrameWidth > 0 && canvasFrameHeight > 0
          ? `${Math.round(canvasFrameWidth)} × ${Math.round(canvasFrameHeight)} display`
          : ''}
        {videoNaturalWidth > 0
          ? ` · ${videoNaturalWidth}×${videoNaturalHeight} source`
          : ''}
      </div>
    </div>
  );
}
