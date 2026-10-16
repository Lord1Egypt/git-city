"use client";

import { useMemo, useState } from "react";
import type { BoardRowLite } from "@/components/drift/DriftTitle";
import type { SpotId } from "@/lib/drift/spots/types";
import SpotClient from "../../[spot]/spot-client";

// The room follows its series from spot to spot: each spot is its own world
// (SpotClient), mounted fresh when the host moves the room.

export interface RoomSpotData {
  boardScores: number[];
  board: BoardRowLite[];
  myBest: number | null;
}

export default function RoomClient({ code, seat, viewerLogin, spots }: { code: string; seat: string; viewerLogin: string; spots: Record<string, RoomSpotData> }) {
  const [spot, setSpot] = useState<SpotId>("harbor");
  const room = useMemo(() => ({ code, seat, onSpot: setSpot }), [code, seat]);
  const data = spots[spot];
  return (
    <SpotClient
      key={spot}
      spotId={spot}
      viewerLogin={viewerLogin}
      boardScores={data.boardScores}
      board={data.board}
      myBest={data.myBest}
      rivalLogin={null}
      challenger={null}
      room={room}
    />
  );
}
