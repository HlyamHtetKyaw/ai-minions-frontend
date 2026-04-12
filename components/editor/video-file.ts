import type { EditorState } from '@/store/editorStore';

export const VIDEO_FILE_ACCEPT_ATTR =
  '.mp4,.mov,.webm,video/mp4,video/quicktime,video/webm';

export function isAllowedVideoFile(file: File): boolean {
  const allowedTypes = ['video/mp4', 'video/quicktime', 'video/webm'];
  const ext = file.name.split('.').pop()?.toLowerCase();
  const allowedExt = ['mp4', 'mov', 'webm'];
  return (
    (file.type !== '' && allowedTypes.includes(file.type)) ||
    (!!ext && allowedExt.includes(ext))
  );
}

/** Loads a local video file into the editor store (revokes previous blob URL in `setVideoSrc`). */
export function applyVideoFileToEditor(
  file: File,
  setVideoSrc: EditorState['setVideoSrc'],
): boolean {
  if (!isAllowedVideoFile(file)) return false;
  const url = URL.createObjectURL(file);
  setVideoSrc(url);
  return true;
}
