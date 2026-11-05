import { Hexagon } from "lucide-react";
import { motion, useTransform, type MotionValue } from "motion/react";
import { t } from "@/i18n";

type Progress = MotionValue<number>;
type Point = readonly [number, number];

// Use the same rounded hexagon as the Bee Team wordmark.
function Cell({ size = 76 }: { size?: number }) {
  return <Hexagon x={-size / 2} y={-size / 2} width={size} height={size} />;
}

function JoiningCell({
  point: [dx, dy],
  progress,
}: {
  point: Point;
  progress: Progress;
}) {
  const factor = useTransform(
    progress,
    (p) => 1 + 0.28 * (1 - Math.cos(2 * Math.PI * p)),
  );
  const x = useTransform(factor, (f) => dx * f);
  const y = useTransform(factor, (f) => dy * f);
  return (
    <motion.g style={{ x, y }}>
      <Cell />
    </motion.g>
  );
}
const neighbors: Point[] = [
  [-67, 0],
  [-33.5, -58],
  [33.5, -58],
  [67, 0],
  [33.5, 58],
  [-33.5, 58],
];
function Hive({ progress }: { progress: Progress }) {
  return (
    <g transform="translate(300 156)">
      <g className="tour-secondary-line">
        {neighbors.map((point, index) => (
          <JoiningCell key={index} point={point} progress={progress} />
        ))}
      </g>
      <Cell />
      <Cell size={28} />
    </g>
  );
}

function Team({ progress }: { progress: Progress }) {
  const phase = useTransform(progress, (p) => -100 * p);
  return (
    <g>
      <g transform="translate(300 82)">
        <Cell />
        <Cell size={26} />
      </g>
      {[160, 440].map((x, i) => {
        const d = `M300 113.7V135L${x} 189V213.3`;
        return (
          <g key={x}>
            <path d={d} className="tour-secondary-line" />
            <motion.path
              d={d}
              pathLength="100"
              strokeDasharray="14 86"
              style={{ strokeDashoffset: phase }}
            />
            <g transform={`translate(${x} 245)`}>
              <Cell />
              {i === 0 ? (
                <circle r="8" />
              ) : (
                <path d="m-10 0 10-10 10 10-10 10Z" />
              )}
            </g>
          </g>
        );
      })}
    </g>
  );
}
// This outlined task mark stays identical when it moves across the board and between workers.
function TaskMark() {
  return (
    <g>
      <rect x="-32" y="-20" width="64" height="40" rx="5" />
      <path d="M-19 -6h26m-26 11h17" />
    </g>
  );
}

function Board({ progress }: { progress: Progress }) {
  const offset = useTransform(progress, (p) => -100 * p);
  return (
    <g>
      {[0, 1, 2].map((i) => (
        <g key={i} transform={`translate(${84 + i * 153} 82)`}>
          <rect width="126" height="146" rx="10" opacity=".25" />
          <motion.rect
            width="126"
            height="146"
            rx="10"
            pathLength="100"
            strokeDasharray="25 75"
            style={{ strokeDashoffset: offset }}
            transform={i === 1 ? "rotate(180 63 73)" : undefined}
          />
        </g>
      ))}
    </g>
  );
}
function Assign({ progress }: { progress: Progress }) {
  const x = useTransform(
    progress,
    (p) => 300 + 144 * Math.cos(2 * Math.PI * p),
  );
  const y = useTransform(progress, (p) => 155 + 76 * Math.sin(2 * Math.PI * p));
  return (
    <g>
      <ellipse
        cx="300"
        cy="155"
        rx="144"
        ry="76"
        className="tour-secondary-line"
        strokeDasharray="2 8"
      />
      <g transform="translate(300 155)">
        <Cell />
        <circle r="8" />
      </g>
      <motion.g style={{ x, y }}>
        <TaskMark />
      </motion.g>
    </g>
  );
}
function Handoff({ progress }: { progress: Progress }) {
  const shuttle = useTransform(
    progress,
    (p) => (1 - Math.cos(2 * Math.PI * p)) / 2,
  );
  const x = useTransform(shuttle, [0, 1], [150, 450]);
  const y = useTransform(shuttle, [0, 0.5, 1], [112, 78, 112]);
  const received = useTransform(shuttle, [0.77, 0.96], [0, 1]);
  return (
    <g>
      <path d="M150 147v24m300-24v24" className="tour-secondary-line" />
      {[150, 450].map((cx, i) => (
        <g key={cx} transform={`translate(${cx} 205)`}>
          <Cell />
          <text y="66" textAnchor="middle">
            {t(i ? "common.tourFrontend" : "common.tourQA")}
          </text>
        </g>
      ))}
      <motion.g style={{ x, y }}>
        <TaskMark />
      </motion.g>
      <motion.path
        d="m439 206 8 8 15-17"
        style={{ pathLength: received, opacity: received }}
      />
    </g>
  );
}

export function AbstractScene({
  step,
  progress,
}: {
  step: number;
  progress: Progress;
}) {
  return (
    <svg
      className="tour-art"
      viewBox="0 0 600 310"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {step === 0 ? (
        <Hive progress={progress} />
      ) : step === 1 ? (
        <Team progress={progress} />
      ) : step <= 3 ? (
        step === 2 ? (
          <Board progress={progress} />
        ) : (
          <Assign progress={progress} />
        )
      ) : (
        <Handoff progress={progress} />
      )}
    </svg>
  );
}
