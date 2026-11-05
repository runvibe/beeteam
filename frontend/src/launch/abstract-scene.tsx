import { useId, type ReactNode } from "react";
import { motion, useTransform, type MotionValue } from "motion/react";
import { Check, Clipboard, Code2, Crown, ScanLine } from "lucide-react";
import { t } from "@/i18n";

type Progress = MotionValue<number>;
type Metal = { face: string; rim: string; edge: string; shadow: string };
const hex =
  "M0 -52 Q2 -52 5 -50 L42 -29 Q47 -26 47 -21 V22 Q47 26 42 29 L5 50 Q0 53 -5 50 L-42 29 Q-47 26 -47 21 V-21 Q-47 -26 -42 -29 L-5 -50 Q-2 -52 0 -52Z";

function HiveTile({
  metal,
  bright = false,
  children,
}: {
  metal: Metal;
  bright?: boolean;
  children?: ReactNode;
}) {
  return (
    <g>
      <path d={hex} transform="translate(0 9)" fill={metal.edge} />
      <path
        d={hex}
        fill={bright ? metal.rim : metal.face}
        stroke={metal.rim}
        strokeWidth="1.25"
      />
      <path
        d={hex}
        transform="scale(.89)"
        fill="none"
        stroke={bright ? "#555" : "#eee"}
        opacity=".32"
      />
      <g color={bright ? "#202020" : "#e6e6e6"}>{children}</g>
    </g>
  );
}

function Petal({
  dx,
  dy,
  progress,
  metal,
  delay,
}: {
  dx: number;
  dy: number;
  progress: Progress;
  metal: Metal;
  delay: number;
}) {
  const x = useTransform(
    progress,
    [0, delay, delay + 0.44, 1],
    [dx * 1.85, dx * 1.85, dx, dx],
  );
  const y = useTransform(
    progress,
    [0, delay, delay + 0.44, 1],
    [dy * 1.85 - 22, dy * 1.85 - 22, dy, dy],
  );
  return (
    <motion.g style={{ x, y }}>
      <HiveTile metal={metal} />
    </motion.g>
  );
}
function Hive({ progress, metal }: { progress: Progress; metal: Metal }) {
  const lift = useTransform(progress, [0, 0.52, 0.89, 1], [-32, -32, 0, 0]);
  return (
    <g transform="translate(306 157)">
      <g transform="matrix(1.02,-.28,.50,.72,0,0)" filter={metal.shadow}>
        {[
          [96, 0],
          [48, 80],
          [-48, 80],
          [-96, 0],
          [-48, -80],
          [48, -80],
        ].map(([dx, dy], i) => (
          <Petal
            key={i}
            dx={dx}
            dy={dy}
            progress={progress}
            metal={metal}
            delay={0.02 + i * 0.044}
          />
        ))}
        <motion.g style={{ y: lift }}>
          <HiveTile bright metal={metal}>
            <path
              d={hex}
              transform="scale(.44)"
              fill="none"
              stroke="currentColor"
              strokeWidth="5"
            />
          </HiveTile>
        </motion.g>
      </g>
    </g>
  );
}

function Team({ progress, metal }: { progress: Progress; metal: Metal }) {
  const draw = useTransform(progress, [0.08, 0.63], [0, 1]);
  const drop = useTransform(progress, [0.22, 0.74], [-35, 0]);
  return (
    <g>
      {[
        "M300 90V126Q300 140 286 140H188Q162 140 162 166V184",
        "M300 90V126Q300 140 314 140H412Q438 140 438 166V184",
      ].map((d) => (
        <g key={d}>
          <path d={d} className="tour-channel" />
          <motion.path
            d={d}
            className="tour-trace"
            style={{ pathLength: draw }}
          />
        </g>
      ))}
      <g transform="translate(300 79) scale(.71)" filter={metal.shadow}>
        <HiveTile bright metal={metal}>
          <Crown x="-20" y="-20" width="40" height="40" />
        </HiveTile>
      </g>
      <text x="350" y="85" className="tour-label">
        {t("common.leader")}
      </text>
      {[
        { x: 162, label: t("common.tourQA"), Icon: ScanLine },
        { x: 438, label: t("common.tourFrontend"), Icon: Code2 },
      ].map(({ x, label, Icon }) => (
        <g key={x} transform={`translate(${x} 196)`}>
          <motion.g style={{ y: drop }}>
            <g transform="scale(.83)" filter={metal.shadow}>
              <HiveTile metal={metal}>
                <Icon x="-20" y="-20" width="40" height="40" />
              </HiveTile>
            </g>
          </motion.g>
          <text y="67" textAnchor="middle" className="tour-label">
            {label}
          </text>
        </g>
      ))}
    </g>
  );
}

function Slip({ metal }: { metal: Metal }) {
  return (
    <g filter={metal.shadow}>
      <rect x="-65" y="-30" width="130" height="64" rx="9" fill={metal.edge} />
      <rect x="-65" y="-34" width="130" height="64" rx="9" fill={metal.rim} />
      <Clipboard x="-52" y="-21" width="17" height="17" color="#262626" />
      <text x="-26" y="-8" className="tour-slip-title">
        {t("common.tourCopy")}
      </text>
      <path
        d="M-51 8h77m-77 7h55"
        stroke="#606060"
        opacity=".64"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </g>
  );
}

function Tray({
  label,
  index,
  metal,
  progress,
  assemble,
}: {
  label: string;
  index: number;
  metal: Metal;
  progress: Progress;
  assemble: boolean;
}) {
  const y = useTransform(
    progress,
    [index * 0.13, 0.6 + index * 0.13],
    [assemble ? 24 + index * 11 : 0, 0],
  );
  return (
    <g transform={`translate(${index * 163} 0)`}>
      <motion.g style={{ y }}>
        <rect y="6" width="148" height="158" rx="12" fill={metal.edge} />
        <rect
          width="148"
          height="158"
          rx="12"
          fill={metal.face}
          stroke={metal.rim}
          strokeWidth=".85"
        />
        <text x="15" y="29" className="tour-tray-title">
          {label}
        </text>
        <path d="M14 41h120" stroke="#fff" opacity=".17" />
        <rect
          x="12"
          y="54"
          width="124"
          height="86"
          rx="8"
          fill="#101010"
          opacity=".55"
        />
      </motion.g>
    </g>
  );
}
function Board({
  step,
  metal,
  progress,
}: {
  step: number;
  metal: Metal;
  progress: Progress;
}) {
  const x = useTransform(progress, [0, 0.18, 0.76, 1], [74, 74, 237, 237]);
  const y = useTransform(
    progress,
    [0, 0.18, 0.45, 0.76, 1],
    [96, 96, 63, 96, 96],
  );
  return (
    <g transform="translate(63 60)">
      <g transform="rotate(-4 237 90)">
        {["common.tourTodo", "common.tourDoing", "common.tourReview"].map(
          (key, i) => (
            <Tray
              key={key}
              label={t(key)}
              index={i}
              progress={progress}
              metal={metal}
              assemble={step === 2}
            />
          ),
        )}
        {step === 3 && (
          <motion.g style={{ x, y }}>
            <Slip metal={metal} />
          </motion.g>
        )}
      </g>
      <text x="237" y="213" textAnchor="middle" className="tour-label">
        {t("common.tourBoardName")}
      </text>
    </g>
  );
}

function Handoff({ progress, metal }: { progress: Progress; metal: Metal }) {
  const x = useTransform(progress, [0, 0.18, 0.78, 1], [154, 154, 447, 447]);
  const y = useTransform(
    progress,
    [0, 0.18, 0.48, 0.78, 1],
    [135, 135, 91, 135, 135],
  );
  const seal = useTransform(progress, [0.73, 0.91], [0, 1]);
  return (
    <g>
      <path
        d="M154 152 Q300 42 447 152"
        className="tour-channel"
        strokeDasharray="2 7"
      />
      {[154, 447].map((cx, i) => (
        <g key={cx} transform={`translate(${cx} 176)`}>
          <ellipse rx="79" ry="22" fill={metal.edge} />
          <ellipse
            cy="-6"
            rx="79"
            ry="22"
            fill={metal.face}
            stroke={metal.rim}
          />
          <ellipse
            cy="-6"
            rx="60"
            ry="13"
            fill="none"
            stroke={metal.rim}
            opacity=".44"
          />
          <text textAnchor="middle" y="57" className="tour-label">
            {t(i ? "common.tourFrontend" : "common.tourQA")}
          </text>
        </g>
      ))}
      <motion.g style={{ x, y }}>
        <Slip metal={metal} />
      </motion.g>
      <motion.g style={{ opacity: seal }}>
        <circle cx="510" cy="108" r="13" fill={metal.rim} />
        <Check x="501" y="99" width="18" height="18" color="#222" />
      </motion.g>
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
  const id = useId().replace(/:/g, "");
  const metal = {
    face: `url(#${id}-face)`,
    rim: `url(#${id}-rim)`,
    edge: `url(#${id}-edge)`,
    shadow: `url(#${id}-shadow)`,
  };
  return (
    <svg className="tour-art" viewBox="0 0 600 310" aria-hidden="true">
      <defs>
        <linearGradient id={id + "-face"} x2=".8" y2="1">
          <stop stopColor="#626367" />
          <stop offset=".35" stopColor="#434447" />
          <stop offset="1" stopColor="#26272a" />
        </linearGradient>
        <linearGradient id={id + "-rim"} x2=".8" y2="1">
          <stop stopColor="#faf9f4" />
          <stop offset=".4" stopColor="#e4e3dd" />
          <stop offset="1" stopColor="#b3b2ae" />
        </linearGradient>
        <linearGradient id={id + "-edge"}>
          <stop stopColor="#161718" />
          <stop offset=".48" stopColor="#6c6c6e" />
          <stop offset=".54" stopColor="#373739" />
          <stop offset="1" stopColor="#161718" />
        </linearGradient>
        <filter
          id={id + "-shadow"}
          x="-75%"
          y="-75%"
          width="250%"
          height="270%"
        >
          <feDropShadow dx="2" dy="8" stdDeviation="6" floodOpacity=".32" />
        </filter>
      </defs>
      {step === 0 ? (
        <Hive progress={progress} metal={metal} />
      ) : step === 1 ? (
        <Team progress={progress} metal={metal} />
      ) : step <= 3 ? (
        <Board step={step} progress={progress} metal={metal} />
      ) : (
        <Handoff progress={progress} metal={metal} />
      )}
    </svg>
  );
}
