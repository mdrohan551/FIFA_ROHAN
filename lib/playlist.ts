import { promises as fs } from "fs";
import path from "path";

export type Channel = {
  id: string;
  number: number;
  name: string;
  url: string;
  group: string;
  country?: string;
  quality?: string;
  logo?: string;
  host: string;
};

const PLAYLIST_FILE = "Fifa world cup.m3u";

const countryNames: Record<string, string> = {
  "🇦🇱": "Albania",
  "🇦🇷": "Argentina",
  "🇦🇹": "Austria",
  "🇧🇬": "Bulgaria",
  "🇧🇷": "Brazil",
  "🇨🇱": "Chile",
  "🇨🇴": "Colombia",
  "🇨🇿": "Czechia",
  "🇩🇪": "Germany",
  "🇪🇸": "Spain",
  "🇫🇷": "France",
  "🇬🇧": "United Kingdom",
  "🇭🇰": "Hong Kong",
  "🇭🇺": "Hungary",
  "🇮🇳": "India",
  "🇮🇱": "Israel",
  "🇮🇹": "Italy",
  "🇲🇴": "Macau",
  "🇲🇽": "Mexico",
  "🇳🇱": "Netherlands",
  "🇳🇴": "Norway",
  "🇵🇹": "Portugal",
  "🇶🇦": "Qatar",
  "🇷🇴": "Romania",
  "🇷🇺": "Russia",
  "🇸🇦": "Saudi Arabia",
  "🇹🇲": "Turkmenistan",
  "🇹🇷": "Turkey",
  "🇺🇦": "Ukraine"
};

const groupPatterns: Array<[RegExp, string]> = [
  [/^(AR\s*\||.*\bARG\b|.*Argentina|.*🇦🇷)/i, "Argentina"],
  [/^(MX\s*\||.*Mexico|.*🇲🇽)/i, "Mexico"],
  [/^(USA\s*\||.*NBC|.*NBA|.*Fox Soccer|.*Universo)/i, "USA"],
  [/Latino|TUDN|Claro|Telemundo|Azteca|Win Sports|TyC|Tigo/i, "Latino"],
  [/ESPN/i, "ESPN"],
  [/FOX/i, "Fox"],
  [/beIN|BEIN/i, "beIN"],
  [/DAZN/i, "DAZN"],
  [/SKY|Sky/i, "Sky"],
  [/Матч|Setanta|OTT|🇷🇺/i, "Eastern Europe"],
  [/SPORT|Sports|Sport|Deportes|Futbol|Football|Golf|Liga|LALIGA/i, "Sports"]
];

function parseAttributes(value: string) {
  const attributes: Record<string, string> = {};
  const pattern = /([\w-]+)="([^"]*)"/g;
  let match = pattern.exec(value);

  while (match) {
    attributes[match[1]] = match[2];
    match = pattern.exec(value);
  }

  return attributes;
}

function hash(value: string) {
  let current = 0;

  for (let index = 0; index < value.length; index += 1) {
    current = (current << 5) - current + value.charCodeAt(index);
    current |= 0;
  }

  return Math.abs(current).toString(36);
}

function cleanName(value: string) {
  return value
    .replace(/^✔️\s*/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function inferCountry(name: string) {
  const flag = Object.keys(countryNames).find((emoji) => name.includes(emoji));
  if (flag) {
    return countryNames[flag];
  }

  if (/\b(ARG|AR)\b/i.test(name)) return "Argentina";
  if (/\b(MX)\b/i.test(name)) return "Mexico";
  if (/\b(USA)\b/i.test(name)) return "USA";
  if (/Latino/i.test(name)) return "Latin America";

  return undefined;
}

function inferGroup(name: string, groupTitle?: string) {
  if (groupTitle?.trim()) {
    return groupTitle.trim();
  }

  const match = groupPatterns.find(([pattern]) => pattern.test(name));
  return match?.[1] ?? "Live Sports";
}

function inferQuality(name: string, url: string) {
  const qualityMatch = name.match(/\b(4K|1080p|720p|480p|HD|SD)\b/i);
  if (qualityMatch) {
    return qualityMatch[1].toUpperCase();
  }

  if (/1080/i.test(url)) return "1080P";
  if (/720/i.test(url)) return "720P";
  if (/mpegts/i.test(url)) return "MPEGTS";

  return "LIVE";
}

export async function getPlaylist(): Promise<Channel[]> {
  const playlistPath = path.join(process.cwd(), PLAYLIST_FILE);
  const playlist = await fs.readFile(playlistPath, "utf8");
  const lines = playlist
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const channels: Channel[] = [];
  let currentInfo: string | undefined;

  for (const line of lines) {
    if (line.startsWith("#EXTINF")) {
      currentInfo = line;
      continue;
    }

    if (line.startsWith("#")) {
      continue;
    }

    if (!currentInfo || !/^https?:\/\//i.test(line)) {
      continue;
    }

    const metadata = currentInfo.replace(/^#EXTINF:-?\d+\s*/i, "");
    const attributes = parseAttributes(metadata);
    const [, fallbackName = "Untitled channel"] = metadata.match(/,(.*)$/) ?? [];
    const name = cleanName(attributes["tvg-name"] || fallbackName);
    const group = inferGroup(name, attributes["group-title"]);
    const url = line;
    const parsedUrl = new URL(url);

    channels.push({
      id: `${hash(`${name}-${url}`)}-${channels.length + 1}`,
      number: channels.length + 1,
      name,
      url,
      group,
      country: inferCountry(name),
      quality: inferQuality(name, url),
      logo: attributes["tvg-logo"],
      host: parsedUrl.hostname.replace(/^www\./, "")
    });

    currentInfo = undefined;
  }

  return channels;
}
