"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface PageTransitionProps {
  children: React.ReactNode;
}

export default function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  useEffect(() => {
    // Mark first load complete after mount
    setIsFirstLoad(false);
  }, []);

  // Skip animations completely on first load (page reload)
  // Only animate during navigation between pages
  return isFirstLoad ? (
    <div className="w-full min-h-[calc(100vh-64px)]">{children}</div>
  ) : (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="w-full min-h-[calc(100vh-64px)]"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
