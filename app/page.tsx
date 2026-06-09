import { Suspense } from "react";
import UniverseScene from "@/components/universe/UniverseScene";

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-screen items-center justify-center bg-[#03040a]">
          <p className="text-sm tracking-wide text-white/30">
            Entering Normie Universe…
          </p>
        </div>
      }
    >
      <UniverseScene />
    </Suspense>
  );
}
