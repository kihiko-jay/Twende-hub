import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Smartphone, CheckCircle, AlertTriangle } from "lucide-react";
import { motion } from "motion/react";
import { useAuth } from "@/contexts/AuthContext";
import { initiatePayment, pollPaymentStatus, validatePhone } from "@/services/payments.ts";

type PaymentType = "creation" | "feature" | "participant";

interface StatusResponse {
  status: 'pending' | 'success' | 'failed';
  type: PaymentType;
  event_id: number;
  booking_id: number | null;
  mpesa_receipt_number: string | null;
}

type Step = "input" | "waiting" | "success" | "error";

export default function Payment() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();

  const eventId = Number(searchParams.get("event_id") ?? "0");
  const type = (searchParams.get("type") as PaymentType) || "creation";
  const amountParam = Number(searchParams.get("amount") ?? "0");

  const [phone, setPhone] = useState(user?.phone ?? "");
  const [step, setStep] = useState<Step>("input");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [checkoutId, setCheckoutId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const amount =
    type === "feature" ? 500 : type === "creation" ? 1000 : amountParam;
  const purpose =
    type === "feature"
      ? "Event Featured Listing Upgrade"
      : type === "creation"
      ? "Event Creation Fee"
      : "Event Participation Fee";

  const isDev = typeof window !== "undefined" && window.location.hostname === "localhost";


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !eventId) return;
    setError(null);
    if (!validatePhone(phone)) {
      setError("Enter a valid Kenyan M-Pesa number starting with 07, 01, or +254.");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await initiatePayment({
        event_id: eventId,
        type,
        phone_number: phone,
        ...(type === "participant" ? { amount } : {}),
      }, token);
      setCheckoutId(res.checkout_request_id);
      setStep("waiting");
      pollStatus(res.checkout_request_id);
    } catch (e: any) {
      setError(
        e?.message || "We could not start the payment. Please check your number and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };


const pollStatus = async (checkout: string | null) => {
  if (!checkout || !token) return;
  try {
    const res = await pollPaymentStatus(checkout, token);
    setStatus(res as StatusResponse);
    if (res.status === "success") {
      setStep("success");
      setTimeout(() => {
        navigate(`/events/${res.event_id}`);
      }, 3000);
    } else if (res.status === "failed") {
      setStep("error");
      setError("Payment failed or was cancelled. Please try again.");
    }
  } catch (e: any) {
    setStep("error");
    setError(e?.message || "Payment is taking longer than expected. Please try again.");
  }
};


  const reset = () => {
    setStep("input");
    setStatus(null);
    setCheckoutId(null);
    setError(null);
  };

  useEffect(() => {
    if (!eventId) {
      setError("Missing event information for this payment.");
    }
  }, [eventId]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-warm-off-white px-4">
      <div className="max-w-md w-full card p-8 text-center">
        {isDev && (
          <div className="mb-4 rounded-full bg-amber-50 border border-amber-200 px-4 py-1 text-xs text-amber-800">
            Dev mode — payment will auto-approve in 3 seconds.
          </div>
        )}

        {step === "input" && (
          <>
            <h1 className="text-3xl font-serif font-bold text-stone-900 mb-2">
              Confirm M-Pesa Payment
            </h1>
            <p className="text-stone-500 mb-6 text-sm">
              We&apos;ll send a secure M-Pesa STK Push to your phone for:
            </p>
            <div className="bg-stone-50 rounded-2xl p-5 mb-6 text-left">
              <div className="flex justify-between mb-2">
                <span className="text-stone-400 text-sm">Amount</span>
                <span className="font-bold">KES {amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-400 text-sm">For</span>
                <span className="text-sm font-medium text-stone-700">{purpose}</span>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-stone-500 mb-2">
                  M-Pesa Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="07..., 01..., or +254..."
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-olive-drab/20"
                  required
                />
              </div>
              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-xl">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={isSubmitting || !eventId}
                className="olive-button w-full py-3 text-lg disabled:opacity-50"
              >
                {isSubmitting ? "Sending request..." : "Pay Now"}
              </button>
            </form>
          </>
        )}

        {step === "waiting" && (
          <div className="flex flex-col items-center">
            <motion.div
              className="w-20 h-20 rounded-full bg-olive-drab/10 flex items-center justify-center mb-6"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 1.6 }}
            >
              <Smartphone className="text-olive-drab" size={36} />
            </motion.div>
            <h1 className="text-2xl font-serif font-bold text-stone-900 mb-2">
              Check your phone
            </h1>
            <p className="text-stone-600 text-sm mb-4">
              We&apos;ve sent a payment request to <span className="font-semibold">{phone}</span>.
              Enter your M-Pesa PIN on your phone to approve.
            </p>
            <p className="text-xs text-stone-400">
              This screen will update automatically once payment is confirmed.
            </p>
          </div>
        )}

        {step === "success" && status && (
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mb-6">
              <CheckCircle className="text-emerald-500" size={40} />
            </div>
            <h1 className="text-2xl font-serif font-bold text-stone-900 mb-2">
              Payment confirmed
            </h1>
            <p className="text-stone-600 text-sm mb-4">
              Your payment for <span className="font-semibold">{purpose}</span> was successful.
            </p>
            {status.mpesa_receipt_number && (
              <div className="bg-stone-50 rounded-2xl p-4 text-left w-full mb-4">
                <div className="flex justify-between">
                  <span className="text-stone-400 text-xs">M-Pesa Receipt</span>
                  <span className="font-mono text-xs">{status.mpesa_receipt_number}</span>
                </div>
              </div>
            )}
            <p className="text-xs text-stone-400">
              Redirecting you to the event page...
            </p>
          </div>
        )}

        {step === "error" && (
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mb-6">
              <AlertTriangle className="text-red-500" size={40} />
            </div>
            <h1 className="text-2xl font-serif font-bold text-stone-900 mb-2">
              Payment issue
            </h1>
            <p className="text-stone-600 text-sm mb-4">
              {error ??
                "We could not complete your payment. You can try again or contact support if the problem persists."}
            </p>
            <p className="text-xs text-stone-500 mb-4">
              Support:{" "}
              <a href="mailto:support@twendehub.com" className="text-olive-drab font-medium">
                support@twendehub.com
              </a>
            </p>
            <button
              type="button"
              className="olive-button w-full py-3 text-sm mb-2"
              onClick={reset}
            >
              Try Again
            </button>
            <button
              type="button"
              className="w-full rounded-full border border-stone-300 py-2 text-sm text-stone-700"
              onClick={() => navigate(eventId ? `/events/${eventId}` : "/")}
            >
              Back to events
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

