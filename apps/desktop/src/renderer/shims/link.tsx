import type { AnchorHTMLAttributes, ReactNode } from "react";
import {
  Link as RouterLink,
  type LinkProps as RouterLinkProps,
} from "react-router";

type NextLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  children?: ReactNode;
};

/**
 * Shim for `next/link` — maps onto react-router's Link. Next-only props
 * (prefetch, replace semantics via prop, etc.) are accepted and ignored so
 * web sources compile and run unchanged.
 */
export function Link({ href, children, ...rest }: NextLinkProps) {
  return (
    <RouterLink to={href} {...(rest as Omit<RouterLinkProps, "to">)}>
      {children}
    </RouterLink>
  );
}

export default Link;
