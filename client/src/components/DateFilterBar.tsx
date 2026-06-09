import { formatDayTab, isWeekViewAll, WEEK_VIEW_ALL } from '../utils/date';

interface Props {
  days: string[];
  selectedDate: string;
  onSelect: (date: string) => void;
}

export function DateFilterBar({ days, selectedDate, onSelect }: Props) {
  const weekView = isWeekViewAll(selectedDate);

  return (
    <>
      <button
        type="button"
        onClick={() => onSelect(WEEK_VIEW_ALL)}
        className={`filter-chip ${weekView ? 'filter-chip-active' : 'hover:bg-surface-sunken'}`}
      >
        Show all
      </button>
      {days.map((day) => (
        <button
          key={day}
          type="button"
          onClick={() => onSelect(day)}
          className={`filter-chip ${!weekView && selectedDate === day ? 'filter-chip-active' : 'hover:bg-surface-sunken'}`}
        >
          {formatDayTab(day)}
        </button>
      ))}
    </>
  );
}
