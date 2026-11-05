import { useState, type CSSProperties } from "react";
import { Pause, Play } from "lucide-react";
import { t, useLocale } from "@/i18n";
import "./hero-board.css";

// Each repeating pair travels its own height to loop without a jump.
const lanes = [
  [0, 565, 45, -19], [2, 614, 62, -37], [1, 565, 54, -12],
  [3, 592, 72, -52], [0, 565, 51, -33], [2, 614, 66, -8],
  [3, 592, 48, -21], [1, 565, 57, -41], [2, 614, 65, -16],
];

export function HeroBoard() {
  useLocale();
  const [paused, setPaused] = useState(false);
  const label = t(paused ? "common.heroPlay" : "common.heroPause");
  const titles = [t("common.heroJourney"), t("common.heroErrors"), t("common.heroContracts"),
    t("common.heroPagination"), t("common.heroHypotheses"), t("common.heroNavigation"),
    t("common.heroEntryPoints"), t("common.heroLearnTask")];
  return <>
    <div className="hero-board" aria-hidden="true" data-paused={paused}>
      <div className="hero-board-plane">
        {lanes.map(([tile, height, duration, delay], i) => (
          <div className="hero-board-track" key={i}>
            <div className="hero-board-strip" style={{
              "--height": `${height}px`, "--duration": `${duration}s`, "--delay": `${delay}s`,
            } as CSSProperties}>
              {Array.from({ length: 8 }, (_, index) => (
                <div className="hero-board-card" key={index}>
                  <strong>{titles[tile * 2 + index % 2]}</strong>
                  <small>{t("common.heroTaskNote")}</small>
                  <i /><span>{t(index % 2 ? "common.leader" : "common.worker")}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
    <button className="hero-board-toggle" type="button" aria-label={label} title={label}
      onClick={() => setPaused(!paused)}>
      {paused ? <Play size={16} /> : <Pause size={16} />}
    </button>
  </>;
}
