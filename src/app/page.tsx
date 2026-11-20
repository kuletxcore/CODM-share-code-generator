import FilterLab from "@/components/FilterLab";
import SmokeBackground from "@/components/SmokeBackground";
import { ToastHost } from "@/components/Toasts";
import ServiceWorker from "@/components/ServiceWorker";
import Connectivity from "@/components/Connectivity";

export default function Home() {
  return (
    <main className="relative">
      <SmokeBackground />
      <FilterLab />
      <ToastHost />
      <ServiceWorker />
      <Connectivity />
    </main>
  );
}
