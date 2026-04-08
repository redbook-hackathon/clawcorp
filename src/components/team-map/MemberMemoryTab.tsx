import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { Bold, Italic, Link2, List } from 'lucide-react';
import { getMemoryOverview, reindexMemory, saveMemoryFile } from '@/lib/memory-client';
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

export function MemberMemoryTab({ agent }: { agent: AgentSummary }) {
  const { t } = useTranslation('common');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [expectedMtime, setExpectedMtime] = useState<string | undefined>(undefined);
  const [statusText, setStatusText] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadMemory = async () => {
      setLoading(true);
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
          setStatusText(
            t('teamMap.memory.error', { defaultValue: 'Could not sync. Retry.' }),
          );
          toast.error(String(error));
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
  }, [agent.id]);

  useEffect(() => {
    if (loading || draft === savedContent) return;

    setStatusText(t('teamMap.memory.saving', { defaultValue: 'Saving...' }));

    const timeoutId = window.setTimeout(async () => {
      try {
        await saveMemoryFile({
          relativePath: 'MEMORY.md',
          content: draft,
          scope: agent.id,
          expectedMtime,
        });
        await reindexMemory();
        setSavedContent(draft);
        setStatusText(t('teamMap.memory.synced', { defaultValue: 'Synced' }));
        toast.success(t('teamMap.memory.synced', { defaultValue: 'Synced' }));
      } catch (error) {
        setStatusText(t('teamMap.memory.error', { defaultValue: 'Could not sync. Retry.' }));
        toast.error(String(error));
      }
    }, AUTOSAVE_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [agent.id, draft, expectedMtime, loading, savedContent]);

  const applyFormat = (prefix: string, suffix = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart ?? draft.length;
    const end = textarea.selectionEnd ?? draft.length;
    const selected = draft.slice(start, end);
    const nextValue = `${draft.slice(0, start)}${prefix}${selected}${suffix}${draft.slice(end)}`;
    setDraft(nextValue);
  };

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
          {previewOpen ? 'Hide Preview' : 'Show Preview'}
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
            placeholder={t('teamMap.memory.empty', { defaultValue: 'No memory yet' })}
          />

          {previewOpen ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
              <pre className="whitespace-pre-wrap font-sans">{draft || t('teamMap.memory.empty', { defaultValue: 'No memory yet' })}</pre>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
              {t('teamMap.memory.previewHint', {
                defaultValue: 'Toggle preview to inspect the rendered memory content.',
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
