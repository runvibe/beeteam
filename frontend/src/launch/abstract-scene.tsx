import { Hexagon } from "lucide-react";
import { motion, useTransform, type MotionValue } from "motion/react";

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
    <g className="tour-fine-outline" transform="translate(300 156)">
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
    <g className="tour-fine-outline">
      <g transform="translate(300 82)">
        <Cell />
        <Cell size={26} />
      </g>
      {[160, 440].map((x, i) => {
        const d = `M300 113.7 C300 157 ${x} 169 ${x} 213.3`;
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
  const offset = useTransform(progress, (p) => -100 * p);
  const card = { x: 224, y: 113, width: 152, height: 84, rx: 10 };
  return (
    <g>
      <rect {...card} opacity=".25" />
      <motion.rect
        {...card}
        pathLength="100"
        strokeDasharray="25 75"
        style={{ strokeDashoffset: offset }}
      />
      <g transform="translate(300 155)"><Cell size={30} /></g>
    </g>
  );
}

function Handoff({ progress }: { progress: Progress }) {
  // Leave room for the pulse to exit before it reappears at the first worker.
  const offset = useTransform(progress, (p) => 18 - 118 * p);
  const link = "M228.5 155H371.5";
  return (
    <g>
      <g transform="translate(200 155)"><Cell /></g>
      <g transform="translate(400 155)"><Cell /></g>
      <path d={link} opacity=".25" />
      <motion.path
        d={link}
        pathLength="100"
        strokeDasharray="18 100"
        style={{ strokeDashoffset: offset }}
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
