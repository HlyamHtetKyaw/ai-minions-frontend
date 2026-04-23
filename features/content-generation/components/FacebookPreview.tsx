'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Download } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface Props {
  contentType: 'imageAndText' | 'textOnly' | 'imageOnly';
  imageUrl: string | null;
  textContent: string;
  onDownload?: () => void;
}

export default function FacebookPreview({
  contentType,
  imageUrl,
  textContent,
  onDownload,
}: Props) {
  const t = useTranslations('contentGeneration');
  const [copied, setCopied] = useState(false);
  const copiedResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setCopied(false);
  }, [textContent]);

  useEffect(() => {
    return () => {
      if (copiedResetRef.current) clearTimeout(copiedResetRef.current);
    };
  }, []);

  const handleDownload = () => {
    if (!imageUrl) return;
    const base64 = imageUrl.split(',')[1];
    if (!base64) return;
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/png' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-minions-content-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    if (!textContent.trim()) return;
    try {
      await navigator.clipboard.writeText(textContent);
      setCopied(true);
      if (copiedResetRef.current) clearTimeout(copiedResetRef.current);
      copiedResetRef.current = setTimeout(() => {
        setCopied(false);
        copiedResetRef.current = null;
      }, 2500);
    } catch {
      setCopied(false);
    }
  };

  const hasImage =
    !!imageUrl && (contentType === 'imageAndText' || contentType === 'imageOnly');
  const showDownload = hasImage;
  const showCopy = contentType === 'textOnly' && !!textContent.trim();

  const actionBtnClass =
    'inline-flex items-center justify-center gap-2 rounded-md bg-[#e7f3ff] px-4 py-2 text-sm font-semibold text-[#1877f2] transition-colors hover:bg-[#d8ebfc] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1877f2]';

  return (
    <div className="mx-auto w-full max-w-xl overflow-hidden rounded-lg border border-[#ced0d4] bg-white text-[#050505] shadow-sm">
      <div className="flex items-start gap-3 px-4 pt-3 pb-2">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-[#1877f2] to-[#42b72a] text-xs font-bold text-white"
          aria-hidden
        >
          AI
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="truncate text-[15px] font-semibold leading-tight">{t('result.previewAuthor')}</p>
          <p className="text-[13px] text-[#65676b]">{t('result.previewTime')}</p>
        </div>
      </div>

      {textContent.trim() ? (
        <div className="px-4 pb-3">
          <p className="whitespace-pre-wrap text-[15px] leading-snug">{textContent}</p>
        </div>
      ) : null}

      {hasImage ? (
        <div className="w-full bg-[#f0f2f5]">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL from generation API */}
          <img
            src={imageUrl!}
            alt={t('result.title')}
            className="mx-auto block max-h-[min(70vh,720px)] w-full border-0 object-contain outline-none"
          />
        </div>
      ) : null}

      {(showDownload || showCopy) && (
        <div className="flex items-center justify-end border-t border-[#ced0d4] bg-[#f0f2f5] px-3 py-2">
          {showDownload ? (
            <button
              type="button"
              onClick={onDownload ?? handleDownload}
              className={actionBtnClass}
              aria-label={t('result.downloadAria')}
            >
              <Download className="h-4 w-4 shrink-0" aria-hidden />
              {t('result.download')}
            </button>
          ) : null}
          {showCopy ? (
            <button
              type="button"
              onClick={() => void handleCopy()}
              className={actionBtnClass}
              aria-label={copied ? t('result.copied') : t('result.copyAria')}
            >
              {copied ? (
                <Check className="h-4 w-4 shrink-0" aria-hidden />
              ) : (
                <Copy className="h-4 w-4 shrink-0" aria-hidden />
              )}
              {copied ? t('result.copied') : t('result.copy')}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
