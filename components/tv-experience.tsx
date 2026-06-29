"use client";

import Hls from "hls.js";
import {
  BadgeCheck,
  Clock3,
  Compass,
  Expand,
  Heart,
  History,
  ListVideo,
  Play,
  Radio,
  Search,
  Signal,
  Sparkles,
  Star,
  Tv,
  Volume2,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Channel } from "@/lib/playlist";

type TvExperienceProps = {
  channels: Channel[];
};

const MAX_RECENTS = 12;

const storage = {
  favorites: "livetv:favorites",
  recents: "livetv:recents"
};

function readList(key: string) {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as string[]) : [];
  } catch {
    return [];
  }
}

function writeList(key: string, value: string[]) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function channelInitials(name: string) {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "TV";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

function accentIndex(value: string) {
  let sum = 0;
  for (const char of value) {
    sum += char.charCodeAt(0);
  }
  return (sum % 6) + 1;
}

function nowLabel() {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date());
}

export function TvExperience({ channels }: TvExperienceProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [activeChannelId, setActiveChannelId] = useState(channels[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState("All");
  const [view, setView] = useState<"browse" | "guide">("browse");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recents, setRecents] = useState<string[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [playError, setPlayError] = useState("");
  const [clock, setClock] = useState(nowLabel);
  const [showPlayerChrome, setShowPlayerChrome] = useState(true);
  const chromeTimerRef = useRef<number | undefined>(undefined);

  const activeChannel = useMemo(
    () => channels.find((channel) => channel.id === activeChannelId) ?? channels[0],
    [activeChannelId, channels]
  );

  const groups = useMemo(() => {
    const counts = channels.reduce<Record<string, number>>((result, channel) => {
      result[channel.group] = (result[channel.group] ?? 0) + 1;
      return result;
    }, {});

    return [
      ["All", channels.length] as const,
      ["Favorites", favorites.length] as const,
      ...Object.entries(counts).sort((first, second) => second[1] - first[1])
    ];
  }, [channels, favorites.length]);

  const recentChannels = useMemo(
    () =>
      recents
        .map((id) => channels.find((channel) => channel.id === id))
        .filter((channel): channel is Channel => Boolean(channel)),
    [channels, recents]
  );

  const filteredChannels = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return channels.filter((channel) => {
      const matchesGroup =
        activeGroup === "All" ||
        (activeGroup === "Favorites" && favorites.includes(channel.id)) ||
        channel.group === activeGroup;
      const matchesQuery =
        !normalizedQuery ||
        [channel.name, channel.group, channel.country, channel.host]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedQuery));

      return matchesGroup && matchesQuery;
    });
  }, [activeGroup, channels, favorites, query]);

  useEffect(() => {
    setFavorites(readList(storage.favorites));
    setRecents(readList(storage.recents));
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(nowLabel()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (chromeTimerRef.current) {
        window.clearTimeout(chromeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setShowPlayerChrome(true);

    if (chromeTimerRef.current) {
      window.clearTimeout(chromeTimerRef.current);
    }

    chromeTimerRef.current = window.setTimeout(() => {
      setShowPlayerChrome(false);
    }, 2600);
  }, [activeChannelId]);

  useEffect(() => {
    if (!activeChannel || !videoRef.current) {
      return;
    }

    const video = videoRef.current;
    setPlayError("");
    hlsRef.current?.destroy();
    hlsRef.current = null;
    video.pause();
    video.removeAttribute("src");
    video.load();

    if (Hls.isSupported()) {
      const hls = new Hls({
        lowLatencyMode: true,
        backBufferLength: 60,
        enableWorker: true
      });

      hlsRef.current = hls;
      hls.loadSource(activeChannel.url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => undefined);
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          setPlayError("This stream did not respond in the browser. Try another channel.");
        }
      });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = activeChannel.url;
      video.play().catch(() => undefined);
    } else {
      setPlayError("Your browser cannot play HLS streams directly.");
    }

    setRecents((current) => {
      const next = [activeChannel.id, ...current.filter((id) => id !== activeChannel.id)].slice(
        0,
        MAX_RECENTS
      );
      writeList(storage.recents, next);
      return next;
    });

    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [activeChannel]);

  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);

  function revealPlayerChrome() {
    setShowPlayerChrome(true);

    if (chromeTimerRef.current) {
      window.clearTimeout(chromeTimerRef.current);
    }

    chromeTimerRef.current = window.setTimeout(() => {
      setShowPlayerChrome(false);
    }, 2600);
  }

  function selectChannel(channel: Channel) {
    setActiveChannelId(channel.id);
    revealPlayerChrome();
  }

  function toggleFavorite(channelId: string) {
    setFavorites((current) => {
      const next = current.includes(channelId)
        ? current.filter((id) => id !== channelId)
        : [channelId, ...current];
      writeList(storage.favorites, next);
      return next;
    });
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }

  function toggleFullscreen() {
    const player = document.querySelector(".player-shell");
    if (player instanceof HTMLElement) {
      player.requestFullscreen?.();
    }
  }

  if (!activeChannel) {
    return (
      <main className="empty-state">
        <Tv aria-hidden="true" />
        <h1>No channels found</h1>
        <p>Keep your M3U file in the project root and restart the app.</p>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <section className="watch-stage" aria-label="Live player">
        <div className="topbar">
          <div className="brand">
            <span className="brand-mark">
              <Tv size={22} aria-hidden="true" />
            </span>
            <span>ROHAN MOHAMMAD LIVE TV</span>
            <span className="text-xs">ROHAN full stack next js and mern ai ml dev.</span>
          </div>
          <div className="topbar-meta">
            <span>{clock}</span>
            <span>{channels.length} channels</span>
          </div>
        </div>

        <div className="player-grid">
          <div
            className={
              showPlayerChrome || playError ? "player-shell is-chrome-visible" : "player-shell"
            }
            onClick={revealPlayerChrome}
            onFocusCapture={revealPlayerChrome}
            onMouseMove={revealPlayerChrome}
            onTouchStart={revealPlayerChrome}
          >
            <video ref={videoRef} muted={isMuted} controls playsInline />
            <div className="ambient ambient-one" />
            <div className="ambient ambient-two" />
            {playError ? (
              <div className="player-error">
                <Signal size={30} aria-hidden="true" />
                <span>{playError}</span>
              </div>
            ) : null}
            <div className="player-overlay">
              <div>
                <span className="eyebrow">
                  <Radio size={14} aria-hidden="true" />
                  Live now
                </span>
                <h1>{activeChannel.name}</h1>
                <p>
                  Channel {activeChannel.number.toString().padStart(3, "0")} ·{" "}
                  {activeChannel.group} · {activeChannel.quality}
                </p>
              </div>
              <div className="player-actions">
                <button
                  type="button"
                  className={favoriteSet.has(activeChannel.id) ? "icon-button is-active" : "icon-button"}
                  onClick={() => toggleFavorite(activeChannel.id)}
                  aria-label="Toggle favorite"
                  title="Favorite"
                >
                  <Heart size={19} fill="currentColor" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={toggleMute}
                  aria-label="Toggle mute"
                  title="Mute"
                >
                  <Volume2 size={19} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={toggleFullscreen}
                  aria-label="Fullscreen"
                  title="Fullscreen"
                >
                  <Expand size={19} aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          <aside className="now-panel" aria-label="Current channel details">
            <div className={`channel-mark accent-${accentIndex(activeChannel.name)}`}>
              {activeChannel.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={activeChannel.logo} alt="" />
              ) : (
                <span>{channelInitials(activeChannel.name)}</span>
              )}
            </div>
            <span className="eyebrow">
              <BadgeCheck size={14} aria-hidden="true" />
              Signal source
            </span>
            <h2>{activeChannel.name}</h2>
            <dl>
              <div>
                <dt>Group</dt>
                <dd>{activeChannel.group}</dd>
              </div>
              <div>
                <dt>Region</dt>
                <dd>{activeChannel.country ?? "Global"}</dd>
              </div>
              <div>
                <dt>Host</dt>
                <dd>{activeChannel.host}</dd>
              </div>
            </dl>
          </aside>
        </div>
      </section>

      <section className="control-surface" aria-label="Channel browser">
        <div className="toolbar">
          <div className="search-box">
            <Search size={18} aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search channels, regions, hosts"
              aria-label="Search channels"
            />
            {query ? (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear search" title="Clear">
                <X size={16} aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <div className="segmented" aria-label="View mode">
            <button
              type="button"
              className={view === "browse" ? "selected" : ""}
              onClick={() => setView("browse")}
            >
              <ListVideo size={16} aria-hidden="true" />
              Browse
            </button>
            <button
              type="button"
              className={view === "guide" ? "selected" : ""}
              onClick={() => setView("guide")}
            >
              <Compass size={16} aria-hidden="true" />
              Guide
            </button>
          </div>
        </div>

        <div className="group-strip" aria-label="Channel groups">
          {groups.map(([group, count]) => (
            <button
              key={group}
              type="button"
              className={activeGroup === group ? "selected" : ""}
              onClick={() => setActiveGroup(group)}
            >
              <span>{group}</span>
              <b>{count}</b>
            </button>
          ))}
        </div>

        {recentChannels.length > 0 ? (
          <section className="rail" aria-label="Recently watched">
            <div className="section-heading">
              <History size={17} aria-hidden="true" />
              <h2>Recently watched</h2>
            </div>
            <div className="mini-channel-row">
              {recentChannels.map((channel) => (
                <button
                  key={channel.id}
                  type="button"
                  className={channel.id === activeChannel.id ? "mini-channel selected" : "mini-channel"}
                  onClick={() => selectChannel(channel)}
                >
                  <span className={`mini-mark accent-${accentIndex(channel.name)}`}>
                    {channelInitials(channel.name)}
                  </span>
                  <span>{channel.name}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {view === "browse" ? (
          <section className="channel-grid" aria-label="Channels">
            {filteredChannels.map((channel) => (
              <article
                key={channel.id}
                className={channel.id === activeChannel.id ? "channel-card selected" : "channel-card"}
              >
                <button type="button" className="channel-main" onClick={() => selectChannel(channel)}>
                  <span className={`channel-mark small accent-${accentIndex(channel.name)}`}>
                    {channel.logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={channel.logo} alt="" />
                    ) : (
                      <span>{channelInitials(channel.name)}</span>
                    )}
                  </span>
                  <span className="channel-copy">
                    <strong>{channel.name}</strong>
                    <span>
                      {channel.group} · {channel.quality}
                    </span>
                  </span>
                  <span className="play-dot">
                    <Play size={15} fill="currentColor" aria-hidden="true" />
                  </span>
                </button>
                <button
                  type="button"
                  className={favoriteSet.has(channel.id) ? "favorite-button active" : "favorite-button"}
                  onClick={() => toggleFavorite(channel.id)}
                  aria-label={`Favorite ${channel.name}`}
                  title="Favorite"
                >
                  <Star size={17} fill="currentColor" aria-hidden="true" />
                </button>
              </article>
            ))}
          </section>
        ) : (
          <section className="guide-table" aria-label="Live guide">
            {filteredChannels.map((channel, index) => (
              <button
                key={channel.id}
                type="button"
                className={channel.id === activeChannel.id ? "guide-row selected" : "guide-row"}
                onClick={() => selectChannel(channel)}
              >
                <span className="guide-number">{channel.number.toString().padStart(3, "0")}</span>
                <span className={`mini-mark accent-${accentIndex(channel.name)}`}>
                  {channelInitials(channel.name)}
                </span>
                <span className="guide-name">{channel.name}</span>
                <span className="guide-program">
                  <Clock3 size={15} aria-hidden="true" />
                  Live coverage block {((index % 4) + 1).toString()}
                </span>
                <span className="guide-spark">
                  <Sparkles size={15} aria-hidden="true" />
                  {channel.quality}
                </span>
              </button>
            ))}
          </section>
        )}

        {filteredChannels.length === 0 ? (
          <div className="no-results">
            <Search size={30} aria-hidden="true" />
            <h2>No matching channels</h2>
            <p>Try a different search or group.</p>
          </div>
        ) : null}
      </section>
    </main>
  );
}
