/**
 * Spacetime Atlas: demo dataset.
 *
 * Real lat/lon coordinates so events project accurately on the globe. Six
 * topics across two modes. This file is consumed ONLY when the user opts
 * in via `?mock=1` on the /spacetime URL, per CLAUDE.md's "no fake UI in
 * shipped surfaces" rule. The naked /spacetime route renders an empty
 * state until the backend lands.
 *
 * Source: ported one-to-one from the Claude Design handoff bundle's
 * `spacetime-data.js`.
 */

import type { SpacetimeTopic } from './types';

export const DEMO_TOPICS: Record<string, SpacetimeTopic> = {
  'sickle-cell-anemia': {
    key: 'sickle-cell-anemia',
    title: 'Sickle Cell Anemia',
    sub: 'Publication clusters, 1910: present',
    sources: 3481,
    span: [1910, 2026],
    mode: 'modern',
    events: [
      { id: 1, city: 'Chicago', lat: 41.88, lon: -87.63, year: 1910, papers: 12, note: 'Herrick describes "peculiar elongated and sickle-shaped" red cells.', accent: 'terracotta' },
      { id: 2, city: 'Memphis', lat: 35.15, lon: -90.05, year: 1949, papers: 32, note: 'Pauling & Itano: "molecular disease": first identified by electrophoresis.', accent: 'terracotta' },
      { id: 3, city: 'London', lat: 51.51, lon: -0.13, year: 1985, papers: 180, note: "Serjeant's long-running Jamaican cohort moves through MRC London.", accent: 'teal' },
      { id: 4, city: 'Chicago', lat: 41.88, lon: -87.63, year: 1994, papers: 410, note: 'Cooperative Study spike: Hb electrophoresis at scale.', accent: 'terracotta' },
      { id: 5, city: 'Accra', lat: 5.60, lon: -0.19, year: 2002, papers: 95, note: "Konotey-Ahulu's genealogical maps of West African pedigrees.", accent: 'teal' },
      { id: 6, city: 'Salvador', lat: -12.97, lon: -38.51, year: 2010, papers: 42, note: 'Bahia hemoglobinopathy registry: Atlantic-crossing genealogies.', accent: 'teal' },
      { id: 7, city: 'Mumbai', lat: 19.08, lon: 72.88, year: 2015, papers: 110, note: 'Tribal-population genotyping at Tata.', accent: 'terracotta' },
      { id: 8, city: 'Tokyo', lat: 35.68, lon: 139.65, year: 2019, papers: 320, note: 'Resurfacing wave: gene-editing crosses over from oncology.', accent: 'terracotta' },
      { id: 9, city: 'Boston', lat: 42.36, lon: -71.06, year: 2021, papers: 280, note: 'Casgevy / exa-cel filings: CRISPR-mediated cure approved.', accent: 'terracotta' },
      { id: 10, city: 'Paris', lat: 48.85, lon: 2.35, year: 2023, papers: 88, note: 'Lentiviral vector trials at Necker.', accent: 'teal' },
    ],
    trace: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  },

  'gene-therapy': {
    key: 'gene-therapy',
    title: 'Gene Therapy',
    sub: 'Publication clusters, 1990: present',
    sources: 6210,
    span: [1990, 2026],
    mode: 'modern',
    events: [
      { id: 1, city: 'Bethesda', lat: 38.98, lon: -77.10, year: 1990, papers: 60, note: 'First approved gene therapy trial: ADA-SCID at NIH.', accent: 'teal' },
      { id: 2, city: 'Philadelphia', lat: 39.95, lon: -75.16, year: 1999, papers: 90, note: 'Jesse Gelsinger trial: field setback, pause on adenoviral vectors.', accent: 'terracotta' },
      { id: 3, city: 'Paris', lat: 48.85, lon: 2.35, year: 2002, papers: 80, note: 'Cavazzana-Calvo SCID-X1 retroviral cure: leukemia complications.', accent: 'teal' },
      { id: 4, city: 'London', lat: 51.51, lon: -0.13, year: 2010, papers: 140, note: 'GSK lentiviral platform: ADA-SCID re-approved.', accent: 'teal' },
      { id: 5, city: 'Boston', lat: 42.36, lon: -71.06, year: 2017, papers: 220, note: 'Luxturna FDA approval: first US gene therapy for inherited disease.', accent: 'terracotta' },
      { id: 6, city: 'Memphis', lat: 35.15, lon: -90.05, year: 2018, papers: 150, note: 'St Jude lentiviral sickle-cell cure trials.', accent: 'terracotta' },
      { id: 7, city: 'Boston', lat: 42.36, lon: -71.06, year: 2021, papers: 380, note: 'Casgevy / exa-cel: CRISPR-edited HSCs cure sickle cell.', accent: 'terracotta' },
      { id: 8, city: 'Paris', lat: 48.85, lon: 2.35, year: 2023, papers: 95, note: 'Necker lentiviral β-globin trials.', accent: 'teal' },
    ],
    trace: [1, 2, 3, 4, 5, 6, 7, 8],
  },

  'crispr': {
    key: 'crispr',
    title: 'CRISPR / Cas Editing',
    sub: 'Publication clusters, 2012: present',
    sources: 12740,
    span: [2012, 2026],
    mode: 'modern',
    events: [
      { id: 1, city: 'Berkeley', lat: 37.87, lon: -122.27, year: 2012, papers: 480, note: 'Doudna & Charpentier: programmable Cas9 cleavage published.', accent: 'terracotta' },
      { id: 2, city: 'Boston', lat: 42.36, lon: -71.06, year: 2013, papers: 520, note: 'Zhang lab demonstrates mammalian editing.', accent: 'terracotta' },
      { id: 3, city: 'Berlin', lat: 52.52, lon: 13.41, year: 2015, papers: 180, note: 'Charpentier moves to Max Planck: European arm forms.', accent: 'teal' },
      { id: 4, city: 'Shenzhen', lat: 22.54, lon: 114.06, year: 2018, papers: 240, note: 'He Jiankui announces edited twins: field destabilizes.', accent: 'terracotta' },
      { id: 5, city: 'Tokyo', lat: 35.68, lon: 139.65, year: 2020, papers: 160, note: 'Base-editing variants from RIKEN.', accent: 'teal' },
      { id: 6, city: 'Cambridge', lat: 52.20, lon: 0.12, year: 2022, papers: 220, note: 'Cambridge prime-editing trials.', accent: 'teal' },
      { id: 7, city: 'Bangalore', lat: 12.97, lon: 77.59, year: 2023, papers: 90, note: 'NIBMG sickle-cell editing program.', accent: 'terracotta' },
      { id: 8, city: 'Boston', lat: 42.36, lon: -71.06, year: 2024, papers: 320, note: 'Casgevy approval cascade.', accent: 'terracotta' },
    ],
    trace: [1, 2, 3, 4, 5, 6, 7, 8],
  },

  'mrna-vaccines': {
    key: 'mrna-vaccines',
    title: 'mRNA Vaccines',
    sub: 'Publication clusters, 1990: present',
    sources: 8920,
    span: [1990, 2026],
    mode: 'modern',
    events: [
      { id: 1, city: 'Philadelphia', lat: 39.95, lon: -75.16, year: 2005, papers: 320, note: 'Karikó & Weissman: pseudouridine modification eliminates immune response.', accent: 'terracotta' },
      { id: 2, city: 'Mainz', lat: 50.00, lon: 8.27, year: 2008, papers: 280, note: 'BioNTech founded: Şahin & Türeci.', accent: 'teal' },
      { id: 3, city: 'Cambridge', lat: 42.36, lon: -71.10, year: 2010, papers: 360, note: 'Moderna spun out of Flagship Pioneering.', accent: 'terracotta' },
      { id: 4, city: 'Tokyo', lat: 35.68, lon: 139.65, year: 2015, papers: 90, note: 'Daiichi-Sankyo lipid-nanoparticle work.', accent: 'teal' },
      { id: 5, city: 'Oxford', lat: 51.75, lon: -1.26, year: 2018, papers: 110, note: 'Oxford Vaccine Institute parallel platforms.', accent: 'teal' },
      { id: 6, city: 'Wuhan', lat: 30.59, lon: 114.31, year: 2020, papers: 240, note: 'Pathogen genome released; design-to-trial in 65 days.', accent: 'terracotta' },
      { id: 7, city: 'Bethesda', lat: 38.98, lon: -77.10, year: 2020, papers: 420, note: 'NIH/Moderna: pandemic vaccine cascade.', accent: 'terracotta' },
      { id: 8, city: 'Pune', lat: 18.52, lon: 73.86, year: 2022, papers: 70, note: 'Gennova self-amplifying mRNA platform.', accent: 'teal' },
    ],
    trace: [1, 2, 3, 4, 5, 6, 7, 8],
  },

  'k-pg-extinction': {
    key: 'k-pg-extinction',
    title: 'K-Pg Mass Extinction',
    sub: 'Specimen plate, 67 → 65 Mya: terrestrial collapse',
    sources: 412,
    span: [-67, -65],
    mode: 'prehistory',
    events: [
      { id: 1, city: 'Hell Creek, MT', lat: 47.64, lon: -106.85, year: -66.05, papers: 88, note: 'Iridium-rich boundary clay; latest non-avian dinosaur fossils.', accent: 'terracotta' },
      { id: 2, city: 'Tanis, ND', lat: 46.22, lon: -103.42, year: -66.04, papers: 70, note: 'DePalma seiche deposit: fish with impact spherules in gills.', accent: 'terracotta' },
      { id: 3, city: 'Chicxulub, MX', lat: 21.40, lon: -89.51, year: -66.00, papers: 320, note: 'Impact crater: 180 km, ~10 km bolide.', accent: 'terracotta' },
      { id: 4, city: 'Bottaccione, IT', lat: 43.36, lon: 12.58, year: -66.00, papers: 60, note: 'Alvarez et al.: first iridium anomaly identified.', accent: 'teal' },
      { id: 5, city: 'Auca Mahuevo, AR', lat: -38.05, lon: -68.93, year: -67.00, papers: 40, note: 'Titanosaur nesting grounds: final clutches.', accent: 'teal' },
      { id: 6, city: 'Lameta Beds, IN', lat: 21.93, lon: 76.93, year: -66.50, papers: 35, note: 'Deccan Traps volcanism: co-stressor on biosphere.', accent: 'terracotta' },
      { id: 7, city: 'Nemegt Basin, MN', lat: 43.50, lon: 101.00, year: -66.80, papers: 50, note: 'Tarbosaurus, Therizinosaurus: Asian fauna pre-boundary.', accent: 'teal' },
      { id: 8, city: 'Karoo Basin, ZA', lat: -32.30, lon: 24.00, year: -65.50, papers: 22, note: 'Earliest Paleocene mammalian recovery fauna.', accent: 'teal' },
    ],
    trace: [5, 1, 2, 3, 4, 6, 7, 8],
  },

  'permian-extinction': {
    key: 'permian-extinction',
    title: 'Permian-Triassic Extinction',
    sub: 'Specimen plate, 253 → 251 Mya: the Great Dying',
    sources: 290,
    span: [-253, -251],
    mode: 'prehistory',
    events: [
      { id: 1, city: 'Siberian Traps', lat: 67.00, lon: 102.00, year: -252.0, papers: 240, note: 'Continental flood basalts: primary kill mechanism.', accent: 'terracotta' },
      { id: 2, city: 'Meishan, CN', lat: 31.05, lon: 119.70, year: -251.9, papers: 180, note: 'GSSP boundary section: defines the P-T transition.', accent: 'terracotta' },
      { id: 3, city: 'Karoo, ZA', lat: -32.30, lon: 24.00, year: -252.5, papers: 75, note: 'Lystrosaurus assemblage zone: disaster taxon survival.', accent: 'teal' },
      { id: 4, city: 'Dolomites, IT', lat: 46.40, lon: 11.85, year: -252.0, papers: 40, note: 'Werfen Formation carbonates record CO₂ acidification.', accent: 'teal' },
      { id: 5, city: 'Allan Hills, AQ', lat: -76.72, lon: 159.66, year: -252.0, papers: 22, note: 'Glossopterid forests: abrupt termination.', accent: 'teal' },
      { id: 6, city: 'Salt Range, PK', lat: 32.65, lon: 72.65, year: -252.2, papers: 18, note: 'Marine extinction: 96% of species lost.', accent: 'terracotta' },
    ],
    trace: [1, 2, 6, 4, 3, 5],
  },
};

export const DEMO_TOPIC_KEYS_BY_MODE: Record<'modern' | 'prehistory', string[]> = {
  modern: ['sickle-cell-anemia', 'gene-therapy', 'crispr', 'mrna-vaccines'],
  prehistory: ['k-pg-extinction', 'permian-extinction'],
};

export const DEMO_TOPIC_KEYS_ALL = [
  ...DEMO_TOPIC_KEYS_BY_MODE.modern,
  ...DEMO_TOPIC_KEYS_BY_MODE.prehistory,
];

/**
 * Loose match: accepts the slug, the lower-cased title, or any partial
 * substring. Returns the canonical key or null.
 */
export function findDemoTopicKey(query: string): string | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  if (DEMO_TOPICS[q]) return q;
  // exact match by lowered title
  const byTitle = Object.values(DEMO_TOPICS).find(t => t.title.toLowerCase() === q);
  if (byTitle) return byTitle.key;
  // substring match on key or title
  return (
    Object.values(DEMO_TOPICS).find(t => t.key.includes(q) || q.includes(t.key))?.key
    ?? Object.values(DEMO_TOPICS).find(t => t.title.toLowerCase().includes(q))?.key
    ?? null
  );
}
