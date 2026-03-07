"""
Temporal analysis service: trends, moving averages, thread velocity.

All computation derives from existing timestamps on Source, SourceLink,
and ThreadEntry. No new models needed.
"""

import datetime
from collections import defaultdict

from django.db.models import Count, Min, Max
from django.db.models.functions import TruncDate
from django.utils import timezone

from apps.research.models import (
    ResearchThread,
    Source,
    SourceLink,
    ThreadEntry,
)


# ---------------------------------------------------------------------------
# Trends time series
# ---------------------------------------------------------------------------

def _daily_counts(model, date_field, start_date, end_date):
    """
    Return a dict mapping date -> count for a model's date field.

    Counts only records within the given date range.
    """
    qs = model.objects.filter(
        **{
            f'{date_field}__date__gte': start_date,
            f'{date_field}__date__lte': end_date,
        }
    ).annotate(
        day=TruncDate(date_field),
    ).values('day').annotate(
        count=Count('id'),
    ).order_by('day')

    return {row['day']: row['count'] for row in qs}


def _fill_series(counts, start_date, end_date):
    """Fill in zeros for dates with no activity."""
    series = []
    current = start_date
    while current <= end_date:
        series.append(counts.get(current, 0))
        current += datetime.timedelta(days=1)
    return series


def _moving_average(series, window):
    """Compute a simple moving average over the series."""
    if len(series) < window:
        return [sum(series) / len(series)] if series else []
    result = []
    for i in range(len(series) - window + 1):
        avg = sum(series[i:i + window]) / window
        result.append(round(avg, 4))
    return result


def _compute_direction(series, window):
    """
    Compare the most recent window average to the previous window average.

    Returns 'accelerating', 'decelerating', or 'stable'.
    Ratio > 1.15 = accelerating, < 0.85 = decelerating, otherwise stable.
    """
    if len(series) < window * 2:
        return 'stable'

    recent = sum(series[-window:]) / window
    previous = sum(series[-2 * window:-window]) / window

    if previous == 0:
        return 'accelerating' if recent > 0 else 'stable'

    ratio = recent / previous
    if ratio > 1.15:
        return 'accelerating'
    if ratio < 0.85:
        return 'decelerating'
    return 'stable'


def _compute_summary(counts, start_date, end_date):
    """
    Compute summary statistics: most active day, longest gap, current streak.
    """
    total_counts = defaultdict(int)
    for metric_counts in counts.values():
        for day, count in metric_counts.items():
            total_counts[day] += count

    if not total_counts:
        return {
            'most_active_day': None,
            'longest_gap_days': 0,
            'current_streak_days': 0,
        }

    most_active_day = max(total_counts, key=total_counts.get)

    active_dates = sorted(total_counts.keys())

    # Longest gap
    longest_gap = 0
    for i in range(1, len(active_dates)):
        gap = (active_dates[i] - active_dates[i - 1]).days - 1
        if gap > longest_gap:
            longest_gap = gap

    # Current streak (consecutive days ending at today or most recent day)
    today = end_date
    streak = 0
    current = today
    active_set = set(active_dates)
    while current >= start_date:
        if current in active_set:
            streak += 1
            current -= datetime.timedelta(days=1)
        else:
            break

    return {
        'most_active_day': most_active_day.isoformat(),
        'longest_gap_days': longest_gap,
        'current_streak_days': streak,
    }


def compute_trends(window=30, metric='all'):
    """
    Build time series with moving averages, direction, and summary stats.

    Args:
        window: Moving average window in days (1 to 365).
        metric: 'sources', 'links', 'entries', or 'all'.

    Returns dict with series, direction, and summary.
    """
    today = timezone.now().date()
    lookback = max(window * 3, 90)
    start_date = today - datetime.timedelta(days=lookback)

    # Gather daily counts for requested metrics
    metric_configs = {
        'sources': (Source, 'created_at'),
        'links': (SourceLink, 'created_at'),
        'entries': (ThreadEntry, 'created_at'),
    }

    if metric == 'all':
        active_metrics = list(metric_configs.keys())
    else:
        active_metrics = [metric]

    raw_counts = {}
    for name in active_metrics:
        model, field = metric_configs[name]
        raw_counts[name] = _daily_counts(model, field, start_date, today)

    # Build combined time series
    series_data = []
    current = start_date
    while current <= today:
        point = {'date': current.isoformat()}
        for name in active_metrics:
            point[name] = raw_counts[name].get(current, 0)
        series_data.append(point)
        current += datetime.timedelta(days=1)

    # Compute direction for each metric
    direction = {}
    for name in active_metrics:
        filled = _fill_series(raw_counts[name], start_date, today)
        direction[name] = _compute_direction(filled, window)

    # Summary stats
    summary = _compute_summary(raw_counts, start_date, today)

    return {
        'window_days': window,
        'series': series_data,
        'direction': direction,
        'summary': summary,
    }


# ---------------------------------------------------------------------------
# Thread velocity and staleness
# ---------------------------------------------------------------------------

def _classify_staleness(days_since):
    """
    Classify thread staleness based on days since last entry.

    fresh: within 7 days
    cooling: 8 to 30 days
    stale: 31 to 90 days
    dormant: over 90 days (or no entries)
    """
    if days_since is None:
        return 'dormant'
    if days_since <= 7:
        return 'fresh'
    if days_since <= 30:
        return 'cooling'
    if days_since <= 90:
        return 'stale'
    return 'dormant'


def compute_thread_velocity():
    """
    Compute velocity and staleness metrics for all public threads.

    Velocity is entries per 30-day period (a simple rate).
    """
    today = timezone.now().date()
    thirty_days_ago = today - datetime.timedelta(days=30)
    seven_days_ago = today - datetime.timedelta(days=7)

    threads = ResearchThread.objects.public().annotate(
        total_entries=Count('entries'),
        first_entry=Min('entries__date'),
        last_entry=Max('entries__date'),
    ).order_by('title')

    results = []
    for thread in threads:
        entry_count = thread.total_entries or 0

        entries_last_30 = ThreadEntry.objects.filter(
            thread=thread,
            date__gte=thirty_days_ago,
        ).count()

        entries_last_7 = ThreadEntry.objects.filter(
            thread=thread,
            date__gte=seven_days_ago,
        ).count()

        last_entry_date = thread.last_entry
        if last_entry_date:
            days_since = (today - last_entry_date).days
        else:
            days_since = None

        # Velocity: entries per 30 days (looking at last 30 days)
        velocity = round(entries_last_30 / 30.0, 4) if entry_count > 0 else 0.0

        staleness = _classify_staleness(days_since)

        results.append({
            'slug': thread.slug,
            'title': thread.title,
            'status': thread.status,
            'entry_count': entry_count,
            'entries_last_30_days': entries_last_30,
            'entries_last_7_days': entries_last_7,
            'days_since_last_entry': days_since,
            'velocity': velocity,
            'staleness': staleness,
            'started_date': (
                thread.first_entry.isoformat() if thread.first_entry else None
            ),
            'last_entry_date': (
                last_entry_date.isoformat() if last_entry_date else None
            ),
        })

    return results
