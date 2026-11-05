import { useState } from "react";
import config from "./environment-settings.json";
import dependencies from "./environment-dependencies.json";
import commands from "./environment-commands.json";
import "./reference.css";
import copy from "./environment-copy.json";


function Command({ command, title, language }: { command: string; title: string; language: number }) {
  const [result, setResult] = useState<"copied" | "copyFail" | null>(null);
  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(command);
      setResult("copied");
    } catch {
      setResult("copyFail");
    }
  }
  return <section className="guide-block"><h4>{title}</h4>
    <pre className="guide-code"><code>{command}</code></pre>
    <button type="button" onClick={copyCommand}>{copy.copy[language]}</button>
    <span role="status">{result && copy[result][language]}</span>
  </section>;
}

export default function Environment({ pt }: { pt: boolean }) {
  const language = pt ? 1 : 0;
  return <section>
    <p>{copy.intro[language]}</p>
    <p>{copy.values[language]}</p>
    {[...config, ...dependencies].map(group => <section className="guide-block" key={group.label[0]}>
      <h3>{group.label[language]}</h3>
      {group.rows.some(([name]) => name === "BEE_TRANSFER_ENABLED") && <p>{copy.numeric[language]}</p>}
      {group === dependencies[0] && <p>{copy.sdk[language]}</p>}
      {group === dependencies[1] && <p>{copy.os[language]}</p>}
      <div className="guide-reference-table"><table><thead><tr><th scope="col">{copy.variable[language]}</th><th scope="col">{copy.fallback[language]}</th><th scope="col">{copy.meaning[language]}</th></tr></thead>
        <tbody>{group.rows.map(([name, fallback, en, portuguese]) => <tr key={name}>
          <th scope="row"><code>{name}</code></th><td><code>{fallback || "—"}</code></td><td>{pt ? portuguese : en}</td>
        </tr>)}</tbody></table></div>
    </section>)}
    <h3>{copy.build[language]}</h3><p>{copy.buildText[language]}</p>
    <h3>{copy.example[language]}</h3><p>{copy.exampleText[language]}</p>
    <Command title={"PowerShell"} command={commands.powershell} language={language}/>
    <Command title={"POSIX"} command={commands.posix} language={language}/>
    <p>{copy.result[language]}</p>
  </section>;
}
