'use client';

import { useState } from 'react';
import ResultDisplay from './result-display';
import { useTranslations } from 'next-intl';

type FieldConfig = {
  name: string;
  label: string;
  type: 'text' | 'select';
  options?: string[];
};

type ToolFormProps = {
  toolSlug: string;
  title: string;
  description: string;
  inputType: 'file' | 'text' | 'file+text';
  acceptedFileTypes?: string;
  outputType: 'json' | 'blob' | 'text';
  fields?: FieldConfig[];
};

function getMockResult(outputType: 'json' | 'blob' | 'text', toolSlug: string): unknown {
  if (outputType === 'json') {
    const mockBySlug: Record<string, unknown> = {
      'caption-studio': {
        captions: [
          { start: '00:00:01,000', end: '00:00:04,000', text: 'Welcome to the AI Minions demo.' },
          { start: '00:00:04,500', end: '00:00:07,200', text: 'This caption was generated automatically.' },
        ],
        language: 'en',
        confidence: 0.97,
      },
      'ai-voice': { audioUrl: '/mock/output.mp3', duration: 4.2, format: 'mp3' },
      'voice-gen-live': { audioUrl: '/mock/live.mp3', duration: 3.8, format: 'mp3' },
      translate: {
        targetLanguage: 'Spanish',
        segments: [
          { original: 'Hello world', translated: 'Hola mundo' },
          { original: 'This is a demo.', translated: 'Esto es una demostración.' },
        ],
      },
      'content-creator': {
        platform: 'YouTube',
        content: 'Discover the future of AI-powered content creation! 🚀 Our latest tool helps you generate professional scripts in seconds. Like and subscribe for more! #AI #ContentCreation',
      },
      'story-creator': {
        title: 'The Last Frequency',
        genre: 'Thriller',
        synopsis: 'In a world where radio signals carry secrets, one engineer discovers a broadcast that was never meant to be heard…',
        excerpt: 'The static crackled at 3:47 AM. Maya pressed her headphones tight, certain she had misheard. But the voice came again, calm and precise: "The package is in transit."',
      },
      recapper: {
        duration: '12:34',
        summary: 'The video covers three main topics: introduction to AI tools, live demonstrations of caption generation, and a Q&A session with the audience.',
        keyPoints: ['AI captioning overview (0:00–3:00)', 'Live demo (3:00–9:00)', 'Q&A (9:00–12:34)'],
      },
      thumbnail: {
        thumbnails: [
          { id: 1, url: '/mock/thumb1.jpg', score: 0.92 },
          { id: 2, url: '/mock/thumb2.jpg', score: 0.88 },
          { id: 3, url: '/mock/thumb3.jpg', score: 0.85 },
        ],
      },
      transcribe: {
        transcript: [
          { time: '00:00:00', speaker: 'Speaker 1', text: 'Hello, and welcome to today\'s session.' },
          { time: '00:00:05', speaker: 'Speaker 1', text: 'We\'ll be covering AI transcription capabilities.' },
          { time: '00:00:10', speaker: 'Speaker 2', text: 'Sounds great. Where do we start?' },
        ],
        wordCount: 312,
        confidence: 0.96,
      },
      'news-automation': {
        headline: 'AI Tools Revolutionise Video Production Workflow',
        body: 'A new wave of AI-powered tools is transforming how content creators edit, caption, and translate their video output. Industry experts predict wide adoption by the end of the year.',
        tags: ['AI', 'Video', 'Technology', 'Content Creation'],
        wordCount: 87,
      },
    };
    return mockBySlug[toolSlug] ?? { status: 'success', result: 'Processing complete.', toolSlug };
  }

  if (outputType === 'text') {
    return `1
00:00:01,000 --> 00:00:04,000
Welcome to the AI Minions demo.

2
00:00:04,500 --> 00:00:07,200
This subtitle was generated automatically.

3
00:00:07,800 --> 00:00:11,000
Powered by AI Minions — fast, accurate, and free to try.`;
  }

  // blob — return a label string; ResultDisplay handles the UI
  return '__blob__';
}

export default function ToolForm({
  toolSlug,
  inputType,
  acceptedFileTypes,
  outputType,
  fields,
}: ToolFormProps) {
  const t = useTranslations('toolForm');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<unknown>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [fileName, setFileName] = useState<string | null>(null);

  function handleFieldChange(name: string, value: string) {
    setFieldValues((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setResult(null);
    setTimeout(() => {
      setIsLoading(false);
      setResult(getMockResult(outputType, toolSlug));
    }, 1500);
  }

  const showFileInput = inputType === 'file' || inputType === 'file+text';
  const showTextField = inputType === 'text' || inputType === 'file+text';

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-card-border bg-card p-6">
        {/* File input */}
        {showFileInput && (
          <div className="space-y-1.5">
            <label className="block text-sm font-medium">
              {inputType === 'file+text' ? t('uploadFile') : t('selectFile')}
            </label>
            <div className="flex items-center gap-3">
              <label className="flex-1 cursor-pointer rounded-lg border-2 border-dashed border-card-border p-6 text-center hover:border-gray-400 dark:hover:border-gray-600 transition-colors">
                <input
                  type="file"
                  accept={acceptedFileTypes}
                  className="sr-only"
                  onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
                />
                <div className="text-2xl mb-1">📁</div>
                <p className="text-sm text-muted">
                  {fileName ? (
                    <span className="font-medium text-foreground">{fileName}</span>
                  ) : (
                    <>{t('clickToUpload')}{acceptedFileTypes ? ` (${acceptedFileTypes})` : ''}</>
                  )}
                </p>
              </label>
            </div>
          </div>
        )}

        {/* Generic fields (text/select) from config */}
        {fields?.map((field) => (
          <div key={field.name} className="space-y-1.5">
            <label htmlFor={field.name} className="block text-sm font-medium">
              {field.label}
            </label>
            {field.type === 'select' ? (
              <select
                id={field.name}
                value={fieldValues[field.name] ?? ''}
                onChange={(e) => handleFieldChange(field.name, e.target.value)}
                className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              >
                <option value="" disabled>
                  {t('selectPlaceholder')}
                </option>
                {field.options?.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              <textarea
                id={field.name}
                rows={3}
                placeholder={field.label}
                value={fieldValues[field.name] ?? ''}
                onChange={(e) => handleFieldChange(field.name, e.target.value)}
                className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 resize-none"
              />
            )}
          </div>
        ))}

        {/* Fallback text area for text-only tools with no explicit fields */}
        {showTextField && !fields?.length && (
          <div className="space-y-1.5">
            <label htmlFor="default-text" className="block text-sm font-medium">
              {t('inputText')}
            </label>
            <textarea
              id="default-text"
              rows={4}
              placeholder={t('inputTextPlaceholder')}
              value={fieldValues['text'] ?? ''}
              onChange={(e) => handleFieldChange('text', e.target.value)}
              className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 resize-none"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-fg transition-colors hover:bg-primary-hover disabled:opacity-60"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              {t('processing')}
            </>
          ) : (
            t('run')
          )}
        </button>
      </form>

      {result !== null && (
        <ResultDisplay result={result} outputType={outputType} />
      )}
    </div>
  );
} 
