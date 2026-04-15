'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft, Loader2, Play, Subtitles } from 'lucide-react';
import ActionButton from '@/components/shared/components/action-button';

type TranslateTone = 'narrative' | 'formal' | 'informal';
type VoiceOption = 'woman-kore' | 'man';

type Props = {
  videoUrl: string;
  videoName: string;
  onBackToUpload: () => void;
};

const BASE_ENGLISH_TRANSCRIPT =
  'This clip explains a simple routine you can do every day to build strength and stay consistent. Keep your pace steady and focus on breathing.';

const BURMESE_BY_TONE: Record<TranslateTone, string> = {
  narrative:
    'ဒီကလစ်မှာ နေ့စဉ်လုပ်နိုင်တဲ့ ရိုးရှင်းသော လေ့ကျင့်ခန်းလုပ်ထုံးလုပ်နည်းကို ရှင်းပြထားပါတယ်။ အရှိန်ကို တည်ငြိမ်စွာ ထိန်းပြီး အသက်ရှူသဘောတရားကို အာရုံစိုက်ပါ။',
  formal:
    'ဤဗီဒီယိုအပိုင်းတွင် နေ့စဉ်ဆောင်ရွက်နိုင်သော လေ့ကျင့်ခန်းနည်းလမ်းတစ်ရပ်ကို ရှင်းလင်းဖော်ပြထားပါသည်။ လှုပ်ရှားနှုန်းကို တည်ငြိမ်စွာ ထိန်းသိမ်း၍ အသက်ရှူစနစ်အား အာရုံစိုက်ပါ။',
  informal:
    'ဒီဗီဒီယိုအပိုင်းက နေ့တိုင်းလုပ်လို့ရတဲ့ လေ့ကျင့်ခန်းလေးကို ပြောပြထားတာပါ။ အရှိန်မမြန်ဘဲ လုပ်ပြီး အသက်ရှူတာကိုပဲ သေချာဂရုစိုက်လိုက်ပါ။',
};

export default function CreationStudio({ videoUrl, videoName, onBackToUpload }: Props) {
  const [tone, setTone] = useState<TranslateTone>('narrative');
  const [voice, setVoice] = useState<VoiceOption>('woman-kore');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isTranscribed, setIsTranscribed] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isTranslated, setIsTranslated] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [scriptText, setScriptText] = useState('');

  const voiceLabel = useMemo(() => (voice === 'woman-kore' ? 'Woman (Kore)' : 'Man'), [voice]);
  const transcriptRows = useMemo(() => {
    const source = scriptText
      .split(/[။.]/)
      .map((line) => line.trim())
      .filter(Boolean);
    return source.map((_, index) => {
      const start = index * 3.2;
      const end = start + 2.6;
      return {
        id: index + 1,
        start: `${Math.floor(start / 60)}:${String(Math.floor(start % 60)).padStart(2, '0')}`,
        end: `${Math.floor(end / 60)}:${String(Math.floor(end % 60)).padStart(2, '0')}`,
      };
    });
  }, [scriptText]);

  const handleTranscribe = async () => {
    setIsTranscribing(true);
    setIsGenerated(false);
    await new Promise((resolve) => setTimeout(resolve, 1400));
    setIsTranscribed(true);
    setIsTranslated(false);
    setScriptText(BASE_ENGLISH_TRANSCRIPT);
    setIsTranscribing(false);
  };

  const handleTranslate = async () => {
    if (!isTranscribed) return;
    setIsTranslating(true);
    setIsGenerated(false);
    await new Promise((resolve) => setTimeout(resolve, 900));
    setScriptText(BURMESE_BY_TONE[tone]);
    setIsTranslated(true);
    setIsTranslating(false);
  };

  const handleGenerate = async () => {
    if (!isTranslated) return;
    setIsGenerating(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsGenerating(false);
    setIsGenerated(true);
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-card-border bg-card shadow-[0_18px_40px_rgba(0,0,0,0.25)]">
      <header className="flex items-center justify-between border-b border-card-border bg-subtle/30 px-3 py-2.5">
        <div className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
          <Subtitles className="h-4 w-4 text-[#b9a4ff]" aria-hidden />
          AI Video Editor
        </div>
        <ActionButton
          onClick={() => void handleGenerate()}
          isLoading={isGenerating}
          disabled={!isTranslated || isGenerating}
          label="Final Export"
          loadingLabel="Generating..."
          className="h-8 rounded-md bg-emerald-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
        />
      </header>

      <div className="grid min-h-[640px] grid-cols-1 lg:grid-cols-[280px_1fr]">
        <aside className="border-r border-card-border bg-subtle/20 p-2.5">
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => void handleTranscribe()}
              disabled={isTranscribing}
              className="btn-transcribe"
            >
              {isTranscribing ? 'Transcribing...' : '1. Transcribe Video'}
            </button>
          </div>

          <div className="mt-6 rounded-md border border-card-border bg-card p-2">
            <div className="grid grid-cols-2 gap-1 text-[10px] font-semibold uppercase text-muted">
              <span className="rounded bg-subtle px-2 py-1 text-center">Script</span>
              <span className="rounded bg-subtle/60 px-2 py-1 text-center">SRT Editor</span>
            </div>
            <div className="mt-2 space-y-1.5">
              {transcriptRows.length > 0 ? (
                <div className="rounded border border-card-border bg-subtle/20 px-2 py-1.5 text-[10px] text-muted">
                  {transcriptRows[0].start} - {transcriptRows[transcriptRows.length - 1].end}
                </div>
              ) : null}
              <textarea
                value={scriptText}
                onChange={(e) => setScriptText(e.target.value)}
                placeholder="Click Transcribe to generate script."
                className="min-h-[220px] w-full resize-y rounded border border-card-border bg-subtle/30 px-2 py-2 text-[11px] leading-snug text-foreground outline-none focus:border-foreground"
              />
            </div>
          </div>

          <div className="mt-6 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">2. Translate</p>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value as TranslateTone)}
              className="h-8 w-full rounded-md border border-card-border bg-card px-2.5 text-xs text-foreground outline-none focus:border-foreground"
            >
              <option value="narrative">Narrative</option>
              <option value="formal">Formal</option>
              <option value="informal">Informal</option>
            </select>
            <ActionButton
              onClick={() => void handleTranslate()}
              isLoading={isTranslating}
              disabled={!isTranscribed || isTranslating}
              label="Translate"
              loadingLabel="Translating..."
              className="btn-viral-shorts-analyze h-11 w-full rounded-xl px-4 text-sm font-semibold"
            />
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">3. AI Voiceover</p>
            <select
              value={voice}
              onChange={(e) => setVoice(e.target.value as VoiceOption)}
              className="h-8 w-full rounded-md border border-card-border bg-card px-2.5 text-xs text-foreground outline-none focus:border-foreground"
            >
              <option value="woman-kore">Woman (Kore)</option>
              <option value="man">Man</option>
            </select>
            <ActionButton
              onClick={() => void handleGenerate()}
              isLoading={isGenerating}
              disabled={!isTranslated || isGenerating}
              label="Generate"
              loadingLabel="Generating..."
              className="btn-viral-shorts h-11 w-full rounded-xl px-4 text-sm font-semibold"
            />
            <button
              type="button"
              className="h-8 w-full rounded-md border border-card-border bg-card px-2 text-[10px] font-semibold text-foreground transition-colors hover:bg-surface"
            >
              Sync Voice Length to Audio
            </button>
            <button
              type="button"
              className="h-8 w-full rounded-md border border-card-border bg-card px-2 text-[10px] font-semibold text-foreground transition-colors hover:bg-surface"
            >
              Generate Timestamps
            </button>
          </div>
        </aside>

        <div className="flex flex-col bg-background/20">
          <div className="flex items-center justify-between border-b border-card-border px-3 py-2 text-[11px] text-muted">
            <span>Editing Mode</span>
            <span>{isGenerated ? `Voiceover ready: ${voiceLabel}` : 'No Project Loaded'}</span>
          </div>
          <div className="flex min-h-[420px] items-center justify-center border-b border-card-border bg-subtle/20 px-5 py-4">
            <div className="overflow-hidden rounded-lg border border-card-border bg-black">
              <video
                src={videoUrl}
                controls
                playsInline
                className="h-[360px] w-[min(56vw,640px)] object-contain"
              />
            </div>
          </div>

          <div className="border-b border-card-border px-3 py-3 text-[11px] text-muted">
            Edit the script directly in the left Script panel.
          </div>

          <div className="px-3 py-2.5">
            <div className="mb-1.5 flex items-center gap-2 text-[10px] text-muted">
              <Play className="h-3.5 w-3.5" aria-hidden />
              <span>
                {isGenerating
                  ? 'Generating Burmese voiceover...'
                  : isTranslated
                    ? 'Burmese script is ready. Click Generate.'
                    : isTranscribed
                      ? 'English script is ready. Click Translate to convert to Burmese.'
                      : `Loaded: ${videoName}`}
              </span>
              {(isTranscribing || isTranslating || isGenerating) && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              )}
            </div>
            <div className="h-1.5 w-full rounded-full bg-subtle">
              <div className="h-1.5 w-[35%] rounded-full bg-foreground" />
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-card-border px-3 py-2">
        <button
          type="button"
          onClick={onBackToUpload}
          className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to upload
        </button>
      </div>
    </section>
  );
}
