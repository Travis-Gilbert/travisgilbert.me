import SectionLabel from '@/components/SectionLabel';
import RoughLine from '@/components/rough/RoughLine';
import WhereToNextCard from '@/components/WhereToNextCard';
import type { NavigationSuggestion } from '@/lib/connectionEngine';

interface WhereToNextProps {
  suggestions: NavigationSuggestion[];
}

export default function WhereToNext({ suggestions }: WhereToNextProps) {
  if (suggestions.length === 0) return null;

  return (
    <section className="mt-8 mb-4">
      <SectionLabel color="terracotta">WHERE TO NEXT</SectionLabel>
      <RoughLine className="my-3" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-4">
        {suggestions.map((s) => (
          <WhereToNextCard key={s.connection.slug} suggestion={s} />
        ))}
      </div>
    </section>
  );
}
