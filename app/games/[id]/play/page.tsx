import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { GAMES } from "@/lib/games";
import GamePlayer from "@/components/GamePlayer";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const game = GAMES.find((g) => g.id === id);
  if (!game) return {};
  return { title: `Jugando ${game.title} · Arcade Vault` };
}

export default async function GamePlayPage({ params }: Props) {
  const { id } = await params;
  const game = GAMES.find((g) => g.id === id);
  if (!game) notFound();

  return <GamePlayer game={game} />;
}
