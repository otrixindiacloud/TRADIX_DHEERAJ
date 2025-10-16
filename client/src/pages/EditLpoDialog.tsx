import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { SupplierLpo } from "@shared/schema";

export default function EditLpoDialog({ lpo, open, onClose, onSave }: {
  lpo: SupplierLpo;
  open: boolean;
  onClose: () => void;
  onSave: (updates: Partial<SupplierLpo>) => void;
}) {
  const [form, setForm] = useState<Partial<SupplierLpo>>({ ...lpo as SupplierLpo });
  const [saving, setSaving] = useState(false);

  const handleChange = (field: keyof SupplierLpo, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave(form);
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Supplier LPO</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">LPO Number</label>
            <Input
              value={form.lpoNumber || ""}
              onChange={e => handleChange("lpoNumber", e.target.value)}
              disabled={saving}
              readOnly
              className="bg-gray-50 cursor-not-allowed"
            />
          </div>
          {/* <div>
            <label className="block text-sm font-medium mb-1">Supplier ID</label>
            <Input
              value={form.supplierId || ""}
              onChange={e => handleChange("supplierId", e.target.value)}
              disabled={saving}
            />
          </div> */}
          <div>
            <label className="block text-sm font-medium mb-1">Total Amount</label>
            <Input
              type="number"
              value={form.totalAmount || ""}
              onChange={e => handleChange("totalAmount", e.target.value)}
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Expected Delivery Date</label>
            <Input
              type="date"
              value={
                form.expectedDeliveryDate
                  ? typeof form.expectedDeliveryDate === "string"
                    ? (form.expectedDeliveryDate as string).slice(0, 10)
                    : new Date(form.expectedDeliveryDate as Date).toISOString().slice(0, 10)
                  : ""
              }
              onChange={e => handleChange("expectedDeliveryDate", e.target.value)}
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={form.status || ""}
              onChange={e => handleChange("status", e.target.value)}
              disabled={saving}
              className="border rounded px-2 py-1 w-full"
            >
              <option value="">Select status</option>
              <option value="Draft">Draft</option>
              <option value="Sent">Sent</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Received">Received</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving} className="bg-blue-600 text-white">{saving ? "Saving..." : "Save"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}