export const FILTER_DROPDOWN_VARIANTS = {
  container: {
    hidden: { opacity: 0, height: 0 },
    show: {
      opacity: 1,
      height: "auto",
      transition: { height: { duration: 0.32 }, staggerChildren: 0.06 },
    },
    exit: {
      opacity: 0,
      height: 0,
      transition: { height: { duration: 0.24 }, opacity: { duration: 0.16 } },
    },
  },
  item: {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.22 } },
    exit: { opacity: 0, y: -6, transition: { duration: 0.14 } },
  },
} as const;
