import { StaffProvider } from "@/components/staff-provider";
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div lang="en">
      <StaffProvider>{children}</StaffProvider>
    </div>
  );
}
