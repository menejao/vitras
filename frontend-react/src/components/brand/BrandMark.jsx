import markSolid from "../../brand/symbol/svg/vitras-mark-solid.svg";
import markMonoWhite from "../../brand/symbol/svg/vitras-mark-mono-white.svg";

export function BrandMark({ variant = "solid", size = 32, className = "" }) {
  const src = variant === "mono-white" ? markMonoWhite : markSolid;
  return (
    <img
      src={src}
      alt="Vitras"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    />
  );
}
