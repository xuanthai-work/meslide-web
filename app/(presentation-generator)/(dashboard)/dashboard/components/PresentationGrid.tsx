"use client";

import { AnimatePresence, motion } from "motion/react";
import { PresentationCard } from "./PresentationCard";
import { PresentationResponse } from "@/app/(presentation-generator)/services/api/dashboard";
import { EmptyState } from "./EmptyState";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
    },
  },
};

interface PresentationGridProps {
  presentations: PresentationResponse[];
  viewMode?: "grid" | "list";
  isLoading?: boolean;
  error?: string | null;
  onPresentationDeleted?: (presentationId: string) => void;
  onPresentationDuplicated?: (presentation: PresentationResponse) => void;
}

export const PresentationGrid = ({
  presentations,
  viewMode = "grid",
  isLoading = false,
  error = null,
  onPresentationDeleted,
  onPresentationDuplicated,
}: PresentationGridProps) => {
  const ShimmerCard = () => (
    <div className="flex min-h-[216px] flex-col overflow-hidden rounded-xl border border-[var(--gslide-border)] bg-white shadow-none animate-pulse">
      <div className="relative flex-1 overflow-hidden p-4">
        <img
          src="/card_bg.svg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-70"
        />
        <div className="relative mx-auto mt-2 aspect-video w-[88%] rounded-lg border border-gray-200 bg-gray-200" />
      </div>
      <div className="relative z-10 border-t border-[#EDEEEF] bg-white px-5 py-3">
        <div className="flex items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="h-3.5 w-24 rounded bg-gray-200" />
            <div className="h-3 w-16 rounded bg-gray-200" />
          </div>
          <div className="h-5 w-1 rounded-full bg-gray-200" />
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 min-[1200px]:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5 gap-5 2xl:gap-6 w-full">
        {[...Array(12)].map((_, i) => (
          <ShimmerCard key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-[var(--gslide-border)] bg-white">
        <div className="text-center text-gray-500">
          <p className="mb-2">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-primary hover:text-primary/80 underline"
          >
            {"Thử lại"}
          </button>
        </div>
      </div>
    );
  }

  if (!presentations || presentations.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <EmptyState />
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={`relative ${
        viewMode === "grid"
          ? "grid grid-cols-1 md:grid-cols-2 min-[1200px]:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5 gap-5 2xl:gap-6"
          : "grid grid-cols-1 gap-4"
      }`}
    >
      <AnimatePresence mode="popLayout">
        {presentations.map((presentation) => (
          <PresentationCard
            key={presentation.id}
            id={presentation.id}
            title={presentation.title ?? "Bài thuyết trình không tiêu đề"}
            presentation={presentation}
            viewMode={viewMode}
            onDeleted={onPresentationDeleted}
            onDuplicated={onPresentationDuplicated}
          />
        ))}
      </AnimatePresence>
    </motion.div>
  );
};
