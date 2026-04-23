import SimulationPart from '@/components/theseus/chat/parts/SimulationPart';
import type { SimulationPayload } from '@/lib/theseus-viz/SceneDirective';

const payload: SimulationPayload = {
  domain: 'hardware',
  intent: {
    bom_total: 500,
    thermal_total_w: 30,
  },
  primitives: [
    {
      id: 'cpu',
      kind: 'CPU',
      metadata: {
        title: 'RK3588 compute module',
        cost_usd: 92,
        power_w: 10.5,
        thermal_w: 10.5,
        lane_budget: 8,
      },
      provenance_object_ids: [101],
    },
    {
      id: 'npu',
      kind: 'NPU',
      metadata: {
        title: 'Hailo inference card',
        cost_usd: 124,
        power_w: 6.8,
        thermal_w: 6.8,
        lane_budget: 4,
      },
      provenance_object_ids: [202],
    },
    {
      id: 'ram',
      kind: 'RAM',
      metadata: {
        title: 'System memory',
        cost_usd: 42,
        power_w: 2.4,
        thermal_w: 1.3,
        lane_budget: 0,
      },
      provenance_object_ids: [303],
    },
    {
      id: 'storage',
      kind: 'Storage',
      metadata: {
        title: 'NVMe storage',
        cost_usd: 56,
        power_w: 1.8,
        thermal_w: 1.2,
        lane_budget: 2,
      },
      provenance_object_ids: [404],
    },
    {
      id: 'network',
      kind: 'Networking',
      metadata: {
        title: 'Peer networking fabric',
        cost_usd: 34,
        power_w: 1.4,
        thermal_w: 0.9,
        lane_budget: 1,
      },
      provenance_object_ids: [505],
    },
    {
      id: 'power',
      kind: 'Power',
      metadata: {
        title: 'DC input stage',
        cost_usd: 36,
        power_w: 0,
        thermal_w: 0.6,
        lane_budget: 0,
      },
      provenance_object_ids: [606],
    },
    {
      id: 'enclosure',
      kind: 'Enclosure',
      metadata: {
        title: 'Passive enclosure',
        cost_usd: 48,
        power_w: 0,
        thermal_w: 2.1,
        lane_budget: 0,
      },
      provenance_object_ids: [707],
    },
    {
      id: 'cooling',
      kind: 'Cooling',
      metadata: {
        title: 'Thermal spreader',
        cost_usd: 22,
        power_w: 0,
        thermal_w: 6.6,
        lane_budget: 0,
      },
      provenance_object_ids: [808],
    },
  ],
  relations: [
    { from_id: 'power', to_id: 'cpu', relation_kind: 'power_rail' },
    { from_id: 'power', to_id: 'npu', relation_kind: 'power_rail' },
    { from_id: 'power', to_id: 'ram', relation_kind: 'power_rail' },
    { from_id: 'power', to_id: 'storage', relation_kind: 'power_rail' },
    { from_id: 'power', to_id: 'network', relation_kind: 'power_rail' },
    { from_id: 'cpu', to_id: 'npu', relation_kind: 'data_bus' },
    { from_id: 'cpu', to_id: 'ram', relation_kind: 'data_bus' },
    { from_id: 'cpu', to_id: 'storage', relation_kind: 'data_bus' },
    { from_id: 'cpu', to_id: 'network', relation_kind: 'data_bus' },
    { from_id: 'cpu', to_id: 'cooling', relation_kind: 'thermal_coupling' },
    { from_id: 'npu', to_id: 'cooling', relation_kind: 'thermal_coupling' },
    { from_id: 'cooling', to_id: 'enclosure', relation_kind: 'thermal_coupling' },
  ],
  metadata_slots: ['cost_usd', 'power_w', 'thermal_w', 'lane_budget'],
  render_target: 'mixed',
  pattern_provenance: ['fixture:hardware'],
  scene_id: 'fixture-hardware-scene',
  construction: {
    phases: [
      {
        name: 'simulation_assembles',
        target_ids: ['cpu', 'npu', 'ram', 'storage', 'network', 'power', 'enclosure', 'cooling'],
        targets: [
          { id: 'power', delay_ms: 0 },
          { id: 'cpu', delay_ms: 90 },
          { id: 'npu', delay_ms: 180 },
          { id: 'ram', delay_ms: 240 },
          { id: 'storage', delay_ms: 320 },
          { id: 'network', delay_ms: 380 },
          { id: 'cooling', delay_ms: 460 },
          { id: 'enclosure', delay_ms: 540 },
        ],
        delay_ms: 0,
        duration_ms: 1400,
        easing: 'ease-out',
      },
    ],
    total_duration_ms: 1400,
    theatricality: 0.45,
  },
};

export default function SimulationFixturePage() {
  return (
    <main
      style={{
        maxWidth: 1120,
        margin: '0 auto',
        padding: '48px 24px 80px',
        display: 'grid',
        gap: 20,
      }}
    >
      <div style={{ display: 'grid', gap: 8 }}>
        <h1 style={{ margin: 0, fontSize: 28 }}>Simulation Fixture</h1>
        <p style={{ margin: 0, color: 'var(--color-ink-muted)' }}>
          Click for a tier one summary, double click for streamed re-voice, and drag a primitive past the threshold to remove it from the scene.
        </p>
      </div>
      <SimulationPart payload={payload} />
    </main>
  );
}
