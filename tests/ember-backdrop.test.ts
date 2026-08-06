import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  selectEmberPlaybackAction,
  selectEmberPlaybackPolicy,
} from "../components/queueproof/ember-backdrop";

describe("Ember backdrop", () => {
  const wrapper = readFileSync(join(process.cwd(), "components/queueproof/ember-backdrop.tsx"), "utf8");
  const primitive = readFileSync(join(process.cwd(), "components/ui/ember.tsx"), "utf8");
  const css = readFileSync(join(process.cwd(), "components/queueproof/ember-backdrop.module.css"), "utf8");
  const app = readFileSync(join(process.cwd(), "app/QueueProofApp.tsx"), "utf8");
  const appCss = readFileSync(join(process.cwd(), "app/ember-assistant.css"), "utf8");

  it("keeps video opt-in under motion, data, network, and mobile constraints", () => {
    const baseline = {
      reducedMotion: false,
      saveData: false,
      slowConnection: false,
      smallViewport: false,
    };

    expect(selectEmberPlaybackPolicy(baseline)).toBe("video");
    expect(selectEmberPlaybackPolicy({ ...baseline, reducedMotion: true })).toBe("fallback-reduced-motion");
    expect(selectEmberPlaybackPolicy({ ...baseline, saveData: true })).toBe("fallback-data-saver");
    expect(selectEmberPlaybackPolicy({ ...baseline, slowConnection: true })).toBe("fallback-slow-connection");
    expect(selectEmberPlaybackPolicy({ ...baseline, smallViewport: true })).toBe("fallback-mobile");
  });

  it("defers the source, pauses off-screen, and cleans up observers, listeners, and timers", () => {
    expect(selectEmberPlaybackAction({
      inView: false,
      pageVisible: true,
      policy: "video",
      sourceAttached: false,
    })).toBe("defer");
    expect(selectEmberPlaybackAction({
      inView: false,
      pageVisible: true,
      policy: "video",
      sourceAttached: true,
    })).toBe("pause");
    expect(selectEmberPlaybackAction({
      inView: true,
      pageVisible: false,
      policy: "video",
      sourceAttached: true,
    })).toBe("pause");
    expect(selectEmberPlaybackAction({
      inView: true,
      pageVisible: true,
      policy: "video",
      sourceAttached: false,
    })).toBe("play");
    expect(selectEmberPlaybackAction({
      inView: true,
      pageVisible: true,
      policy: "fallback-data-saver",
      sourceAttached: false,
    })).toBe("fallback");
    expect(wrapper).toContain("new IntersectionObserver");
    expect(wrapper).toContain("video.pause()");
    expect(wrapper).toContain("video.src = EMBER_VIDEO_SRC");
    expect(wrapper).toContain('video.addEventListener("error", fail)');
    expect(wrapper).toContain("observer?.disconnect()");
    expect(wrapper).toContain("clearDeferredTimer()");
    expect(wrapper).toContain("clearLoadTimer()");
    expect(wrapper).not.toContain("requestAnimationFrame");
    expect(wrapper).not.toContain("setInterval");
  });

  it("keeps the poster after a media failure while retaining a local fallback", () => {
    expect(primitive).toContain("EMBER_POSTER_SRC");
    expect(wrapper).toContain("video.poster = EMBER_POSTER_SRC");
    expect(wrapper).toContain("releaseSource({ keepPoster: true })");
    expect(css).toContain(".fallback");
  });

  it("is decorative and pointer-inert by default with stable CSS fallback geometry", () => {
    expect(wrapper).toContain("decorative = true");
    expect(wrapper).toContain('data-ember-backdrop=""');
    expect(primitive).toContain("tabIndex={-1}");
    expect(primitive).toContain("preload={source ? \"metadata\" : \"none\"}");
    expect(css).toMatch(/\.root \{[\s\S]*?position: absolute;/);
    expect(css).toMatch(/\.root \{[\s\S]*?inset: 0;/);
    expect(css).toMatch(/\.root \{[\s\S]*?pointer-events: none;/);
    expect(css).toContain("mask-image: radial-gradient");
    expect(css).toContain("prefers-reduced-motion: reduce");
    expect(css).toContain("max-width: 640px");
  });

  it("mounts only on selective, isolated product surfaces", () => {
    expect(app).toContain('className="empty-command ember-surface"');
    expect(app).toContain('className="ask-console premium-console ember-surface"');
    expect(app).toContain('className="token-console ember-surface"');
    expect(app.match(/<EmberBackdrop/g)).toHaveLength(3);
    expect(appCss).toContain(".ember-surface > [data-ember-backdrop] ~ *");
  });
});
