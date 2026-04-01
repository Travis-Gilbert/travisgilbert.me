/** Remove all child nodes from a container (safe alternative to innerHTML) */
export function clearContainer(el: HTMLElement) {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}
