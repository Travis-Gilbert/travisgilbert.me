'use client';

/**
 * CalendarView: month calendar with activity heatmap.
 *
 * Fetches all daily logs once, builds a date -> activity count
 * map, and renders a 7-column Monday-first grid. Each cell with
 * activity shows a terracotta dot at one of three opacity tiers.
 *
 * Clicking a day reveals the DailyLogPanel below the grid with
 * full activity detail. Clicking an object in the panel opens
 * the object detail in an adjacent pane.
 */

import { useState, useMemo } from 'react';
import { fetchDailyLogs, useApiData } from '@/lib/commonplace-api';
import DailyLogPanel from '../capture/DailyLogPanel';

interface CalendarViewProps {
  onOpenObject?: (objectRef: number, title?: string) => void;
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Get a YYYY-MM-DD string from a Date (local timezone, not UTC) */
function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Compute activity dot opacity tier */
function dotOpacity(count: number): number {
  if (count <= 0) return 0;
  if (count <= 3) return 0.3;
  if (count <= 7) return 0.6;
  return 1.0;
}

/** Days in a given month (1-indexed month) */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Monday-first offset: how many blank cells before the 1st.
 * JS getDay(): 0=Sun, 1=Mon, ... 6=Sat
 * Monday-first: (getDay() + 6) % 7 gives 0=Mon, 1=Tue, ... 6=Sun
 */
function firstDayOffset(year: number, month: number): number {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

export default function CalendarView({ onOpenObject }: CalendarViewProps) {
  const today = new Date();
  const todayKey = toDateKey(today);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  /* Fetch all daily logs once for heatmap data */
  const { data: logs, loading, error, refetch } = useApiData(
    () => fetchDailyLogs(),
    [],
  );

  /* Build activity map: date -> total activity count */
  const activityMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!logs) return map;
    for (const log of logs) {
      const count =
        log.objects_created.length +
        log.objects_updated.length +
        log.edges_created.length;
      if (count > 0) map.set(log.date, count);
    }
    return map;
  }, [logs]);

  /* Calendar grid data */
  const offset = firstDayOffset(viewYear, viewMonth);
  const totalDays = daysInMonth(viewYear, viewMonth);
  const totalCells = 42; // 6 rows x 7 columns

  /* Month label */
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString(
    'en-US',
    { month: 'long', year: 'numeric' },
  );

  /* Navigation */
  function prevMonth() {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
    setSelectedDate(null);
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
    setSelectedDate(null);
  }

  function handleDayClick(dateKey: string) {
    setSelectedDate((prev) => (prev === dateKey ? null : dateKey));
  }

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="cp-calendar-view cp-scrollbar">
        <div className="cp-calendar-header">
          <h2 className="cp-calendar-title">Calendar</h2>
        </div>
        <div style={{ padding: '0 16px' }}>
          <div
            className="cp-loading-skeleton"
            style={{ width: '100%', height: 280, borderRadius: 8 }}
          />
        </div>
      </div>
    );
  }

  /* ── Error state ── */
  if (error) {
    return (
      <div className="cp-calendar-view">
        <div className="cp-calendar-header">
          <h2 className="cp-calendar-title">Calendar</h2>
        </div>
        <div className="cp-error-banner" style={{ margin: 16 }}>
          <p>
            {error.isNetworkError
              ? 'Could not reach CommonPlace API.'
              : `Error: ${error.message}`}
          </p>
          <button type="button" onClick={refetch}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cp-calendar-view cp-scrollbar">
      {/* Month navigation header */}
      <div className="cp-calendar-header">
        <button
          type="button"
          className="cp-calendar-nav-btn"
          onClick={prevMonth}
          aria-label="Previous month"
        >
          &lsaquo;
        </button>
        <h2 className="cp-calendar-month-label">{monthLabel}</h2>
        <button
          type="button"
          className="cp-calendar-nav-btn"
          onClick={nextMonth}
          aria-label="Next month"
        >
          &rsaquo;
        </button>
      </div>

      {/* Weekday labels */}
      <div className="cp-calendar-weekdays">
        {WEEKDAY_LABELS.map((day) => (
          <div key={day} className="cp-calendar-weekday">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid: 42 cells (6 rows x 7 columns) */}
      <div className="cp-calendar-grid">
        {Array.from({ length: totalCells }).map((_, i) => {
          const dayNum = i - offset + 1;
          const isValid = dayNum >= 1 && dayNum <= totalDays;

          if (!isValid) {
            return <div key={`empty-${i}`} className="cp-calendar-cell cp-calendar-cell--empty" />;
          }

          const dateKey = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
          const isToday = dateKey === todayKey;
          const isSelected = dateKey === selectedDate;
          const activityCount = activityMap.get(dateKey) ?? 0;
          const opacity = dotOpacity(activityCount);

          return (
            <button
              key={dateKey}
              type="button"
              className="cp-calendar-cell"
              data-today={isToday || undefined}
              data-selected={isSelected || undefined}
              data-has-activity={activityCount > 0 || undefined}
              onClick={() => handleDayClick(dateKey)}
              aria-label={`${dateKey}${activityCount > 0 ? `, ${activityCount} activities` : ''}`}
            >
              <span className="cp-calendar-day-number">{dayNum}</span>
              {activityCount > 0 && (
                <span
                  className="cp-calendar-dot"
                  style={{ opacity }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Daily log detail panel (shown when a date is selected) */}
      {selectedDate && (
        <DailyLogPanel
          date={selectedDate}
          onOpenObject={onOpenObject}
        />
      )}
    </div>
  );
}
