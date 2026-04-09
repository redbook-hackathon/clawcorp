import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Bold, Italic, Link2, List } from 'lucide-react';
import { getMemoryOverview, saveMemoryFile } from '@/lib/memory-client';
import type { AgentSummary } from '@/types/agent';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

type MemoryApiFile = {
  relativePath: string;
  label?: string;
  content?: string;
  lastModified?: string;
};

type MemoryApiResponse = {
  files: MemoryApiFile[];
};

const AUTOSAVE_DELAY_MS = 1500;

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown error';
  }
}

export function MemberMemoryTab({ agent }: { agent: AgentSummary }) {
  const { t } = useTranslation('common');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [expectedMtime, setExpectedMtime] = useState<string | undefined>(undefined);
  const [statusText, setStatusText] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadMemory = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const response = await getMemoryOverview({ scope: agent.id }) as MemoryApiResponse;
        const memoryFile = response.files.find((file) => file.relativePath === 'MEMORY.md');
        const nextContent = memoryFile?.content ?? '';
        const nextMtime = memoryFile?.lastModified;

        if (!cancelled) {
          setDraft(nextContent);
          setSavedContent(nextContent);
          setExpectedMtime(nextMtime);
          setStatusText('');
        }
      } catch (error) {
        if (!cancelled) {
          const msg = getErrorMessage(error);
          setLoadError(msg);
          setStatusText(t('teamMap.memory.error'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadMemory();

    return () => {
      cancelled = true;
    };
  }, [agent.id, t]);

  useEffect(() => {
    if (loading || loadError || draft === savedContent) return;

    setStatusText(t('teamMap.memory.saving'));

    const timeoutId = window.setTimeout(async () => {
      try {
        await saveMemoryFile({
          relativePath: 'MEMORY.md',
          content: draft,
          scope: agent.id,
          expectedMtime,
        });
        setSavedContent(draft);
        setStatusText(t('teamMap.memory.synced'));
      } catch (error) {
        const msg = getErrorMessage(error);
        setStatusText(t('teamMap.memory.error'));
        toast.error(msg);
      }
    }, AUTOSAVE_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [agent.id, draft, expectedMtime, loading, loadError, savedContent, t]);

  const applyFormat = (prefix: string, suffix = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart ?? draft.length;
    const end = textarea.selectionEnd ?? draft.length;
    const selected = draft.slice(start, end);
    const nextValue = `${draft.slice(0, start)}${prefix}${selected}${suffix}${draft.slice(end)}`;
    setDraft(nextValue);
  };

  if (loadError && loading) {
    return (
      <div className="space-y-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-5 text-sm text-red-700">
        <p className="font-medium">{t('teamMap.memory.error')}</p>
        <p className="text-xs text-red-500">{loadError}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setLoadError(null);
            setLoading(true);
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => applyFormat('**', '**')}>
          <Bold className="mr-2 h-4 w-4" />
          Bold
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => applyFormat('*', '*')}>
          <Italic className="mr-2 h-4 w-4" />
          Italic
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => applyFormat('- ')}>
          <List className="mr-2 h-4 w-4" />
          List
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => applyFormat('[', '](https://)')}>
          <Link2 className="mr-2 h-4 w-4" />
          Link
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setPreviewOpen((value) => !value)}>
          {previewOpen ? t('teamMap.memory.hidePreview') : t('teamMap.memory.showPreview')}
        </Button>
        <span className="ml-auto text-xs font-medium text-slate-500">{statusText}</span>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
          {t('status.loading')}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="min-h-[240px]"
            placeholder={t('teamMap.memory.empty')}
          />

          {previewOpen ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
              <pre className="whitespace-pre-wrap font-sans">{draft || t('teamMap.memory.empty')}</pre>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              {t('teamMap.memory.previewHint')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
