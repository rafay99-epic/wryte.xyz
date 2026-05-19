import Link from "next/link";
import { BrandIcon } from "@/components/branding/brand-icon";
import { APP_RELEASE_LABEL } from "@/lib/release";

export function MarketingFooter() {
  return (
    <footer className="border-t border-foreground/[0.08] dark:border-foreground/[0.04] py-8">
      <div className="mx-auto max-w-[1100px] px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BrandIcon
              width={18}
              height={18}
              className="rounded-[3px] opacity-40"
            />
            <span className="text-[12px] text-foreground/40 dark:text-foreground/20">
              &copy; {new Date().getFullYear()} Wryte
            </span>
          </div>
          <div className="flex items-center gap-5 text-[12px] text-foreground/40 dark:text-foreground/20">
            <Link
              href="/changelog"
              className="transition-colors hover:text-foreground/70"
            >
              Changelog
            </Link>
            <Link
              href="/contact"
              className="transition-colors hover:text-foreground/70"
            >
              Contact
            </Link>
            <Link
              href="/terms"
              className="transition-colors hover:text-foreground/70"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="transition-colors hover:text-foreground/70"
            >
              Privacy
            </Link>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-foreground/[0.06] dark:border-foreground/[0.03] pt-5">
          <p className="text-[11px] text-foreground/30 dark:text-foreground/15">
            {APP_RELEASE_LABEL} · Built by{" "}
            <a
              href="https://rafay99.com"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground/50"
            >
              Abdul Rafay
            </a>
          </p>
          <a
            href="https://syntaxlabtechnology.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-foreground/30 dark:text-foreground/15 transition-colors hover:text-foreground/50"
          >
            Syntax Lab Technology
          </a>
        </div>
      </div>
    </footer>
  );
}
