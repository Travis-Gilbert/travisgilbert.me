/**
 * Measures the Y offset of each paragraph in a prose container,
 * relative to the container's top edge.
 *
 * Must be called after document.fonts.ready because Caveat (the annotation
 * font) and Vollkorn (the prose title font) load asynchronously and affect
 * line heights, which shifts paragraph positions.
 *
 * Returns a Map from 1-based paragraph index to pixel Y offset.
 * Index convention matches injectAnnotations() in content.ts.
 */
export function measureParagraphOffsets(
  container: HTMLElement
): Map<number, number> {
  const paragraphs = Array.from(container.querySelectorAll('p'));
  const containerTop = container.getBoundingClientRect().top + window.scrollY;
  const map = new Map<number, number>();

  paragraphs.forEach((p, i) => {
    const rect = p.getBoundingClientRect();
    const absoluteTop = rect.top + window.scrollY;
    map.set(i + 1, absoluteTop - containerTop);
  });

  return map;
}
