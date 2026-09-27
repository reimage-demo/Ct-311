import { StaffProvider } from "@/components/staff-provider";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div lang="en">
      <StaffProvider serverConfigured={!!process.env.CLERK_SECRET_KEY}>
        {children}
      </StaffProvider>
    </div>
  );
}
