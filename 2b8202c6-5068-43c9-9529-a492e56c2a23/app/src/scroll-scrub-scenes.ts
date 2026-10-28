import type { ScrollScrubScene, ScrollScrubTheme } from "@/components/scroll-scrub/scroll-scrub";

export const scrollScrubTheme: ScrollScrubTheme = {
  accent: "#8BAE9D",
  background: "#091411",
  ink: "#F2F7F2",
  muted: "#B1C1B6",
};

export const scrollScrubScenes: ScrollScrubScene[] = [
  {
    id: "make-the-web-useful",
    label: "The hub",
    poster: "/assets/world/scene-01-poster.png",
    clip: "/assets/world/scene-01.mp4",
    mobilePoster: "/assets/world/scene-01-mobile-poster.png",
    mobileClip: "/assets/world/scene-01-mobile.mp4",
    title: "Make the web useful.",
    body: "A focused collection of small tools that help you get from question to answer, without the clutter.",
    kicker: "A calmer kind of toolbox",
    tags: ["Free to use"],
    scroll: 1.2,
    align: "left",
  },
  {
    id: "small-tools-clear-answers",
    label: "The details",
    poster: "/assets/world/scene-02-poster.png",
    clip: "/assets/world/scene-02.mp4",
    mobilePoster: "/assets/world/scene-02-mobile-poster.png",
    mobileClip: "/assets/world/scene-02-mobile.mp4",
    title: "Small tools. Clear answers.",
    body: "Format text, convert values, calculate everyday numbers, and make quick checks in one tidy workspace.",
    kicker: "Useful by design",
    tags: ["Fast workflows", "Simple controls"],
    scroll: 1.2,
    align: "right",
  },
  {
    id: "find-your-shortcut",
    label: "Your shortcut",
    poster: "/assets/world/scene-03-poster.png",
    clip: "/assets/world/scene-03.mp4",
    mobilePoster: "/assets/world/scene-03-mobile-poster.png",
    mobileClip: "/assets/world/scene-03-mobile.mp4",
    title: "Find your next shortcut.",
    body: "Search the library, pick a tool, and keep moving. Your next useful little answer is a few clicks away.",
    kicker: "One search away",
    tags: ["90+ tools", "Mobile ready"],
    scroll: 1.1,
    align: "left",
  },
];
