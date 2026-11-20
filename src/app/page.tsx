import FilterLab from "@/components/FilterLab";
import SmokeBackground from "@/components/SmokeBackground";
import { ToastHost } from "@/components/Toasts";

export default function Home() {
  return (
    <main className="relative">
      <SmokeBackground />
      <FilterLab />
      <ToastHost />
    </main>
  );
}
