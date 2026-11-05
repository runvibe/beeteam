import { useEffect, useState } from "react";
import catalog from "../../../docs/mcp-catalog.json";
import purposes from "./tool-purposes.pt.json";
import examples from "./tool-examples.json";
import copy from "./tools-copy.json";
import { appVersion } from "../app-version";
import "./reference.css";

const portuguesePurpose: Record<string, string> = purposes;

interface Tool {
  name: string;
  description: string;
  inputSchema: { required?: string[] };
}

const tools: Tool[] = catalog.tools;
const groups = copy.groups;

const transfers = new Set([
  "exportData",
  "getDataTransfer",
  "previewDataImport",
  "restoreDataImport",
  "cancelDataTransfer",
]);
const helpers = new Set(["health_check", "echo_request", "prepare_execution"]);
function group(tool: Tool): keyof typeof groups {
  if (transfers.has(tool.name)) return "transfer";
  if (tool.name === "health_check" || tool.name === "echo_request")
    return "service";
  const path = tool.description.split(". ")[0];
  if (path.includes("/agents")) return "agent";
  if (path.includes("/team")) return "team";
  if (path.includes("/boards") && !path.includes("/tasks")) return "board";
  return "task";
}

function readOnly(tool: Tool) {
  return (
    tool.description.startsWith("GET ") ||
    helpers.has(tool.name) ||
    tool.name === "getDataTransfer" ||
    tool.name === "previewDataImport"
  );
}
const anchor = (name: string) => "tool-" + name;

function ToolDetails({ tool, pt }: { tool: Tool; pt: boolean }) {
  const id = anchor(tool.name);
  const [endpoint, ...sentences] = tool.description.split(". ");
  const required = tool.inputSchema.required ?? [];
  const locale = pt ? 1 : 0;
  const english =
    (copy.special as Record<string, string>)[tool.name] ??
    sentences[0] ??
    endpoint;
  return (
    <details className="guide-block" id={id}>
      <summary>
        <code>{tool.name}</code> ·{" "}
        {(readOnly(tool) ? copy.read : copy.write)[locale]}
      </summary>
      <p>{pt ? portuguesePurpose[tool.name] : english}</p>
      {/^(GET|POST|PUT|DELETE|PATCH) /.test(endpoint) && (
        <p>
          <code>{endpoint}</code>
        </p>
      )}
      <p>
        {copy.required[pt ? 1 : 0]}:{" "}
        {required.length
          ? required.map((key) => <code key={key}> {key} </code>)
          : copy.none[pt ? 1 : 0]}
        .
      </p>
      <details>
        <summary>{copy.schema[locale]}</summary>
        <>
          <p>{tool.description}</p>
          <pre className="guide-code">
            {JSON.stringify(tool.inputSchema, null, 2)}
          </pre>
        </>
      </details>
      <a href={"#" + id}>{copy.permalink[pt ? 1 : 0]}</a>
    </details>
  );
}

export default function Catalog({ pt }: { pt: boolean }) {
  const [query, setQuery] = useState("");
  useEffect(() => {
    function reveal() {
      const target = document.getElementById(window.location.hash.slice(1));
      if (
        target instanceof HTMLDetailsElement &&
        target.id.startsWith("tool-")
      ) {
        target.open = true;
        target.scrollIntoView?.({ block: "start" });
      }
    }
    function onHash() {
      if (window.location.hash.startsWith("#tool-")) setQuery("");
      requestAnimationFrame(reveal);
    }
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const text = query.trim().toLowerCase();
  const filtered = tools.filter((tool) =>
    [tool.name, tool.description, portuguesePurpose[tool.name]]
      .join(" ")
      .toLowerCase()
      .includes(text),
  );
  return (
    <section>
      <p>{copy.intro[pt ? 1 : 0]}</p>
      <p>
        {copy.protocol[pt ? 1 : 0]}: <code>{catalog.protocolVersion}</code> ·{" "}
        <code>{appVersion}</code>. {copy.transfer[pt ? 1 : 0]}
      </p>
      <label>
        {copy.search[pt ? 1 : 0]}{" "}
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <p role="status">
        {filtered.length} / {tools.length} {copy.tools[pt ? 1 : 0]}
      </p>
      {(Object.keys(groups) as (keyof typeof groups)[]).map((key) => {
        const entries = filtered.filter((tool) => group(tool) === key);
        return (
          entries.length > 0 && (
            <section key={key}>
              <h3>{groups[key][pt ? 1 : 0]}</h3>
              {entries.map((tool) => (
                <ToolDetails key={tool.name} tool={tool} pt={pt} />
              ))}
            </section>
          )
        );
      })}
      <h3>{copy.example[pt ? 1 : 0]}</h3>
      <p>{copy.empty[pt ? 1 : 0]}</p>
      <pre className="guide-code">
        {JSON.stringify(examples.listBoards, null, 2)}
      </pre>
      <p>{copy.conflict[pt ? 1 : 0]}</p>
      <p>{copy.errorExample[pt ? 1 : 0]}</p>
      <pre className="guide-code">
        {JSON.stringify(examples.versionConflict, null, 2)}
      </pre>
      <h3>{copy.resources[pt ? 1 : 0]}</h3>
      <p>{copy.resourceHelp[pt ? 1 : 0]}</p>
      <ul>
        {catalog.resources.map((item) => (
          <li key={item.uri}>
            <code>{item.uri}</code>
          </li>
        ))}
      </ul>
      <h3>{copy.prompts}</h3>
      <p>{copy.promptHelp[pt ? 1 : 0]}</p>
      <ul>
        {catalog.prompts.map((item) => (
          <li key={item.name}>
            <code>{item.name}</code> (
            {item.arguments.map((arg) => arg.name).join(", ")})
          </li>
        ))}
      </ul>
    </section>
  );
}
