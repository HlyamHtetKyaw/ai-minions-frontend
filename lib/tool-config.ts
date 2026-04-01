import { LANGUAGES } from './constants';

export type FieldConfig = {
  name: string;
  label: string;
  type: 'text' | 'select';
  options?: string[];
};

export type ToolConfig = {
  slug: string;
  title: string;
  description: string;
  inputType: 'file' | 'text' | 'file+text';
  acceptedFileTypes?: string;
  outputType: 'json' | 'blob' | 'text';
  fields?: FieldConfig[];
};

const VIDEO_TYPES = '.mp4,.mov,.avi,.mkv,.webm';
const DOC_TYPES = '.pdf,.txt,.docx,.epub';
const LANG_OPTIONS = LANGUAGES.map((l) => l.name);
const VOICE_OPTIONS = ['Natural', 'Formal', 'Casual', 'Dramatic', 'Newscast'];

export const TOOL_CONFIGS: Record<string, ToolConfig> = {
  'caption-studio': {
    slug: 'caption-studio',
    title: 'Caption Studio',
    description: 'Auto-generate captions and subtitles from video files.',
    inputType: 'file',
    acceptedFileTypes: VIDEO_TYPES,
    outputType: 'json',
  },
  'ai-voice': {
    slug: 'ai-voice',
    title: 'AI Voice',
    description: 'Convert text to natural-sounding AI voice audio.',
    inputType: 'text',
    outputType: 'json',
    fields: [
      { name: 'text', label: 'Text to speak', type: 'text' },
      { name: 'voice', label: 'Voice style', type: 'select', options: VOICE_OPTIONS },
    ],
  },
  'voice-gen-live': {
    slug: 'voice-gen-live',
    title: 'Voice Gen Live',
    description: 'Real-time voice generation from any text input.',
    inputType: 'text',
    outputType: 'json',
    fields: [
      { name: 'text', label: 'Text to generate', type: 'text' },
      { name: 'style', label: 'Style', type: 'select', options: VOICE_OPTIONS },
    ],
  },
  translate: {
    slug: 'translate',
    title: 'Translate',
    description: 'Translate audio or video content into multiple languages.',
    inputType: 'file+text',
    acceptedFileTypes: VIDEO_TYPES,
    outputType: 'json',
    fields: [
      {
        name: 'targetLanguage',
        label: 'Target language',
        type: 'select',
        options: LANG_OPTIONS,
      },
    ],
  },
  'content-creator': {
    slug: 'content-creator',
    title: 'Content Creator',
    description: 'Generate social media posts, scripts, and marketing copy.',
    inputType: 'text',
    outputType: 'json',
    fields: [
      { name: 'prompt', label: 'Describe the content you need', type: 'text' },
      {
        name: 'platform',
        label: 'Platform',
        type: 'select',
        options: ['YouTube', 'TikTok', 'Instagram', 'Twitter / X', 'LinkedIn'],
      },
    ],
  },
  'story-creator': {
    slug: 'story-creator',
    title: 'Story Creator',
    description: 'Craft compelling story narratives and screenplays with AI.',
    inputType: 'text',
    outputType: 'json',
    fields: [
      { name: 'premise', label: 'Story premise or prompt', type: 'text' },
      {
        name: 'genre',
        label: 'Genre',
        type: 'select',
        options: ['Drama', 'Comedy', 'Thriller', 'Romance', 'Sci-Fi', 'Horror'],
      },
    ],
  },
  'srt-sub': {
    slug: 'srt-sub',
    title: 'SRT Sub',
    description: 'Generate clean SRT subtitle files directly from video.',
    inputType: 'file',
    acceptedFileTypes: VIDEO_TYPES,
    outputType: 'text',
  },
  recapper: {
    slug: 'recapper',
    title: 'Recapper',
    description: 'Summarize and recap long-form video content automatically.',
    inputType: 'file',
    acceptedFileTypes: VIDEO_TYPES,
    outputType: 'json',
  },
  thumbnail: {
    slug: 'thumbnail',
    title: 'Thumbnail',
    description: 'Generate eye-catching AI thumbnails for your videos.',
    inputType: 'file',
    acceptedFileTypes: VIDEO_TYPES,
    outputType: 'json',
    fields: [
      { name: 'title', label: 'Video title (optional)', type: 'text' },
    ],
  },
  'novel-translator': {
    slug: 'novel-translator',
    title: 'Novel Translator',
    description: 'Translate full novels and long-form documents at scale.',
    inputType: 'file+text',
    acceptedFileTypes: DOC_TYPES,
    outputType: 'blob',
    fields: [
      {
        name: 'targetLanguage',
        label: 'Target language',
        type: 'select',
        options: LANG_OPTIONS,
      },
    ],
  },
  'video-recap': {
    slug: 'video-recap',
    title: 'Video Recap',
    description: 'Create short highlight recap videos from longer footage.',
    inputType: 'file',
    acceptedFileTypes: VIDEO_TYPES,
    outputType: 'blob',
  },
  'master-editor': {
    slug: 'master-editor',
    title: 'Master Editor',
    description: 'AI-powered video editing, cutting, and enhancement.',
    inputType: 'file',
    acceptedFileTypes: VIDEO_TYPES,
    outputType: 'blob',
  },
  'sub-gen': {
    slug: 'sub-gen',
    title: 'Sub Gen',
    description: 'Automatically generate burned-in subtitles for any video.',
    inputType: 'file',
    acceptedFileTypes: VIDEO_TYPES,
    outputType: 'blob',
  },
  transcribe: {
    slug: 'transcribe',
    title: 'Transcribe',
    description: 'Convert speech to accurate, timestamped text transcripts.',
    inputType: 'file',
    acceptedFileTypes: `${VIDEO_TYPES},.mp3,.wav,.m4a,.ogg`,
    outputType: 'json',
  },
  'news-automation': {
    slug: 'news-automation',
    title: 'News Automation',
    description: 'Automate news article and bulletin generation from prompts.',
    inputType: 'text',
    outputType: 'json',
    fields: [
      { name: 'topic', label: 'News topic or headline', type: 'text' },
      {
        name: 'tone',
        label: 'Tone',
        type: 'select',
        options: ['Neutral', 'Formal', 'Breaking', 'Editorial'],
      },
    ],
  },
};
