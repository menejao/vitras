import lockupCompactLight from "../../brand/logos/compact/vitras-lockup-compact-light.svg";
import lockupCompactDark from "../../brand/logos/compact/vitras-lockup-compact-dark.svg";
import lockupPrimaryLight from "../../brand/logos/primary/vitras-lockup-light.svg";

export function BrandLockup({ variant = "compact-light", className = "" }) {
  const srcs = {
    "compact-light": lockupCompactLight,
    "compact-dark": lockupCompactDark,
    "primary-light": lockupPrimaryLight,
  };
  return (
    <img
      src={srcs[variant] || lockupCompactLight}
      alt="Vitras"
      className={className}
    />
  );
}
