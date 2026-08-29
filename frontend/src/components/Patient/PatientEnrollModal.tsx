import { useState } from "react";
import { Check } from "lucide-react";
import { api, getApiErrorMessage } from "@/lib/api";
import { Modal } from "@/components/Common/Modal";
import { AuroraButton } from "@/components/Common/AuroraButton";
import { GlassInput, GlassTextarea } from "@/components/Common/GlassInput";
import { useToast } from "@/components/Common/Toast";
import { cn } from "@/lib/utils";

const STEPS = ["Personal", "Contact", "Medical history", "Insurance"] as const;

const emptyForm = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  gender: "",
  bloodType: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  country: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  allergies: "",
  chronicConditions: "",
  medicalHistorySummary: "",
  insuranceProviderName: "",
  insurancePolicyNumber: "",
  insuranceGroupNumber: "",
  insuranceEffectiveDate: "",
  insuranceExpirationDate: "",
};

type FormState = typeof emptyForm;

interface PatientEnrollModalProps {
  open: boolean;
  onClose: () => void;
  onEnrolled: () => void;
}

function toTags(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function PatientEnrollModal({ open, onClose, onEnrolled }: PatientEnrollModalProps) {
  const { show } = useToast();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const reset = () => {
    setStep(0);
    setForm(emptyForm);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const canAdvance = step === 0 ? Boolean(form.firstName.trim() && form.lastName.trim() && form.dateOfBirth) : true;

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      const { data: patient } = await api.post<{ id: string }>("/patient/patients", {
        firstName: form.firstName,
        lastName: form.lastName,
        dateOfBirth: form.dateOfBirth,
        gender: form.gender || undefined,
        bloodType: form.bloodType || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
        address: form.address || undefined,
        city: form.city || undefined,
        country: form.country || undefined,
        emergencyContactName: form.emergencyContactName || undefined,
        emergencyContactPhone: form.emergencyContactPhone || undefined,
        allergies: toTags(form.allergies),
        chronicConditions: toTags(form.chronicConditions),
        medicalHistorySummary: form.medicalHistorySummary || undefined,
      });

      const hasInsurance = form.insuranceProviderName || form.insurancePolicyNumber || form.insuranceGroupNumber;
      if (hasInsurance) {
        try {
          await api.post("/patient/insurance", {
            patientId: patient.id,
            providerName: form.insuranceProviderName || undefined,
            policyNumber: form.insurancePolicyNumber || undefined,
            groupNumber: form.insuranceGroupNumber || undefined,
            effectiveDate: form.insuranceEffectiveDate || undefined,
            expirationDate: form.insuranceExpirationDate || undefined,
          });
        } catch {
          show("Patient enrolled, but insurance details couldn't be saved — add them from the patient's chart", "error");
        }
      }

      show("Patient enrolled", "success");
      handleClose();
      onEnrolled();
    } catch (err) {
      show(getApiErrorMessage(err, "Failed to enroll patient"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Enroll patient" size="lg">
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  i < step ? "bg-aurora-success text-white" : i === step ? "bg-aurora-accent text-white" : "bg-black/10 text-aurora-text/40",
                )}
              >
                {i < step ? <Check size={13} /> : i + 1}
              </div>
              <span className={cn("hidden text-xs font-medium sm:inline", i === step ? "text-aurora-text" : "text-aurora-text/40")}>{label}</span>
              {i < STEPS.length - 1 && <div className={cn("h-px flex-1", i < step ? "bg-aurora-success/40" : "bg-black/10")} />}
            </div>
          ))}
        </div>

        {step === 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <GlassInput label="First name" required value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
            <GlassInput label="Last name" required value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
            <GlassInput label="Date of birth" type="date" required value={form.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} />
            <GlassInput label="Gender" value={form.gender} onChange={(e) => set("gender", e.target.value)} />
            <GlassInput label="Blood type" placeholder="e.g. O+" value={form.bloodType} onChange={(e) => set("bloodType", e.target.value)} />
          </div>
        )}

        {step === 1 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <GlassInput label="Email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            <GlassInput label="Phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            <div className="sm:col-span-2">
              <GlassInput label="Address" value={form.address} onChange={(e) => set("address", e.target.value)} />
            </div>
            <GlassInput label="City" value={form.city} onChange={(e) => set("city", e.target.value)} />
            <GlassInput label="Country" value={form.country} onChange={(e) => set("country", e.target.value)} />
            <GlassInput label="Emergency contact name" value={form.emergencyContactName} onChange={(e) => set("emergencyContactName", e.target.value)} />
            <GlassInput label="Emergency contact phone" value={form.emergencyContactPhone} onChange={(e) => set("emergencyContactPhone", e.target.value)} />
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-4">
            <GlassInput
              label="Allergies"
              hint="Comma-separated — checked against new prescriptions"
              value={form.allergies}
              onChange={(e) => set("allergies", e.target.value)}
            />
            <GlassInput
              label="Chronic conditions"
              hint="Comma-separated"
              value={form.chronicConditions}
              onChange={(e) => set("chronicConditions", e.target.value)}
            />
            <GlassTextarea
              label="Medical history summary"
              rows={4}
              value={form.medicalHistorySummary}
              onChange={(e) => set("medicalHistorySummary", e.target.value)}
            />
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-aurora-text/50">Optional — skip if the patient isn't insured or you'll add this later.</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <GlassInput label="Insurance provider" value={form.insuranceProviderName} onChange={(e) => set("insuranceProviderName", e.target.value)} />
              <GlassInput label="Policy number" value={form.insurancePolicyNumber} onChange={(e) => set("insurancePolicyNumber", e.target.value)} />
              <GlassInput label="Group number" value={form.insuranceGroupNumber} onChange={(e) => set("insuranceGroupNumber", e.target.value)} />
              <div />
              <GlassInput
                label="Effective date"
                type="date"
                value={form.insuranceEffectiveDate}
                onChange={(e) => set("insuranceEffectiveDate", e.target.value)}
              />
              <GlassInput
                label="Expiration date"
                type="date"
                value={form.insuranceExpirationDate}
                onChange={(e) => set("insuranceExpirationDate", e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-black/10 pt-4">
          <AuroraButton variant="ghost" onClick={() => (step === 0 ? handleClose() : setStep((s) => s - 1))}>
            {step === 0 ? "Cancel" : "Back"}
          </AuroraButton>
          {step < STEPS.length - 1 ? (
            <AuroraButton onClick={() => setStep((s) => s + 1)} disabled={!canAdvance}>
              Next
            </AuroraButton>
          ) : (
            <AuroraButton isLoading={isSaving} onClick={handleSubmit}>
              Enroll patient
            </AuroraButton>
          )}
        </div>
      </div>
    </Modal>
  );
}
