import { isAllowedVideoFile } from '@/components/editor/video-file';
import { uploadVideoEditorFile } from '@/lib/video-editor-workspace-api';
import { useEditorStore } from '@/store/editorStore';
import type { EditorState } from '@/store/editorStore';

/** True if the API read URL is HTTP(S) and can be used for preview and server-side export. */
export function isHttpWorkspaceReadUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim());
}

/**
 * Same flow as viral shorts: presign → PUT to storage → set `videoSrc` to read URL + `#wk=` key
 * (no `blob:` intermediate). Preview uses the HTTPS URL directly like CreationStudio.
 *
 * `setVideoSrc` resets `cropSettings` to defaults (16:9). Pass `easyAspectToKeep` so the chosen
 * canvas ratio (e.g. 9:16) survives upload.
 */
export async function applyLocalVideoFileWithWorkspaceUpload(
  file: File,
  setVideoSrc: EditorState['setVideoSrc'],
  easyAspectToKeep?: number,
): Promise<void> {
  if (!isAllowedVideoFile(file)) {
    return;
  }
  const restoreEasyAspect =
    easyAspectToKeep ?? useEditorStore.getState().cropSettings.easyAspect;
  const uploaded = await uploadVideoEditorFile(file);
  if (!isHttpWorkspaceReadUrl(uploaded.storageUrl)) {
    return;
  }
  const current = useEditorStore.getState().videoSrc;
  if (typeof current === 'string' && current.startsWith('blob:')) {
    URL.revokeObjectURL(current);
  }
  const withWorkspaceKey = `${uploaded.storageUrl}#wk=${encodeURIComponent(uploaded.s3Key)}`;
  setVideoSrc(withWorkspaceKey);
  useEditorStore.getState().setCropSettings({ easyAspect: restoreEasyAspect });
}
