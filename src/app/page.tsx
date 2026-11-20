import FilterLab from "@/components/FilterLab";
import SmokeBackground from "@/components/SmokeBackground";
import { ToastHost } from "@/components/Toasts";
import ServiceWorker from "@/components/ServiceWorker";
import Connectivity from "@/components/Connectivity";
import ErrorBoundary from "@/components/ErrorBoundary";
import MotionGate from "@/components/MotionGate";
import ScrollTools from "@/components/ScrollTools";

export default function Home() {
  return (
    <main className="relative">
      <SmokeBackground />
      <ErrorBoundary>
        <MotionGate>
          <FilterLab />
        </MotionGate>
      </ErrorBoundary>
      <ToastHost />
      <ServiceWorker />
      <Connectivity />
      <ScrollTools />
    </main>
  );
}
