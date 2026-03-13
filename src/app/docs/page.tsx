import { redirect } from "next/navigation";

// Per Phase1_Implementation.md Section 10.2:
// /docs → Redirect to docs.thequantcloud.com
export default function DocsPage() {
  redirect("https://docs.thequantcloud.com");
}
