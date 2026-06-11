import { Suspense } from "react";
import UniverseScene from "@/components/universe/UniverseScene";
import { fetchBurnersData } from "@/lib/universe/fetchBurnersData";

export default async function Home() {
  const initialBurnerData = await fetchBurnersData().catch(() => null);

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
      <UniverseScene initialBurnerData={initialBurnerData} />
    </Suspense>
  );
}
