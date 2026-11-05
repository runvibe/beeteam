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
  delay,
  progress,
}: {
  point: Point;
  delay: number;
  progress: Progress;
}) {
  const x = useTransform(progress, [delay, delay + 0.55], [dx * 1.55, dx]);
  const y = useTransform(progress, [delay, delay + 0.55], [dy * 1.55, dy]);
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
          <JoiningCell
            key={index}
            point={point}
            delay={index * 0.05}
            progress={progress}
          />
        ))}
      </g>
      <Cell />
      <Cell size={28} />
    </g>
  );
}

function Team({ progress }: { progress: Progress }) {
  const draw = useTransform(progress, [0.06, 0.72], [0, 1]);
  const appear = useTransform(progress, [0.38, 0.8], [0.35, 1]);
  return (
    <g>
      <g transform="translate(300 71)">
        <Cell />
        <Cell size={28} />
      </g>
      <text x="352" y="77">
        {t("common.leader")}
      </text>
      {[160, 440].map((x, i) => (
        <g key={x}>
          <motion.path
            d={`M300 104v16L${x} 173v9`}
            style={{ pathLength: draw }}
          />
          <g transform={`translate(${x} 215)`}>
            <motion.g style={{ opacity: appear }}>
              <Cell />
              {i === 0 ? (
                <circle r="8" />
              ) : (
                <path d="m-10 0 10-10 10 10-10 10Z" />
              )}
            </motion.g>
            <text y="65" textAnchor="middle">
              {t(i ? "common.tourFrontend" : "common.tourQA")}
            </text>
          </g>
        </g>
      ))}
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

function Lane({
  index,
  progress,
  assembling,
}: {
  index: number;
  progress: Progress;
  assembling: boolean;
}) {
  const draw = useTransform(
    progress,
    [index * 0.12, 0.65 + index * 0.12],
    [assembling ? 0.12 : 1, 1],
  );
  const x = 82 + index * 154;
  return (
    <g transform={`translate(${x} 58)`}>
      <text x="64" y="0" textAnchor="middle">
        {t(["common.tourTodo", "common.tourDoing", "common.tourReview"][index])}
      </text>
      <motion.rect
        className="tour-secondary-line"
        y="22"
        width="128"
        height="144"
        rx="8"
        style={{ pathLength: draw }}
      />
    </g>
  );
}
function Board({ progress, assign }: { progress: Progress; assign: boolean }) {
  const x = useTransform(progress, [0.15, 0.8], [146, 300]);
  const y = useTransform(progress, [0.15, 0.44, 0.8], [150, 120, 150]);
  return (
    <g>
      {[0, 1, 2].map((index) => (
        <Lane
          key={index}
          index={index}
          progress={progress}
          assembling={!assign}
        />
      ))}
      {assign && (
        <motion.g style={{ x, y }}>
          <TaskMark />
        </motion.g>
      )}
    </g>
  );
}

function Handoff({ progress }: { progress: Progress }) {
  const x = useTransform(progress, [0.15, 0.82], [150, 450]);
  const y = useTransform(progress, [0.15, 0.46, 0.82], [112, 78, 112]);
  const received = useTransform(progress, [0.77, 0.96], [0, 1]);
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
        <Board progress={progress} assign={step === 3} />
      ) : (
        <Handoff progress={progress} />
      )}
    </svg>
  );
}
