import React from "react";
import { useNavigate, Link } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-warm-off-white flex items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">
        <div className="mb-8">
          <div className="text-7xl font-serif font-bold text-stone-900 mb-2">404</div>
          <p className="text-xl font-serif text-stone-700 mb-2">
            Looks like this trail doesn&apos;t exist.
          </p>
          <p className="text-sm text-stone-500">
            The page you&apos;re looking for has wandered off the map.
          </p>
        </div>
        <div className="relative h-40 mb-8 overflow-hidden rounded-3xl">
          <img
            src="https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80"
            alt="Mountains landscape in Kenya"
            className="w-full h-full object-cover blur-sm scale-105"
            referrerPolicy="no-referrer"
            loading="lazy"
            width={1200}
            height={400}
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-5 py-3 rounded-full border border-stone-300 text-sm font-medium text-stone-700 bg-white hover:bg-stone-50"
          >
            ← Back
          </button>
          <Link
            to="/"
            className="px-5 py-3 rounded-full bg-olive-drab text-white text-sm font-medium hover:bg-olive-drab/90"
          >
            Explore Events
          </Link>
        </div>
      </div>
    </div>
  );
}

