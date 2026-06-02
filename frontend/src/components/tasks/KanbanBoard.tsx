import { useMemo, useState } from 'react';
import type { Task, TaskStatus } from '../../types/api';
import TaskCard from './TaskCard';
import { useUpdateTask } from '../../hooks/queries/useTasks';
import { useToast } from '../ui';
import { getApiErrorMessage } from '../../lib/apiError';
import './KanbanBoard.css';

const COLUMNS: { key: TaskStatus; label: string }[] = [
  { key: 'ToDo', label: 'To Do' },
  { key: 'InProgress', label: 'In Progress' },
  { key: 'Done', label: 'Done' },
];

interface KanbanBoardProps {
  tasks: Task[];
  currentUserId?: number;
  onSelect?: (task: Task) => void;
}

export default function KanbanBoard({ tasks, currentUserId, onSelect }: KanbanBoardProps) {
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [hoverColumn, setHoverColumn] = useState<TaskStatus | null>(null);
  const updateMut = useUpdateTask();
  const toast = useToast();

  const grouped = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = { ToDo: [], InProgress: [], Done: [] };
    for (const t of tasks) {
      map[t.status].push(t);
    }
    return map;
  }, [tasks]);

  const handleDrop = async (status: TaskStatus, taskId: number) => {
    setDraggingId(null);
    setHoverColumn(null);
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === status) return;

    if (
      currentUserId !== undefined &&
      task.created_by !== currentUserId &&
      task.assigned_to !== currentUserId
    ) {
      toast.error('Only the task creator or assignee can change status.');
      return;
    }

    try {
      await updateMut.mutateAsync({ id: taskId, input: { status } });
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not update task status.'));
    }
  };

  return (
    <div className="kanban">
      {COLUMNS.map((col) => (
        <div
          key={col.key}
          className={`kanban__col ${hoverColumn === col.key ? 'kanban__col--hover' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setHoverColumn(col.key);
          }}
          onDragLeave={() => setHoverColumn((c) => (c === col.key ? null : c))}
          onDrop={(e) => {
            const id = Number(e.dataTransfer.getData('text/plain'));
            if (id) handleDrop(col.key, id);
          }}
        >
          <div className="kanban__col-head">
            <span className="kanban__col-label">{col.label}</span>
            <span className="kanban__col-count">{grouped[col.key].length}</span>
          </div>
          <div className="kanban__col-list">
            {grouped[col.key].length === 0 ? (
              <div className="kanban__empty">Drop tasks here</div>
            ) : (
              grouped[col.key].map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  draggable
                  isDragging={draggingId === task.id}
                  onDragStart={(e) => {
                    setDraggingId(task.id);
                    e.dataTransfer.setData('text/plain', String(task.id));
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onDragEnd={() => setDraggingId(null)}
                  onClick={() => onSelect?.(task)}
                />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
