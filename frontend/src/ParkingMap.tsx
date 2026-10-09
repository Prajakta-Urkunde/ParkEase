import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";

import L from "leaflet";
import { useEffect } from "react";

import "leaflet/dist/leaflet.css";

delete (
  L.Icon.Default.prototype as L.Icon.Default & {
    _getIconUrl?: unknown;
  }
)._getIconUrl;

L.Icon.Default.mergeOptions({
  iconRetinaUrl: "/images/leaflet/marker-icon-2x.png",
  iconUrl: "/images/leaflet/marker-icon.png",
  shadowUrl: "/images/leaflet/marker-shadow.png",
});

type ParkingLot = {
  id: number;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  total_slots: number;
  available_slots: number;
};

type ParkingMapProps = {
  lots: ParkingLot[];
  selectedLot: ParkingLot | null;
  onSelectLot: (lot: ParkingLot) => void;
};

function MapCenter({
  selectedLot,
}: {
  selectedLot: ParkingLot | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (
      selectedLot?.latitude !== null &&
      selectedLot?.longitude !== null &&
      selectedLot?.latitude !== undefined &&
      selectedLot?.longitude !== undefined
    ) {
      map.setView(
        [
          selectedLot.latitude,
          selectedLot.longitude,
        ],
        16
      );
    }
  }, [selectedLot, map]);

  return null;
}

function ParkingMap({
  lots,
  selectedLot,
  onSelectLot,
}: ParkingMapProps) {
  const validLots = lots.filter(
    (lot) =>
      lot.latitude !== null &&
      lot.longitude !== null
  );

  const defaultPosition: [number, number] =
    validLots.length > 0
      ? [
          validLots[0].latitude!,
          validLots[0].longitude!,
        ]
      : [18.5204, 73.8567];

  return (
    <MapContainer
      center={defaultPosition}
      zoom={14}
      aria-label="Parking locations map"
      style={{
        height: "clamp(300px, 45vw, 450px)",
        width: "100%",
        borderRadius: "12px",
      }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapCenter selectedLot={selectedLot} />

      {validLots.map((lot) => (
        <Marker
          key={lot.id}
          position={[
            lot.latitude!,
            lot.longitude!,
          ]}
          eventHandlers={{
            click: () => onSelectLot(lot),
          }}
        >
          <Popup>
            <strong>{lot.name}</strong>

            <br />

            {lot.address}

            <br />

            Available:{" "}
            {lot.available_slots}/
            {lot.total_slots}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

export default ParkingMap;
