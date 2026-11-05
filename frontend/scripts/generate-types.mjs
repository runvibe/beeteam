import fs from "node:fs/promises";
import openapiTS, { astToString } from "openapi-typescript";
import ts from "typescript";
import { format } from "prettier";
for (const domain of ["kanban", "ra", "system"]) {
  const source = astToString(
    await openapiTS(
      new URL(`../contracts/${domain}-openapi.yaml`, import.meta.url),
    ),
  );
  const ast = ts.createSourceFile(
    "contract.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const components = ast.statements.find(
    (s) => ts.isInterfaceDeclaration(s) && s.name.text === "components",
  );
  const schemas = components.members.find(
    (m) => m.name?.getText(ast) === "schemas",
  );
  const dir = new URL(`../src/api/generated/${domain}/`, import.meta.url);
  await fs.mkdir(dir, { recursive: true });
  for (const member of schemas.type.members) {
    const name = member.name.getText(ast).replaceAll('"', "");
    const body = member.type
      .getText(ast)
      .replace(
        /components\["schemas"\]\["([^"]+)"\]/g,
        (_, n) => `import('./${n}').${n}`,
      );
    await fs.writeFile(
      new URL(`${name}.ts`, dir),
      await format(
        `// Generated from contracts/${domain}-openapi.yaml. Do not edit.\nexport type ${name} = ${body};\n`,
        { parser: "typescript" },
      ),
    );
  }
  console.log(`${domain}: ${schemas.type.members.length} schemas generated`);
}
