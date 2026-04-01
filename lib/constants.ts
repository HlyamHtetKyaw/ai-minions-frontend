export type Feature = {
  name: string;
  path: string;
  icon: string;
  description: string;
};

export const FEATURES: Feature[] = [
  {
    name: 'Caption Studio',
    path: '/caption-studio',
    icon: '🎬',
    description: 'Auto-generate captions and subtitles from video files.',
  },
  {
    name: 'AI Voice',
    path: '/ai-voice',
    icon: '🎙️',
    description: 'Convert text to natural-sounding AI voice audio.',
  },
  {
    name: 'Voice Gen Live',
    path: '/voice-gen-live',
    icon: '🔊',
    description: 'Real-time voice generation from any text input.',
  },
  {
    name: 'Translate',
    path: '/translate',
    icon: '🌐',
    description: 'Translate audio or video content into multiple languages.',
  },
  {
    name: 'Content Creator',
    path: '/content-creator',
    icon: '✍️',
    description: 'Generate social media posts, scripts, and marketing copy.',
  },
  {
    name: 'Story Creator',
    path: '/story-creator',
    icon: '📖',
    description: 'Craft compelling story narratives and screenplays with AI.',
  },
  {
    name: 'SRT Sub',
    path: '/srt-sub',
    icon: '📝',
    description: 'Generate clean SRT subtitle files directly from video.',
  },
  {
    name: 'Recapper',
    path: '/recapper',
    icon: '📋',
    description: 'Summarize and recap long-form video content automatically.',
  },
  {
    name: 'Thumbnail',
    path: '/thumbnail',
    icon: '🖼️',
    description: 'Generate eye-catching AI thumbnails for your videos.',
  },
  {
    name: 'Novel Translator',
    path: '/novel-translator',
    icon: '📚',
    description: 'Translate full novels and long-form documents at scale.',
  },
  {
    name: 'Video Recap',
    path: '/video-recap',
    icon: '🎥',
    description: 'Create short highlight recap videos from longer footage.',
  },
  {
    name: 'Master Editor',
    path: '/master-editor',
    icon: '✂️',
    description: 'AI-powered video editing, cutting, and enhancement.',
  },
  {
    name: 'Sub Gen',
    path: '/sub-gen',
    icon: '💬',
    description: 'Automatically generate burned-in subtitles for any video.',
  },
  {
    name: 'Transcribe',
    path: '/transcribe',
    icon: '📄',
    description: 'Convert speech to accurate, timestamped text transcripts.',
  },
  {
    name: 'News Automation',
    path: '/news-automation',
    icon: '📰',
    description: 'Automate news article and bulletin generation from prompts.',
  },
];

export type Language = {
  code: string;
  name: string;
};

export const LANGUAGES: Language[] = [
  { code: 'en', name: 'English' },
  { code: 'my', name: 'Myanmar' },
];
