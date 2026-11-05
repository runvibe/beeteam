import { motion, useTransform, type MotionValue } from "motion/react";
import { t } from "@/i18n";

const hex = "0,-30 26,-15 26,15 0,30 -26,15 -26,-15";
function Cell({ x, y, label }: { x: number; y: number; label?: string }) {
  return <g transform={`translate(${x} ${y})`}><polygon points={hex} className="tour-cell" />
    {label && <text y={53}>{label}</text>}</g>;
}

export function AbstractScene({ step, progress }: { step: number; progress: MotionValue<number> }) {
  const pathLength = useTransform(progress, [0, .7], [0, 1]);
  const x = useTransform(progress, [.2, .8], [116, 364]);
  const incoming = useTransform(progress, [.05, .75], [0, 1]);
  const spread = useTransform(progress, [0, .8], [16, 124]);
  const left = useTransform(spread, n => -n);
  const y = useTransform(progress, [.1, .8], [20, 0]);
  const path = (d: string) => <motion.path className="tour-wire" d={d} style={{ pathLength }} />;
  const token = <motion.g style={{ x }}><rect className="tour-token" x="-21" y="108" width="42" height="24" rx="6" />
    <path d="M-11 118h22m-22 5h12" className="tour-token-ink"/></motion.g>;
  return <svg className="tour-art" viewBox="0 0 480 235" aria-hidden="true">
    {step === 0 && <>
      {path("M116 119H364")}
      <g transform="translate(240 120)"><motion.g style={{ x:left }}><Cell x={0} y={0}/></motion.g>
        <motion.g style={{ x:spread }}><Cell x={0} y={0}/></motion.g></g>
      <Cell x={240} y={120} label={t("common.tourTeamName")}/>
    </>}
    {step === 1 && <>
      {path("M240 65L116 151M240 65L364 151")}
      <Cell x={240} y={65} label={t("common.leader")}/>
      <motion.g style={{ opacity: incoming, y }}><Cell x={116} y={151} label={t("common.tourQA")}/>
        <Cell x={364} y={151} label={t("common.tourFrontend")}/></motion.g>
    </>}
    {(step === 2 || step === 3) && <>
      {[116,240,364].map((cx,i)=><g key={cx}><path className="tour-lane" d={`M${cx-48} 69v89q0 8 8 8h80q8 0 8 -8V69`}/>
        <text x={cx} y={55}>{t(["common.tourTodo","common.tourDoing","common.tourReview"][i])}</text></g>)}
      {step === 2 ? <motion.g style={{ opacity: incoming, y }}>
        {[116,240,364].map(cx=><circle key={cx} cx={cx} cy="120" r="5" className="tour-dot"/>)}</motion.g> : <>
        {path("M116 120H240")}<motion.g style={{ x: spread }}><rect className="tour-token" x="95" y="108" width="42" height="24" rx="6"/>
        <text x="116" y="125">{t("common.tourQA")}</text></motion.g></>}
    </>}
    {step === 4 && <>
      <Cell x={116} y={120} label={t("common.tourQA")}/><Cell x={364} y={120} label={t("common.tourFrontend")}/>
      {path("M116 120H364")}{token}
      <motion.text x="240" y="193" style={{opacity:incoming}}>{t("common.tourSummary")}</motion.text>
    </>}
  </svg>;
}
