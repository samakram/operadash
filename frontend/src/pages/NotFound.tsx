import { Link } from "react-router-dom";
import { AuroraButton } from "@/components/Common/AuroraButton";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <h1 className="aurora-text-gradient text-6xl">404</h1>
      <p className="text-aurora-text/60">This page doesn't exist.</p>
      <Link to="/">
        <AuroraButton>Go home</AuroraButton>
      </Link>
    </div>
  );
}
