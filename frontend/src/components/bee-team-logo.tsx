import { Hexagon, type LucideProps } from "lucide-react";

const standardStroke = 2.3;

export function BeeTeamLogo({
  variant = "standard",
  ...props
}: Omit<LucideProps, "strokeWidth"> & { variant?: "standard" | "thin" }) {
  return <Hexagon {...props} strokeWidth={variant === "thin" ? standardStroke / 2 : standardStroke} />;
}
