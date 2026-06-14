import { motion } from "framer-motion";

/**
 * Shared section heading for the v2 landing page: an uppercase mono eyebrow
 * over a bold title and optional lead paragraph. Keeps every section's
 * typographic rhythm identical.
 */
export function SectionHeading({
  eyebrow,
  eyebrowClassName = "text-amber-400/70",
  title,
  description,
  align = "left",
  className = "",
}: {
  eyebrow: string;
  eyebrowClassName?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: "left" | "center";
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.6 }}
      className={`${align === "center" ? "mx-auto max-w-2xl text-center" : ""} ${className}`}
    >
      <p
        className={`font-mono text-[12px] font-medium uppercase tracking-[0.18em] ${eyebrowClassName}`}
      >
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-4 text-[15px] leading-relaxed text-foreground/60 dark:text-foreground/35">
          {description}
        </p>
      ) : null}
    </motion.div>
  );
}
