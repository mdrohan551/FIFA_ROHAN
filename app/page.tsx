import { TvExperience } from "@/components/tv-experience";
import { getPlaylist } from "@/lib/playlist";

export const dynamic = "force-dynamic";

export default async function Home() {
  const channels = await getPlaylist();

  return <TvExperience channels={channels} />;
}
