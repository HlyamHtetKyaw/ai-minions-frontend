export type VoiceStyle = 'woman' | 'man' | 'boy' | 'girl';

export type UploadedFile = {
  file: File;
  url: string;
  type: 'video' | 'audio' | 'other';
};
