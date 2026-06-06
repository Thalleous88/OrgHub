import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { Input } from '../ui';
import './TaskDueInput.css';

interface TaskDueInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  dateLabel?: string;
  timeLabel?: string;
}

type ClockMode = 'hours' | 'minutes';
type Period = 'AM' | 'PM';

const hourValues = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const minuteValues = Array.from({ length: 12 }, (_, index) => index * 5);

function splitDue(value: string): { date: string; time: string } {
  const [date = '', time = ''] = value.split('T');
  return { date, time: time.slice(0, 5) };
}

function parseTime(value: string): { hour: number; minute: number; period: Period } {
  const [rawHour = '09', rawMinute = '00'] = value.split(':');
  const hour24 = Number(rawHour);
  return {
    hour: hour24 % 12 || 12,
    minute: Number(rawMinute),
    period: hour24 >= 12 ? 'PM' : 'AM',
  };
}

function to24Hour(hour: number, period: Period): number {
  if (period === 'AM') return hour === 12 ? 0 : hour;
  return hour === 12 ? 12 : hour + 12;
}

function formatTime(hour: number, minute: number, period: Period): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`;
}

function toTimeValue(hour: number, minute: number, period: Period): string {
  return `${String(to24Hour(hour, period)).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
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
      <ClockTimePicker
        value={time || '09:00'}
        onChange={setTime}
        disabled={disabled || !date}
        ariaLabel={timeLabel}
      />
    </div>
  );
}

function ClockTimePicker({
  value,
  onChange,
  disabled,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  const initial = parseTime(value);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ClockMode>('hours');
  const [hour, setHour] = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);
  const [period, setPeriod] = useState<Period>(initial.period);
  const [position, setPosition] = useState({ top: 0, left: 0, above: false });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const closePicker = () => setOpen(false);

  const openPicker = () => {
    const next = parseTime(value);
    setHour(next.hour);
    setMinute(next.minute);
    setPeriod(next.period);
    setMode('hours');
    setOpen(true);
  };

  useLayoutEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const viewportPadding = 12;
      const popoverWidth = Math.min(300, window.innerWidth - viewportPadding * 2);
      const estimatedHeight = 408;
      const gap = 8;
      const above =
        rect.bottom + gap + estimatedHeight > window.innerHeight &&
        rect.top > estimatedHeight + gap;
      const top = above
        ? Math.max(viewportPadding, rect.top - estimatedHeight - gap)
        : Math.max(
            viewportPadding,
            Math.min(
              rect.bottom + gap,
              window.innerHeight - estimatedHeight - viewportPadding,
            ),
          );
      const left = Math.min(
        Math.max(viewportPadding, rect.right - popoverWidth),
        Math.max(viewportPadding, window.innerWidth - popoverWidth - viewportPadding),
      );

      setPosition({ top, left, above });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      ) {
        closePicker();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closePicker();
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const values = mode === 'hours' ? hourValues : minuteValues;
  const selectedValue = mode === 'hours' ? hour : minute;
  const handAngle = mode === 'hours' ? (hour % 12) * 30 : minute * 6;

  const confirmTime = () => {
    onChange(toTimeValue(hour, minute, period));
    closePicker();
    triggerRef.current?.focus();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="clock-picker__trigger"
        onClick={openPicker}
        disabled={disabled}
        aria-label={`${ariaLabel}: ${formatTime(hour, minute, period)}`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <ClockIcon />
        <span>{formatTime(initial.hour, initial.minute, initial.period)}</span>
      </button>

      {open &&
        createPortal(
          <div
            ref={popoverRef}
            className={`clock-picker${position.above ? ' clock-picker--above' : ''}`}
            style={{ top: position.top, left: position.left }}
            role="dialog"
            aria-label={ariaLabel}
          >
            <span className="clock-picker__eyebrow">Select time</span>

            <div className="clock-picker__display">
              <div className="clock-picker__digits">
                <button
                  type="button"
                  className={mode === 'hours' ? 'is-active' : ''}
                  onClick={() => setMode('hours')}
                  aria-label={`Select hour, current hour ${hour}`}
                >
                  {String(hour).padStart(2, '0')}
                </button>
                <span>:</span>
                <button
                  type="button"
                  className={mode === 'minutes' ? 'is-active' : ''}
                  onClick={() => setMode('minutes')}
                  aria-label={`Select minutes, current minutes ${minute}`}
                >
                  {String(minute).padStart(2, '0')}
                </button>
              </div>
              <div className="clock-picker__period" aria-label="Select AM or PM">
                {(['AM', 'PM'] as Period[]).map((option) => (
                  <button
                    type="button"
                    key={option}
                    className={period === option ? 'is-active' : ''}
                    onClick={() => setPeriod(option)}
                    aria-pressed={period === option}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="clock-picker__face" aria-label={`Select ${mode}`}>
              <span
                className={`clock-picker__hand clock-picker__hand--${mode}`}
                style={{ transform: `translateX(-50%) rotate(${handAngle}deg)` }}
                aria-hidden="true"
              />
              <span className="clock-picker__center" aria-hidden="true" />
              {values.map((clockValue, index) => {
                const angle = (index * 30 * Math.PI) / 180;
                const x = Math.sin(angle) * 91;
                const y = -Math.cos(angle) * 91;
                const selected = selectedValue === clockValue;
                const style = {
                  '--clock-x': `${x}px`,
                  '--clock-y': `${y}px`,
                } as CSSProperties;

                return (
                  <button
                    type="button"
                    key={clockValue}
                    className={selected ? 'is-selected' : ''}
                    style={style}
                    aria-pressed={selected}
                    aria-label={
                      mode === 'hours'
                        ? `${clockValue} ${period}`
                        : `${clockValue} minutes`
                    }
                    onClick={() => {
                      if (mode === 'hours') {
                        setHour(clockValue);
                        setMode('minutes');
                      } else {
                        setMinute(clockValue);
                      }
                    }}
                  >
                    {mode === 'minutes'
                      ? String(clockValue).padStart(2, '0')
                      : clockValue}
                  </button>
                );
              })}
            </div>

            <div className="clock-picker__actions">
              <button type="button" onClick={closePicker}>
                Cancel
              </button>
              <button type="button" onClick={confirmTime}>
                Done
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function ClockIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6h4" />
    </svg>
  );
}
