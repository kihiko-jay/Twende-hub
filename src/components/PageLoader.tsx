import React from "react";

export default function PageLoader() {
  return (
    <div className="min-h-screen bg-warm-off-white">
      <div className="h-20 w-full bg-stone-100 animate-pulse" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <div className="h-40 bg-stone-100 rounded-3xl animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[0, 1, 2].map((key) => (
            <div
              key={key}
              className="rounded-3xl border border-stone-200 bg-white overflow-hidden"
            >
              <div className="h-40 bg-stone-100 animate-pulse" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-stone-100 rounded-full w-3/4 animate-pulse" />
                <div className="h-3 bg-stone-100 rounded-full w-1/2 animate-pulse" />
                <div className="h-3 bg-stone-100 rounded-full w-2/3 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

