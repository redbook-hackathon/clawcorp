import { useEffect, useState } from 'react';
import { FileText, Upload, UserCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useAgentsStore } from '@/stores/agents';
import { useChatStore, type RawMessage } from '@/stores/chat';
import { useRightPanelStore } from '@/stores/rightPanelStore';
import { TaskDetailPanel } from '@/pages/TaskKanban/TaskDetailPanel';

type FileEntry = {
  id: string;
  fileName: string;
  fileSize: number;
  uploadedAt: number | null;
};

function formatFileSize(fileSize: number): string {
  if (fileSize < 1024) return `${fileSize} B`;
  if (fileSize < 1024 * 1024) return `${Math.round(fileSize / 1024)} KB`;
  return `${(fileSize / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUploadedAt(uploadedAt: number | null): string {
  if (!uploadedAt) return 'Unknown';
  return new Date(uploadedAt).toLocaleString();
}

function collectFiles(messages: RawMessage[]): FileEntry[] {
  const files: FileEntry[] = [];
  const seen = new Set<string>();

  for (const message of messages) {
    const uploadedAt = typeof message.timestamp === 'number' ? message.timestamp : null;
    for (const file of message._attachedFiles ?? []) {
      const id = file.filePath ?? `${file.fileName}:${uploadedAt ?? 'unknown'}`;
      if (seen.has(id)) continue;
      seen.add(id);
      files.push({
        id,
        fileName: file.fileName,
        fileSize: file.fileSize,
        uploadedAt,
      });
    }
  }

  return files.sort((a, b) => (b.uploadedAt ?? 0) - (a.uploadedAt ?? 0));
}

function FileListPanel() {
  const messages = useChatStore((state) => state.messages);
  const { t } = useTranslation();
  const files = collectFiles(messages);

  if (files.length === 0) {
    return (
      <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 text-center text-muted-foreground">
        <Upload className="h-8 w-8" />
        <p>{t('common:rightPanel.noFiles', { defaultValue: 'No files yet' })}</p>
      </div>
    );
  }

  return (
    <div className="flex max-h-full flex-col gap-2 overflow-y-auto">
      {files.map((file) => (
        <div key={file.id} className="rounded-lg border border-border px-3 py-3">
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.fileName}</p>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>{formatFileSize(file.fileSize)}</span>
                <span>{formatUploadedAt(file.uploadedAt)}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AgentInfoPanel() {
  const { t } = useTranslation();
  const agentId = useRightPanelStore((state) => state.agentId);
  const agents = useAgentsStore((state) => state.agents);
  const updateAgent = useAgentsStore((state) => state.updateAgent);
  const agent = agents.find((item) => item.id === agentId) ?? null;
  const [name, setName] = useState('');
  const [model, setModel] = useState('');

  useEffect(() => {
    setName(agent?.name ?? '');
    setModel(agent?.model ?? agent?.modelDisplay ?? '');
  }, [agent]);

  if (!agent) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center text-center text-muted-foreground">
        {t('common:rightPanel.noAgent', { defaultValue: 'No agent selected' })}
      </div>
    );
  }

  const modelOptions = Array.from(
    new Set(
      ['claude-sonnet-4', 'gpt-5', 'gpt-5-mini']
        .concat(
          agents
        .flatMap((item) => [item.model, item.modelDisplay])
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
        ),
    ),
  );

  const handleSave = async () => {
    await updateAgent(agent.id, { name, model });
    toast.success(t('common:rightPanel.saved', { defaultValue: 'Saved' }));
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-xl">
          {agent.avatar ?? '🤖'}
        </div>
        <div>
          <p className="text-sm font-medium">{agent.name}</p>
          <p className="text-xs text-muted-foreground">{agent.id}</p>
        </div>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="right-panel-agent-name">
          {t('common:rightPanel.name', { defaultValue: 'Name' })}
        </label>
        <Input
          id="right-panel-agent-name"
          aria-label={t('common:rightPanel.name', { defaultValue: 'Name' })}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium" htmlFor="right-panel-agent-model">
          {t('common:rightPanel.model', { defaultValue: 'Model' })}
        </label>
        <Select
          id="right-panel-agent-model"
          aria-label={t('common:rightPanel.model', { defaultValue: 'Model' })}
          value={model}
          onChange={(event) => setModel(event.target.value)}
        >
          {modelOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </Select>
      </div>

      <div className="rounded-lg border border-border px-3 py-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">
            {t('common:rightPanel.role', { defaultValue: 'Role' })}
          </span>
          <span className="font-medium">
            {agent.teamRole === 'leader'
              ? t('common:rightPanel.role.leader', { defaultValue: 'Leader' })
              : t('common:rightPanel.role.worker', { defaultValue: 'Worker' })}
          </span>
        </div>
      </div>

      <Button className="mt-auto" onClick={() => void handleSave()}>
        {t('common:rightPanel.save', { defaultValue: 'Save' })}
      </Button>
    </div>
  );
}

export function PanelTriggerButtons({
  agentId,
}: {
  agentId?: string | null;
}) {
  const openPanel = useRightPanelStore((state) => state.openPanel);
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-1">
      <Button
        size="icon"
        type="button"
        variant="ghost"
        aria-label={t('common:rightPanel.openFiles', { defaultValue: 'Open files panel' })}
        onClick={() => openPanel('file', agentId ?? undefined)}
      >
        <FileText className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        type="button"
        variant="ghost"
        aria-label={t('common:rightPanel.openAgent', { defaultValue: 'Open agent panel' })}
        onClick={() => openPanel('agent', agentId ?? undefined)}
      >
        <UserCircle className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function RightPanel() {
  const { t } = useTranslation();
  const open = useRightPanelStore((state) => state.open);
  const type = useRightPanelStore((state) => state.type);
  const taskId = useRightPanelStore((state) => state.taskId);
  const closePanel = useRightPanelStore((state) => state.closePanel);

  if (!open || !type) return null;

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && closePanel()}>
      <SheetContent side="right" className="flex w-[400px] flex-col sm:max-w-[400px]">
        <SheetHeader>
          <SheetTitle>
            {type === 'file'
              ? t('common:rightPanel.files', { defaultValue: 'Files' })
              : type === 'agent'
              ? t('common:rightPanel.agent', { defaultValue: 'Agent' })
              : '任务详情'}
          </SheetTitle>
          <SheetDescription>
            {type === 'file'
              ? t('common:rightPanel.filesDescription', { defaultValue: 'Browse files attached to the current session.' })
              : type === 'agent'
              ? t('common:rightPanel.agentDescription', { defaultValue: 'Inspect and edit the selected agent.' })
              : '查看和编辑任务详细信息'}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
          {type === 'file' ? (
            <FileListPanel />
          ) : type === 'agent' ? (
            <AgentInfoPanel />
          ) : type === 'task' && taskId ? (
            <TaskDetailPanel taskId={taskId} />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
