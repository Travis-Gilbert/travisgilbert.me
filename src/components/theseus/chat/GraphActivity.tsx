'use client';

type ActivityType = 'cluster' | 'tension' | 'hypothesis' | 'connection';

interface ActivityItem {
  type: ActivityType;
  label: string;
  detail: string;
  time: string;
}

// TODO: wire to real API when getGraphWeather() returns structured activity items
const PLACEHOLDER_ACTIVITY: ActivityItem[] = [
  {
    type: 'cluster',
    label: 'New cluster formed: Epistemic Calibration Methods',
    detail: '47 objects, 12 connections',
    time: '2h ago',
  },
  {
    type: 'tension',
    label: 'Tension detected: Bayesian vs. frequentist priors in GNN training',
    detail: '3 claims in conflict',
    time: '5h ago',
  },
  {
    type: 'hypothesis',
    label: 'Hypothesis generated: Cross-attention improves claim extraction by 18%',
    detail: 'Based on 4 evidence paths',
    time: '1d ago',
  },
  {
    type: 'connection',
    label: 'Strong connection: Shannon coding theorem and Hamming distance',
    detail: 'Score: 0.87, 2 shared clusters',
    time: '2d ago',
  },
];

function prefillQuery(item: ActivityItem) {
  const queries: Record<ActivityType, string> = {
    cluster: `Tell me about the ${item.label.replace('New cluster formed: ', '')} cluster`,
    tension: `Explain the tension: ${item.label.replace('Tension detected: ', '')}`,
    hypothesis: `Evaluate the hypothesis: ${item.label.replace('Hypothesis generated: ', '')}`,
    connection: `How are ${item.label.replace('Strong connection: ', '').replace(' and ', ' connected to ')}?`,
  };
  window.dispatchEvent(
    new CustomEvent('theseus:prefill-ask', { detail: { query: queries[item.type] } }),
  );
}

export default function GraphActivity() {
  return (
    <div className="graph-activity-wrapper">
      <div className="graph-activity-divider" />
      <div className="graph-activity">
        <h2 className="graph-activity-header">Graph Activity</h2>
        <div className="graph-activity-feed">
          {PLACEHOLDER_ACTIVITY.map((item, i) => (
            <button
              key={i}
              type="button"
              className="graph-activity-item"
              onClick={() => prefillQuery(item)}
            >
              <span className={`graph-activity-dot graph-activity-dot-${item.type}`} aria-hidden="true" />
              <span className="graph-activity-content">
                <span className="graph-activity-label">{item.label}</span>
                <span className="graph-activity-meta">
                  <span className={`graph-activity-type graph-activity-type-${item.type}`}>
                    {item.type}
                  </span>
                  <span className="graph-activity-sep">&middot;</span>
                  <span>{item.detail}</span>
                  <span className="graph-activity-sep">&middot;</span>
                  <span>{item.time}</span>
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
