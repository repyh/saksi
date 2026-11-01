export const MAP_SEARCH_EVENT = "saksi:map-search";

export function dispatchMapSearch(query: string) {
  window.dispatchEvent(new CustomEvent<string>(MAP_SEARCH_EVENT, { detail: query }));
}
