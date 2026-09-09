"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart-context";
import { toast, Spinner } from "@heroui/react";
import { CircleCheck } from "@gravity-ui/icons";

export default function CheckoutPage() {
  const router = useRouter();
  const { items, total, deviceId, clearCart } = useCart();
  const [isPlacing, setIsPlacing] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState(null);

  const placeOrder = async () => {
    setIsPlacing(true);
    try {
      const res = await fetch("/api/proxy/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId,
          items: items.map((i) => ({ slotNumber: i.slotNumber, qty: i.qty })),
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast.danger("Couldn't place order", { description: result.error || "Please try again." });
        return;
      }
      setConfirmedOrder(result);
      clearCart();
    } catch (error) {
      console.log(error);
      toast.danger("Couldn't place order", { description: "Something went wrong." });
    } finally {
      setIsPlacing(false);
    }
  };

  if (confirmedOrder) {
    return (
      <main className="flex min-h-[calc(100vh-73px)] flex-col items-center justify-center px-6 text-center">
        <CircleCheck className="h-10 w-10 text-primary mb-3" />
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Order placed</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1 max-w-xs">
          Order #{confirmedOrder._id.slice(-6)} — ৳{confirmedOrder.total} confirmed.
        </p>
        <button
          onClick={() => router.push(`/shop/browse?device=${confirmedOrder.deviceId}`)}
          className="mt-6 rounded-full bg-primary-container px-5 py-2.5 font-label-lg text-label-lg text-on-primary cursor-pointer"
        >
          Continue browsing
        </button>
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="flex min-h-[calc(100vh-73px)] items-center justify-center px-6 text-center">
        <p className="font-body-md text-body-md text-on-surface-variant">Your cart is empty.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-10">
      <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">Checkout</h1>
      <p className="font-body-sm text-body-sm text-on-surface-variant mb-6 rounded-xl bg-surface-container-low p-3">
        This is a test checkout — no real payment is processed yet. Placing this order will
        record a real sale and reduce real stock.
      </p>

      <div className="flex flex-col gap-2 mb-6">
        {items.map((item) => (
          <div key={item.slotNumber} className="flex items-center justify-between font-body-md text-body-md text-on-surface">
            <span>{item.qty} × {item.name}</span>
            <span>৳{item.price * item.qty}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-6 border-t border-surface-container-high pt-4">
        <span className="font-headline-sm text-headline-sm text-on-surface">Total</span>
        <span className="font-headline-lg text-headline-lg text-primary">৳{total}</span>
      </div>

      <button
        onClick={placeOrder}
        disabled={isPlacing}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-primary-container px-5 py-3.5 font-label-lg text-label-lg text-on-primary disabled:opacity-70 cursor-pointer"
      >
        {isPlacing && <Spinner size="sm" color="current" />}
        {isPlacing ? "Placing order..." : "Place order"}
      </button>
    </main>
  );
}
