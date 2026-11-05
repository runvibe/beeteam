import { lazy, Suspense } from "react";
import copy from "./tools-copy.json";

const Catalog = lazy(() => import("./Catalog"));

export default function Tools({ pt }: { pt: boolean }) {
  return <Suspense fallback={<p role="status">{copy.loading[pt ? 1 : 0]}</p>}>
    <Catalog pt={pt} />
  </Suspense>;
}
