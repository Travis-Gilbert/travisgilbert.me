'use client';

import ProjectCard from './ProjectCard';
import { TOP_ROW, MIDDLE_ROW, BOTTOM_ROW } from './projects-data';

/*
 * Pyramid layout: each row progressively wider.
 *   Row 1 (2-col): moderate bleed into margins
 *   Rows 2+3 (3-col): deeper bleed
 * On mobile (single column), no bleed is applied.
 */
const TOP_BLEED = 'md:-mx-[5vw]';
const BOTTOM_BLEED = 'md:-mx-[12vw]';

export default function ProjectGrid() {
  return (
    <div>
      {/* Row 1: 2-column, moderate bleed */}
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 mb-6 ${TOP_BLEED}`}>
        {TOP_ROW.map((p, i) => (
          <ProjectCard key={p.slug} data={p} delay={i * 100} />
        ))}
      </div>

      {/* Row 2: 3-column, deeper bleed */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 md:gap-6 mb-6 ${BOTTOM_BLEED}`}>
        {MIDDLE_ROW.map((p, i) => (
          <ProjectCard key={p.slug} data={p} delay={(i + 2) * 100} />
        ))}
      </div>

      {/* Row 3: 3-column, same deep bleed */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 md:gap-6 ${BOTTOM_BLEED}`}>
        {BOTTOM_ROW.map((p, i) => (
          <ProjectCard key={p.slug} data={p} delay={(i + 5) * 100} />
        ))}
      </div>
    </div>
  );
}
