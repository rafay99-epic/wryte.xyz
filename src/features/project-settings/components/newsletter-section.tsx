"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Loader2, Mail, XCircle } from "lucide-react";
import { useState } from "react";
import { ConfirmActionDialog } from "@/components/settings/confirm-action-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ALL_NEWSLETTER_PROVIDERS } from "../../../../convex/newsletter/_lib/providers";
import { useNewsletterSection } from "../hooks/use-newsletter-section";
import type { ProjectData } from "../types";
import { Divider, FieldGroup, SaveButton, SectionHeader } from "./shared";

export function NewsletterSection({
  projectId,
}: {
  projectId: Id<"projects">;
  project: ProjectData;
}) {
  const section = useNewsletterSection({ projectId });
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <motion.div variants={staggerItem}>
        <SectionHeader
          icon={Mail}
          title="Newsletter"
          description="Compose newsletters in Wryte and send them through your own provider."
        />
      </motion.div>

      <motion.div variants={staggerItem} className="space-y-5">
        {section.connection ? (
          <ConnectedView
            section={section}
            onDisconnect={() => setConfirmDisconnect(true)}
          />
        ) : (
          <DisconnectedView section={section} />
        )}
      </motion.div>

      <ConfirmActionDialog
        open={confirmDisconnect}
        onOpenChange={setConfirmDisconnect}
        title="Disconnect newsletter provider?"
        description="Sending newsletters stops until you reconnect. Already-sent campaigns are unaffected."
        confirmLabel="Disconnect"
        onConfirm={() => void section.handleDisconnect()}
      />
    </motion.div>
  );
}

function DisconnectedView({
  section,
}: {
  section: ReturnType<typeof useNewsletterSection>;
}) {
  const provider = ALL_NEWSLETTER_PROVIDERS.find(
    (p) => p.id === section.selectedProvider,
  );

  return (
    <>
      <p className="text-xs text-muted-foreground">
        Write newsletters in Wryte and send them through your own provider —
        Wryte never sends email itself, so you stay on your provider's free
        tier.
      </p>

      <Divider />

      <div className="flex flex-wrap gap-2">
        {ALL_NEWSLETTER_PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={p.comingSoon}
            onClick={() => section.setSelectedProvider(p.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              p.comingSoon
                ? "cursor-not-allowed bg-muted/30 text-muted-foreground/50"
                : section.selectedProvider === p.id
                  ? "bg-primary/15 text-foreground ring-1 ring-primary/40"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {p.label}
            {p.comingSoon && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground/70">
                Coming soon
              </span>
            )}
          </button>
        ))}
      </div>

      {provider && !provider.comingSoon && (
        <>
          <p className="text-[11px] text-muted-foreground/60">
            1. {provider.label} → Settings → SMTP & API → API Keys → Generate.
            2. Paste it below.
          </p>

          <FieldGroup
            label="API key"
            htmlFor="newsletter-api-key"
            hint={`Create one at ${provider.dashboardUrl.replace("https://", "")}`}
          >
            <Input
              id="newsletter-api-key"
              type="password"
              value={section.apiKey}
              onChange={(e) => section.setApiKey(e.target.value)}
              placeholder="Paste your API key"
            />
            {section.error && (
              <p className="mt-1 text-xs text-red-600">{section.error}</p>
            )}
          </FieldGroup>

          <SaveButton
            isSaving={section.busy === "connect"}
            disabled={!section.apiKey.trim()}
            onClick={() => void section.handleConnect()}
            label="Connect"
          />
        </>
      )}
    </>
  );
}

function ConnectedView({
  section,
  onDisconnect,
}: {
  section: ReturnType<typeof useNewsletterSection>;
  onDisconnect: () => void;
}) {
  const conn = section.connection;
  if (!conn) return null;
  const provider = ALL_NEWSLETTER_PROVIDERS.find((p) => p.id === conn.provider);
  const busy = section.busy;

  return (
    <div className="space-y-4 rounded-lg border border-border/60 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          {provider?.label ?? conn.provider}
        </p>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
            conn.status === "active"
              ? "bg-emerald-500/10 text-emerald-600"
              : "bg-red-500/10 text-red-600",
          )}
        >
          {conn.status === "active" ? (
            <CheckCircle2 className="size-3" />
          ) : (
            <XCircle className="size-3" />
          )}
          {conn.status === "active" ? "Connected · active" : "Invalid"}
        </span>
      </div>

      {conn.senderEmail && (
        <p className="text-xs text-muted-foreground">
          Sends from {conn.senderEmail}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {conn.lists.length} contact list{conn.lists.length === 1 ? "" : "s"}{" "}
        found
      </p>
      {conn.lastError && (
        <p className="text-xs text-red-600">{conn.lastError}</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={busy !== null}
          onClick={() => void section.handleTest()}
        >
          {busy === "test" && <Loader2 className="size-3.5 animate-spin" />}
          Test Connection
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy !== null}
          onClick={onDisconnect}
          className="text-red-600 hover:text-red-700"
        >
          {busy === "disconnect" && (
            <Loader2 className="size-3.5 animate-spin" />
          )}
          Disconnect
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground/60">
        Compose and send newsletters from the Newsletters item in your project
        sidebar.
      </p>
    </div>
  );
}
