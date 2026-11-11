import fs from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(new URL("../../frontend/package.json", import.meta.url));
const Ajv = require("ajv/dist/2020.js");
const addFormats = require("ajv-formats");
const { default: openapiTS, astToString } = require("openapi-typescript");
const spec = JSON.parse(await fs.readFile(new URL("./managed-agents-openapi.json", import.meta.url)));
const mcp = JSON.parse(await fs.readFile(new URL("./managed-agents-mcp.json", import.meta.url)));
const fixtures = JSON.parse(await fs.readFile(new URL("./managed-agents-fixtures.json", import.meta.url)));
const ajv = new Ajv({strict: false, allErrors: true});
addFormats(ajv);
ajv.addKeyword({keyword:"x-maxBytes", type:"string", schemaType:"number", validate:(max, value) => Buffer.byteLength(value,"utf8") <= max});
ajv.addKeyword({keyword:"x-absolutePath", type:"string", schemaType:"boolean", validate:(_, value) => !/^\p{White_Space}|\p{White_Space}$/u.test(value) && !/[\0\r\n]/.test(value) && (/^\//.test(value) || /^\\\\/.test(value) || /^[A-Za-z]:[/\\]/.test(value))});
ajv.addSchema({$id:"managed",components:spec.components});
for (const name of Object.keys(spec.components.schemas)) ajv.compile({$ref:`managed#/components/schemas/${name}`});
for (const {schema,valid,value} of fixtures) {
  const check=ajv.compile({$ref:`managed#/components/schemas/${schema}`});
  if (!!check(value) !== valid) throw new Error(`${schema} expected valid=${valid}: ${JSON.stringify(check.errors)}`);
}
const send=ajv.compile({$ref:"managed#/components/schemas/SendAgentRequest"});
if (!send({content:"🙂".repeat(16384)}) || send({content:"🙂".repeat(16385)})) throw new Error("UTF-8 byte limit drift");
const operations=Object.values(spec.paths).flatMap(path=>Object.values(path));
const inline=(schema)=>{
  if (Array.isArray(schema)) return schema.map(inline);
  if (!schema || typeof schema!=="object") return schema;
  if (schema.$ref) return inline(spec.components.schemas[schema.$ref.split("/").at(-1)]);
  return Object.fromEntries(Object.entries(schema).map(([k,v])=>[k,inline(v)]));
};
const covered = new Set();
for (const tool of mcp.tools) {
  const op=operations.find(op=>op.operationId===tool["x-http-operation"]);
  if (!op) throw new Error(`Missing HTTP operation for ${tool.name}`);
  if (covered.has(op.operationId)) throw new Error(`Duplicate MCP operation: ${op.operationId}`);
  covered.add(op.operationId);
  for (const parameter of op.parameters ?? []) {
    if (parameter.in === "path" || parameter.in === "query") {
      const group = parameter.in === "path" ? "params" : "query";
      if (JSON.stringify(inline(parameter.schema)) !== JSON.stringify(tool.inputSchema.properties[group]?.properties[parameter.name])) throw new Error(`Parameter drift: ${tool.name}/${parameter.name}`);
    }
    if (parameter.in === "header" && parameter.name === "Idempotency-Key" && !tool.inputSchema.required.includes("idempotencyKey")) throw new Error(`Missing idempotency: ${tool.name}`);
    if (parameter.in === "header" && parameter.name === "If-Match" && !tool.inputSchema.required.includes("expectedVersion")) throw new Error(`Missing version guard: ${tool.name}`);
  }
  ajv.compile(tool.inputSchema); ajv.compile(tool.outputSchema);
  const body=op.requestBody?.content["application/json"].schema;
  if (body && JSON.stringify(inline(body))!==JSON.stringify(tool.inputSchema.properties.body)) throw new Error(`MCP/HTTP request drift: ${tool.name}`);
  const response=Object.entries(op.responses).find(([status])=>status.startsWith("2"))[1].content["application/json"].schema;
  if (JSON.stringify(inline(response))!==JSON.stringify(tool.outputSchema.properties.data)) throw new Error(`MCP/HTTP response drift: ${tool.name}`);
}
if (mcp.tools.length !== operations.length-1) throw new Error("Missing MCP operation (except SSE)");
const generated=astToString(await openapiTS(spec));
const target=new URL("../../frontend/src/api/generated/managed-agents.ts",import.meta.url);
if (process.argv.includes("--write")) await fs.writeFile(target,generated);
else if (await fs.readFile(target,"utf8") !== generated) throw new Error("Generated TS drift; run validator --write");
console.log(`PASS: ${operations.length} HTTP operations, ${mcp.tools.length} proposed MCP tools, ${fixtures.length} fixtures, UTF-8 boundaries and generated TypeScript.`);
