export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type MapViewport = {
  center: Coordinates;
  zoom: number;
};

export type MapMarker = {
  id: string;
  position: Coordinates;
  label?: string;
};
