import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { Shell } from "@/components/shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAuthenticated())) redirect("/login");
  return <Shell>{children}</Shell>;
}
