import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, ArrowUpRight, Check, CircleUserRound, Hexagon, MessageSquare, PanelTop, Users } from "lucide-react";
import { t, useLocale } from "@/i18n";
import { currentUrl, navigate } from "@/routing/location";
import "./how-it-works.css";

const steps = [
  ["common.tourTeam","common.tourTeamBody"], ["common.tourWorkers","common.tourWorkersBody"],
  ["common.tourBoard","common.tourBoardBody"], ["common.tourTask","common.tourTaskBody"],
  ["common.tourHandoff","common.tourHandoffBody"],
] as const;

function People({ workers }: { workers: boolean }) {
  return <div className="tour-people">
    {(workers ? [t("common.leader"), t("common.tourQA"), t("common.tourFrontend")] : [t("common.leader")]).map((role, i) =>
      <div className="tour-person" key={role} style={{ animationDelay: `${i * 180}ms` }}>
        <CircleUserRound size={18} /> {role}
      </div>)}
  </div>;
}

function Scene({ step }: { step: number }) {
  if (step === 0 || step === 1) return <>
    {step === 0 && <p className="tour-chat"><MessageSquare size={16} />{t("common.tourChat")}</p>}
    <div className="tour-sheet"><Users size={22} /><h3>{t("common.tourTeamName")}</h3><People workers={step === 1} /></div>
  </>;
  if (step === 4) return <div className="tour-sheet">
    <h3>{t("common.tourTaskName")}</h3>
    <div className="tour-transfer"><span>{t("common.tourQA")}</span><ArrowRight size={16}/><strong>{t("common.tourFrontend")}</strong></div>
    <div className="tour-summary"><small>{t("common.tourSummary")}</small><p>{t("common.tourFinding")}</p></div>
    <span className="tour-review"><Check size={15}/>{t("common.tourReview")}</span>
  </div>;
  return <>
    <h3>{t("common.tourBoardName")}</h3>
    <div className="tour-board">
      {["common.tourTodo", "common.tourDoing", "common.tourReview"].map((column) => <div key={column}><small>{t(column)}</small></div>)}
      {step === 3 && <div className="tour-ticket"><strong>{t("common.tourTaskName")}</strong><span>{t("common.tourQA")}</span></div>}
    </div>
  </>;
}

export function HowItWorks() {
  useLocale();
  const reducedMotion = useReducedMotion();
  const [active, setActive] = useState(0);
  return <section id="how-it-works" className="launch-story tour" aria-labelledby="tour-title">
    <header><h2 id="tour-title">{t("common.tourTitle")}</h2><p>{t("common.tourLead")}</p></header>
    <div className="tour-layout">
      <div className="tour-steps">
        {steps.map(([label], step) => <button type="button" key={step} aria-pressed={active === step}
          aria-controls="tour-window" onClick={() => setActive(step)}>
          <span>{t(label)}</span><ArrowRight size={16} aria-hidden="true"/>
        </button>)}
      </div>
      <div id="tour-window" className="tour-window" aria-live="polite">
        <div className="tour-toolbar"><Hexagon size={18}/><span>{t("common.getBeeTeamBrand")}</span><PanelTop size={15}/></div>
        <motion.div className="tour-screen" key={active}
          initial={reducedMotion ? false : { opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.28, ease: "easeOut" }}
        ><Scene step={active}/></motion.div>
        <p className="tour-caption">{t(steps[active][1])}</p>
      </div>
    </div>
    <a className="tour-demo" href="/app/boards?demo=1" onClick={(event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      navigate(`/app/boards?${new URLSearchParams({demo:"1", returnTo:currentUrl()})}`);
    }}>{t("common.launchExploreDemo")} <ArrowUpRight size={16}/></a>
  </section>;
}
