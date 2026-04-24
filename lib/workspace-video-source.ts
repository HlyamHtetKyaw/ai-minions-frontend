import { applyVideoFileToEditor, isAllowedVideoFile } from '@/components/editor/video-file';
import { uploadVideoEditorFile } from '@/lib/video-editor-workspace-api';
import { useEditorStore } from '@/store/editorStore';
import type { EditorState } from '@/store/editorStore';

/** True if the API read URL is HTTP(S) and can be used for preview and server-side export. */
export function isHttpWorkspaceReadUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

/**
 * Loads a local file for immediate preview (blob), uploads to workspace storage, then sets
 * `videoSrc` to the cloud read URL + `#wk=` key. Use for every path that imports a main video
 * (dropzone and "replace video" file input), otherwise export stays disabled on `blob:` URLs.
 */
export async function applyLocalVideoFileWithWorkspaceUpload(
  file: File,
  setVideoSrc: EditorState['setVideoSrc'],
): Promise<void> {
  if (!isAllowedVideoFile(file)) {
    return;
  }
  applyVideoFileToEditor(file, setVideoSrc);
  const uploaded = await uploadVideoEditorFile(file);
  if (!isHttpWorkspaceReadUrl(uploaded.storageUrl)) {
    return;
  }
  const current = useEditorStore.getState().videoSrc;
  if (typeof current === 'string' && current.startsWith('blob:')) {
    URL.revokeObjectURL(current);
  }
  const withWorkspaceKey = `${uploaded.storageUrl}#wk=${encodeURIComponent(uploaded.s3Key)}`;
  useEditorStore.setState({ videoSrc: withWorkspaceKey });
}
