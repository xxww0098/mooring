import { createFileRoute } from "@tanstack/react-router";
import { Workspace } from "@/components/workspace/Workspace";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <Workspace />;
}
