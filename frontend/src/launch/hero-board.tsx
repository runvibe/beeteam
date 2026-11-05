import { useState, type CSSProperties } from "react";
import { Pause, Play } from "lucide-react";
import { t } from "@/i18n";
import "./hero-board.css";

// Each tile is a strip of two actual demo cards. One tile of travel makes the loop seamless.
const lanes = [
  [0, 565, 45, -19], [2, 614, 62, -37], [1, 565, 54, -12],
  [3, 592, 72, -52], [0, 565, 51, -33], [2, 614, 66, -8],
  [3, 592, 48, -21], [1, 565, 57, -41], [2, 614, 65, -16],
];

export function HeroBoard() {
  const [paused, setPaused] = useState(false);
  const label = t(paused ? "common.heroPlay" : "common.heroPause");
  return <>
    <div className="hero-board" aria-hidden="true" data-paused={paused}>
      <div className="hero-board-plane">
        {lanes.map(([tile, height, duration, delay], i) => (
          <div className="hero-board-track" key={i}>
            <div className="hero-board-strip" style={{
              "--tile": `url(/launch/hero-lane-${tile}.png)`,
              "--height": `${height}px`, "--duration": `${duration}s`, "--delay": `${delay}s`,
            } as CSSProperties} />
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
