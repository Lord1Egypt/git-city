import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/lib/leagues/service";
import { getBoard, getMyRow } from "@/lib/drift/board";
import { SPOTS } from "@/lib/drift/spots";
import type { LiveSpot } from "@/lib/drift/spots/types";
import { CODE_RE, SEAT_TTL_MS, roomId, signSeat } from "@/lib/drift/ticket";
import RoomClient, { type RoomSpotData } from "./room-client";

export const dynamic = "force-dynamic";

const seatExpiry = () => Date.now() + SEAT_TTL_MS;

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const title = "Drift with friends - Git City";
  const description = `Room ${code.toUpperCase()}: three runs, points by place, the most points wins.`;
  return { title, description, openGraph: { title, description }, twitter: { card: "summary", title, description } };
}

// A room with friends: GitHub logins only. The page signs the viewer's seat
// (lib/drift/ticket) and loads both spots' boards, since the room can move
// between them.
export default async function DriftRoomPage({ params }: Props) {
  const { code: raw } = await params;
  const code = raw.toUpperCase();
  if (!CODE_RE.test(code)) notFound();
  if (raw !== code) redirect(`/drift/r/${code}`);
  const viewer = await getViewer();
  if (!viewer) redirect(`/api/auth/github?redirect=${encodeURIComponent(`/drift/r/${code}`)}`);
  const secret = process.env.FORCE_PUSH_HMAC_SECRET;
  if (!secret || secret.length < 32) throw new Error("FORCE_PUSH_HMAC_SECRET missing");
  const seat = await signSeat({ room: roomId(code), login: viewer.github_login, exp: seatExpiry() }, secret);
  const live = SPOTS.filter((s): s is LiveSpot => s.status === "live");
  const spots = Object.fromEntries(
    await Promise.all(
      live.map(async (s): Promise<[string, RoomSpotData]> => {
        const [board, me] = await Promise.all([getBoard(s.id, "world", 50), getMyRow(s.id, viewer.id)]);
        return [s.id, { boardScores: board.map((r) => r.score), board: board.map((r) => ({ rank: r.rank, login: r.login, score: r.score })), myBest: me?.score ?? null }];
      }),
    ),
  );
  return <RoomClient code={code} seat={seat} viewerLogin={viewer.github_login} spots={spots} />;
}
