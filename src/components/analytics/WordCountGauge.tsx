interface WordCountGaugeProps {
  totalWords: number;
  averagePerEssay: number;
  totalEssays: number;
  totalFieldNotes: number;
  totalShelfItems: number;
}

export default function WordCountGauge({
  totalWords, averagePerEssay, totalEssays, totalFieldNotes, totalShelfItems,
}: WordCountGaugeProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      <Stat label="Total Words" value={totalWords.toLocaleString()} />
      <Stat label="Avg per Essay" value={averagePerEssay.toLocaleString()} />
      <Stat label="Essays" value={String(totalEssays)} />
      <Stat label="Field Notes" value={String(totalFieldNotes)} />
      <Stat label="Shelf Items" value={String(totalShelfItems)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center py-3">
      <p className="font-title text-2xl text-ink m-0">{value}</p>
      <p className="font-mono text-[10px] uppercase tracking-widest text-ink-light m-0 mt-1">
        {label}
      </p>
    </div>
  );
}
