import { initials } from "../../utils/formatting";

function Avatar({ name = "", size = "md", className = "", children }) {
  return (
    <div className={["avatar", size !== "md" ? `avatar--${size}` : "", className].filter(Boolean).join(" ")}>
      {children ?? initials(name)}
    </div>
  );
}

export default Avatar;
