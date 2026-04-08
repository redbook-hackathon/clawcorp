/**
 * ManualTaskForm Component
 * Phase 02-04: Dialog form for manual task creation (weakened entry)
 */
import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { useApprovalsStore } from '@/stores/approvals';
import { useAgentsStore } from '@/stores/agents';
import type { TaskPriority } from '@/types/task';

interface ManualTaskFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManualTaskForm({ open, onOpenChange }: ManualTaskFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [assigneeId, setAssigneeId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [loading, setLoading] = useState(false);

  const createTask = useApprovalsStore((s) => s.createTask);
  const agents = useAgentsStore((s) => s.agents);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setLoading(true);
    try {
      await createTask({
        title: title.trim(),
        description: description.trim(),
        priority,
        assigneeId: assigneeId || undefined,
        deadline: deadline || undefined,
      });
      // Reset form
      setTitle('');
      setDescription('');
      setPriority('medium');
      setAssigneeId('');
      setDeadline('');
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create task:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[500px]">
        <SheetHeader>
          <SheetTitle>创建任务</SheetTitle>
          <SheetDescription>
            手动创建任务。推荐在对话中创建任务以获得更好的体验。
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label htmlFor="task-title" className="block text-sm font-medium mb-1">
              任务标题 *
            </label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="输入任务标题"
              required
            />
          </div>
          <div>
            <label htmlFor="task-description" className="block text-sm font-medium mb-1">
              任务描述
            </label>
            <Textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="输入任务描述"
              rows={4}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="task-priority" className="block text-sm font-medium mb-1">
                优先级
              </label>
              <Select
                id="task-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
              >
                <option value="low">低</option>
                <option value="medium">中</option>
                <option value="high">高</option>
              </Select>
            </div>
            <div>
              <label htmlFor="task-assignee" className="block text-sm font-medium mb-1">
                负责人
              </label>
              <Select
                id="task-assignee"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
              >
                <option value="">未分配</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div>
            <label htmlFor="task-deadline" className="block text-sm font-medium mb-1">
              截止时间
            </label>
            <Input
              id="task-deadline"
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={loading || !title.trim()}>
              {loading ? '创建中...' : '创建任务'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
