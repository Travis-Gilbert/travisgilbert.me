interface EngineRelevancePipProps {
  isRelevant: boolean;
}

export default function EngineRelevancePip({ isRelevant }: EngineRelevancePipProps) {
  if (!isRelevant) return null;

  return (
    <span
      aria-label="Engine relevant"
      style={{
        position: 'absolute',
        top: 6,
        right: 6,
        width: 5,
        height: 5,
        borderRadius: '50%',
        backgroundColor: 'rgba(45, 95, 107, 0.4)',
        pointerEvents: 'none',
      }}
    />
  );
}
