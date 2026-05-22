"use client";

import { useUser } from "@clerk/nextjs";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BrandIcon } from "@/components/branding/brand-icon";
import { MarketingThemeToggle } from "@/components/layout/marketing-theme-toggle";

type NavItem =
  | { label: string; href: string }
  | { label: string; scrollTo: string };

interface MarketingNavbarProps {
  items?: NavItem[];
  onScrollTo?: (id: string) => void;
}

export function MarketingNavbar({ items, onScrollTo }: MarketingNavbarProps) {
  const { isSignedIn, user } = useUser();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className="fixed top-0 right-0 left-0 z-50">
      <div
        className={`transition-all duration-500 ${
          scrolled
            ? "border-b border-foreground/[0.06] bg-background/60 backdrop-blur-2xl backdrop-saturate-150"
            : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-14 max-w-[1200px] items-center px-6">
          <div className="flex min-w-0 flex-1 items-center">
            <Link href="/" className="group flex shrink-0 items-center gap-2">
              <BrandIcon
                width={24}
                height={24}
                className="rounded-[5px] transition-transform duration-300 group-hover:scale-110"
              />
              <span className="text-[14px] font-semibold tracking-tight text-foreground/80">
                wryte
              </span>
            </Link>
          </div>

          {items && (
            <nav className="hidden flex-1 items-center justify-center gap-1 md:flex">
              {items.map((item) =>
                "scrollTo" in item ? (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => onScrollTo?.(item.scrollTo)}
                    className="relative px-3 py-1.5 text-[13px] text-foreground/50 transition-colors duration-200 hover:text-foreground/80 dark:text-foreground/30 dark:hover:text-foreground/60"
                  >
                    {item.label}
                  </button>
                ) : (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="relative px-3 py-1.5 text-[13px] text-foreground/50 transition-colors duration-200 hover:text-foreground/80 dark:text-foreground/30 dark:hover:text-foreground/60"
                  >
                    {item.label}
                  </Link>
                ),
              )}
            </nav>
          )}

          <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
            <a
              href="https://github.com/rafay99-epic/wryte.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex size-8 items-center justify-center rounded-lg text-foreground/40 transition-colors duration-200 hover:text-foreground/70 dark:text-foreground/25 dark:hover:text-foreground/50"
            >
              <span className="sr-only">GitHub</span>
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="size-[15px]"
                aria-hidden="true"
              >
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z" />
              </svg>
            </a>
            <MarketingThemeToggle />
            {isSignedIn ? (
              <>
                <Link
                  href="/dashboard"
                  className="ml-1 inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-amber-500 px-3 text-[12px] font-medium text-black transition-all hover:bg-amber-400"
                >
                  Dashboard
                  <ArrowRight className="size-3" />
                </Link>
                <Link
                  href="/dashboard"
                  className="ml-0.5 flex shrink-0 items-center"
                >
                  {user?.imageUrl ? (
                    <Image
                      src={user.imageUrl}
                      alt={user.fullName ?? ""}
                      width={26}
                      height={26}
                      className="rounded-full ring-1 ring-foreground/[0.08]"
                    />
                  ) : (
                    <div className="flex size-[26px] items-center justify-center rounded-full bg-amber-500/15 text-[10px] font-semibold text-amber-400">
                      {user?.firstName?.[0] ?? "U"}
                    </div>
                  )}
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className="hidden px-2.5 py-1 text-[13px] text-foreground/50 transition-colors duration-200 hover:text-foreground/80 dark:text-foreground/30 dark:hover:text-foreground/60 sm:block"
                >
                  Log in
                </Link>
                <Link
                  href="/sign-up"
                  className="ml-1 inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-amber-500 px-3 text-[12px] font-medium text-black transition-all hover:bg-amber-400"
                >
                  Get Started
                  <ArrowUpRight className="size-3" />
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
