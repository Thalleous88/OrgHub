import { Input, Select } from '../ui';

interface TaskDueInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  dateLabel?: string;
  timeLabel?: string;
}

const timeOptions = Array.from({ length: 24 * 4 }, (_, index) => {
  const totalMinutes = index * 15;
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0');
  const minutes = String(totalMinutes % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
});

function splitDue(value: string): { date: string; time: string } {
  const [date = '', time = ''] = value.split('T');
  return { date, time: time.slice(0, 5) };
}

export default function TaskDueInput({
  value,
  onChange,
  disabled,
  required,
  dateLabel = 'Due date',
  timeLabel = 'Due time',
}: TaskDueInputProps) {
  const { date, time } = splitDue(value);

  const setDate = (nextDate: string) => {
    onChange(nextDate ? `${nextDate}T${time || '09:00'}` : '');
  };

  const setTime = (nextTime: string) => {
    onChange(date ? `${date}T${nextTime}` : '');
  };

  return (
    <div className="task-due-input">
      <Input
        type="date"
        value={date}
        onChange={(event) => setDate(event.target.value)}
        disabled={disabled}
        required={required}
        aria-label={dateLabel}
      />
      <Select
        value={time || '09:00'}
        onChange={(event) => setTime(event.target.value)}
        disabled={disabled || !date}
        aria-label={timeLabel}
      >
        {timeOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>
    </div>
  );
}
