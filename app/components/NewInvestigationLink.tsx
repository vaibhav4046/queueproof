import { ArrowRight, FileSearch2 } from "lucide-react";
import Link from "next/link";

type NewInvestigationLinkProps = {
  placement?: "sidebar" | "heading";
};

export function NewInvestigationLink({ placement = "sidebar" }: NewInvestigationLinkProps) {
  const className = placement === "heading"
    ? "new-investigation new-investigation-inline"
    : "new-investigation";

  return (
    <Link className={className} href="/">
      <FileSearch2 aria-hidden="true" size={16} strokeWidth={1.8} />
      <span>New investigation</span>
      <ArrowRight
        aria-hidden="true"
        className="new-investigation-arrow"
        size={14}
        strokeWidth={1.8}
      />
    </Link>
  );
}
