import { useEffect } from "react";

export default function ActivateAccountPage() {
  useEffect(() => {
    window.location.replace("/");
  }, []);
  return null;
}
