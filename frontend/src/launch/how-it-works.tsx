import { useEffect, useRef, useState } from "react";
import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import { ArrowUpRight, Hexagon, Pause, Play, RotateCcw } from "lucide-react";
import { t, useLocale } from "@/i18n";
import { AbstractScene } from "./abstract-scene";
import { currentUrl, navigate } from "@/routing/location";
import "./how-it-works.css";

const scenes = [
  { labelKey: "common.tourTeam", body: "common.tourTeamBody" },
  { labelKey: "common.tourWorkers", body: "common.tourWorkersBody" },
  { labelKey: "common.tourBoard", body: "common.tourBoardBody" },
  { labelKey: "common.tourTask", body: "common.tourTaskBody" },
  { labelKey: "common.tourHandoff", body: "common.tourHandoffBody" },
] as const;

function ScenePlayer({
  scene,
  index,
}: {
  scene: (typeof scenes)[number];
  index: number;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const visible = useInView(frame, { amount: 0.4 });
  const reduce = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const progress = useMotionValue(0);
  useEffect(() => {
    if (reduce) {
      progress.set(1);
      return;
    }
    if (!visible || paused || finished) return;
    const animation = animate(progress, 1, {
      duration: 4.5 * (1 - progress.get()),
      ease: "easeInOut",
      onComplete: () => setFinished(true),
    });
    return () => animation.stop();
  }, [visible, paused, finished, reduce, progress]);

  const title = t(scene.labelKey);
  const action = finished
    ? t("common.tourReplay")
    : paused
      ? t("common.tourPlay")
      : t("common.tourPause");
  function toggle() {
    if (finished) {
      progress.set(0);
      setFinished(false);
      setPaused(false);
    } else setPaused(!paused);
  }
  return (
    <div ref={frame} className="tour-player" role="group" aria-label={title}>
      {index >= 3 && (
        <div className="tour-film-title">
          <Hexagon size={13} aria-hidden="true" />
          {t("common.tourTaskName")}
        </div>
      )}
      <AbstractScene step={index} progress={progress} />
      {index === 4 && (
        <div className="tour-receipt">
          <strong>{t("common.tourSummary")}</strong>
          <p>{t("common.tourFinding")}</p>
        </div>
      )}
      {!reduce && (
        <div className="tour-controls">
          <button
            type="button"
            onClick={toggle}
            aria-label={action}
            title={action}
          >
            {finished ? (
              <RotateCcw size={15} />
            ) : paused ? (
              <Play size={15} />
            ) : (
              <Pause size={15} />
            )}
          </button>
          <div className="tour-track" aria-hidden="true">
            <motion.div style={{ scaleX: progress }} />
          </div>
        </div>
      )}
    </div>
  );
}

export function HowItWorks() {
  useLocale();
  return (
    <section
      id="how-it-works"
      className="launch-story tour"
      aria-labelledby="tour-title"
    >
      <header>
        <h2 id="tour-title">{t("common.tourTitle")}</h2>
        <p>{t("common.tourLead")}</p>
      </header>
      {scenes.map((scene, index) => (
        <article className="tour-row" key={scene.labelKey}>
          <div className="tour-copy">
            <h3>{t(scene.labelKey)}</h3>
            <p>{t(scene.body)}</p>
          </div>
          <ScenePlayer scene={scene} index={index} />
        </article>
      ))}
      <a
        className="tour-demo"
        href="/app/boards?demo=1"
        onClick={(event) => {
          if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
            return;
          event.preventDefault();
          navigate(
            `/app/boards?${new URLSearchParams({ demo: "1", returnTo: currentUrl() })}`,
          );
        }}
      >
        {t("common.launchExploreDemo")} <ArrowUpRight size={16} />
      </a>
    </section>
  );
}
