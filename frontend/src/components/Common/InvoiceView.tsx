import { Printer } from "lucide-react";
import { Modal } from "@/components/Common/Modal";
import { AuroraButton } from "@/components/Common/AuroraButton";
import { useTenant, getInvoiceSettings } from "@/hooks/useTenant";
import { formatCurrency, formatDate } from "@/lib/utils";

export interface InvoiceViewData {
  id: string;
  createdAt: string;
  billTo: { name: string; email?: string | null; phone?: string | null; address?: string | null };
  amount: string | number;
  tax: string | number;
  totalAmount: string | number;
  status: string;
  paidAt?: string | null;
  paymentMethod?: string | null;
}

interface InvoiceViewProps {
  open: boolean;
  onClose: () => void;
  invoice: InvoiceViewData | null;
}

export function InvoiceView({ open, onClose, invoice }: InvoiceViewProps) {
  const { tenant } = useTenant();
  const company = getInvoiceSettings(tenant);

  if (!invoice) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Invoice #${invoice.id.slice(0, 8).toUpperCase()}`}
      size="lg"
      footer={
        <>
          <AuroraButton variant="ghost" onClick={onClose}>
            Close
          </AuroraButton>
          <AuroraButton icon={<Printer size={16} />} onClick={() => window.print()}>
            Print / Save as PDF
          </AuroraButton>
        </>
      }
    >
      <div id="invoice-print-area" className="flex flex-col gap-6 text-sm text-aurora-text">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {tenant?.logoUrl ? (
              <img src={tenant.logoUrl} alt="" className="h-12 w-12 rounded-lg border border-aurora-border object-cover" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-aurora-accent text-lg font-bold text-white">
                {(company.companyName ?? tenant?.name ?? "?").charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-semibold">{company.companyName || tenant?.name}</p>
              {company.address && <p className="whitespace-pre-line text-xs text-aurora-text/60">{company.address}</p>}
              {company.taxId && <p className="text-xs text-aurora-text/60">Tax ID: {company.taxId}</p>}
            </div>
          </div>
          <div className="text-right">
            <h3 className="text-lg font-bold">Invoice</h3>
            <p className="text-xs text-aurora-text/50">{formatDate(invoice.createdAt)}</p>
            <span
              className={
                "aurora-badge mt-1 inline-block " +
                (invoice.status === "paid"
                  ? "border-aurora-success/40 text-aurora-success"
                  : invoice.status === "partial"
                    ? "border-aurora-warning/40 text-aurora-warning"
                    : "border-black/20 text-aurora-text/70")
              }
            >
              {invoice.status}
            </span>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-aurora-text/40">Bill to</p>
          <p className="mt-1 font-medium">{invoice.billTo.name}</p>
          {invoice.billTo.address && <p className="text-xs text-aurora-text/60">{invoice.billTo.address}</p>}
          {invoice.billTo.email && <p className="text-xs text-aurora-text/60">{invoice.billTo.email}</p>}
          {invoice.billTo.phone && <p className="text-xs text-aurora-text/60">{invoice.billTo.phone}</p>}
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wide text-aurora-text/40">
              <th className="py-2">Description</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-black/[0.06]">
              <td className="py-2.5">Services rendered</td>
              <td className="py-2.5 text-right">{formatCurrency(invoice.amount)}</td>
            </tr>
            <tr className="border-b border-black/[0.06]">
              <td className="py-2.5">Tax</td>
              <td className="py-2.5 text-right">{formatCurrency(invoice.tax)}</td>
            </tr>
            <tr>
              <td className="py-2.5 font-semibold">Total</td>
              <td className="py-2.5 text-right font-semibold">{formatCurrency(invoice.totalAmount)}</td>
            </tr>
          </tbody>
        </table>

        {(invoice.paidAt || invoice.paymentMethod) && (
          <p className="text-xs text-aurora-text/50">
            {invoice.paidAt && <>Paid {formatDate(invoice.paidAt)}</>}
            {invoice.paidAt && invoice.paymentMethod && " · "}
            {invoice.paymentMethod && <>via {invoice.paymentMethod}</>}
          </p>
        )}
      </div>
    </Modal>
  );
}
