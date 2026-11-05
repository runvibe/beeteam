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
// Both ends of the cycle meet at the same pose.
function Assign({ progress }: { progress: Progress }) {
  const slide = useTransform(progress, p => (1 - Math.cos(2 * Math.PI * p)) / 2);
  const x = useTransform(slide, [0,.15,.8,1], [148,148,368,368]);
  const y = useTransform(slide, [0,.15,.5,.8,1], [156,156,134,156,156]);
  const lock = useTransform(slide, [.75,.95], [0,1]);
  return <g>
    <g transform="translate(148 156)" className="tour-secondary-line">
      <path d="M-42 -10v-20q0-5 5-5h58 M-37 -12v-14q0-4 4-4h58"/>
      <rect x="-32" y="-20" width="64" height="40" rx="5" strokeDasharray="2 5"/>
    </g>
    <g transform="translate(443 156)"><Cell/><circle r="8"/></g>
    <path d="M400 156h11" className="tour-secondary-line"/>
    <motion.g style={{x,y}}><TaskMark/></motion.g>
    <motion.path d="M327 142v-15h15m52 0h15v15m0 28v15h-15m-52 0h-15v-15" style={{opacity:lock}}/>
  </g>;
}

function Handoff({ progress }: {progress:Progress}) {
  const phase=useTransform(progress,p=>(1-Math.cos(2*Math.PI*p))/2);
  const left=useTransform(phase,[0,.65],[1,.16]);
  const right=useTransform(phase,[.35,1],[.16,1]);
  const packetX=useTransform(phase,[0,1],[149,451]);
  return <g>
    <g transform="translate(115 155)"><Cell/><circle r="8"/></g>
    <g transform="translate(485 155)"><Cell/><path d="m-9 0 9-9 9 9-9 9Z"/></g>
    <motion.path d="M147 155h95" style={{opacity:left}}/>
    <motion.path d="M358 155h95" style={{opacity:right}}/>
    <g transform="translate(300 155) scale(1.8)"><TaskMark/></g>
    <path d="M148 200H452" className="tour-secondary-line" strokeDasharray="2 7"/>
    <motion.g style={{x:packetX}}><g transform="translate(0 200)"><Cell size={18}/></g></motion.g>
  </g>;
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
