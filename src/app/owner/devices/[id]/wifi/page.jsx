"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { PlugConnection, Signal, Lock, ArrowRight, ArrowLeft, CircleCheck, TriangleExclamation } from "@gravity-ui/icons";
import { toast, Spinner } from "@heroui/react";

// Real hardware UUIDs — the same Nordic UART Service pattern proven against
// actual ESP32 firmware. Every kiosk running the same firmware shares these;
// only the physical board's advertised name differs.
const SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const CHARACTERISTIC_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"; // write
const NOTIFY_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"; // notify

export default function DeviceWifiSetupPage() {
  const { id } = useParams();
  const [device, setDevice] = useState(null);
  const [isSupported, setIsSupported] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState(null); // { tone: "wait" | "ok" | "fault", text }

  const charRef = useRef(null);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm({ defaultValues: { ssid: "", password: "" } });

  useEffect(() => {
    setIsSupported(typeof navigator !== "undefined" && !!navigator.bluetooth);
  }, []);

  useEffect(() => {
    fetch("/api/proxy/devices")
      .then((res) => res.json())
      .then((devices) => {
        const match = Array.isArray(devices) ? devices.find((d) => d._id === id) : null;
        setDevice(match || null);
      })
      .catch((error) => console.log(error));
  }, [id]);

  const recordWifiStatus = async (ip) => {
    try {
      await fetch(`/api/proxy/devices/${id}/wifi-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip }),
      });
      setDevice((prev) => (prev ? { ...prev, lastKnownIp: ip, wifiConfiguredAt: new Date().toISOString() } : prev));
    } catch (error) {
      console.log(error);
    }
  };

  const handleNotify = (event) => {
    const text = new TextDecoder().decode(event.target.value);
    if (text === "CONNECTING") {
      setStatus({ tone: "wait", text: "Connecting to WiFi…" });
    } else if (text.startsWith("CONNECTED,")) {
      const ip = text.slice("CONNECTED,".length);
      setStatus({ tone: "ok", text: `Connected! IP: ${ip}` });
      recordWifiStatus(ip);
    } else if (text === "FAILED") {
      setStatus({ tone: "fault", text: "Couldn't join that network — check the password and try again." });
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const btDevice = await navigator.bluetooth.requestDevice({
        filters: [{ services: [SERVICE_UUID] }],
        optionalServices: [SERVICE_UUID],
      });

      btDevice.addEventListener("gattserverdisconnected", () => {
        setIsConnected(false);
        charRef.current = null;
        setStatus({ tone: "fault", text: "Bluetooth connection lost" });
      });

      const server = await btDevice.gatt.connect();
      const service = await server.getPrimaryService(SERVICE_UUID);
      const writeChar = await service.getCharacteristic(CHARACTERISTIC_UUID);
      const notifyChar = await service.getCharacteristic(NOTIFY_UUID);

      await notifyChar.startNotifications();
      notifyChar.addEventListener("characteristicvaluechanged", handleNotify);

      charRef.current = writeChar;
      setIsConnected(true);
      toast.success("Connected to board", { description: "Now enter the WiFi details below." });
    } catch (error) {
      console.log(error);
      toast.danger("Couldn't connect", {
        description: error.message || "Make sure the board is powered on and nearby.",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const onSubmit = async (data) => {
    if (!charRef.current) {
      toast.danger("Not connected", { description: "Connect to the board first." });
      return;
    }
    if (data.password && data.password.length < 8) {
      toast.danger("Password too short", {
        description: "Use 8 characters or more, or leave it empty for an open network.",
      });
      return;
    }
    try {
      const command = `${data.ssid},${data.password}\n`;
      const bytes = new TextEncoder().encode(command);
      await charRef.current.writeValueWithoutResponse(bytes);
      setStatus({ tone: "wait", text: "Sent — waiting for the board to respond…" });
    } catch (error) {
      console.log(error);
      toast.danger("Couldn't send", {
        description: "The Bluetooth connection may have dropped — reconnect and try again.",
      });
    }
  };

  if (!isSupported) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface px-6 text-center">
        <div>
          <TriangleExclamation className="h-8 w-8 text-error mb-3 mx-auto" />
          <p className="font-headline-sm text-headline-sm text-on-surface">
            This browser can't do Bluetooth setup
          </p>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1 max-w-sm">
            Open this page in Chrome or Edge on Android, Windows, macOS, or Linux.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="w-full min-h-screen py-10 px-6">
      <div className="mx-auto max-w-md">
        <Link
          href="/owner/devices"
          className="mb-4 inline-flex items-center gap-1.5 font-label-md text-label-md text-on-surface-variant hover:text-primary-container transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to devices
        </Link>

        <h1 className="font-headline-lg text-headline-lg text-on-surface mb-1">
          WiFi setup{device ? ` — ${device.name}` : ""}
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant mb-6">
          Connect over Bluetooth once, then send the machine its WiFi details.
        </p>

        {device?.wifiConfiguredAt && (
          <div className="mb-6 flex items-center gap-2 rounded-2xl bg-surface-container-low p-4">
            <CircleCheck className="h-4 w-4 text-primary shrink-0" />
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Last configured with IP{" "}
              <span className="text-on-surface font-semibold">{device.lastKnownIp}</span>
            </p>
          </div>
        )}

        {!isConnected ? (
          <button
            onClick={handleConnect}
            disabled={isConnecting}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-primary-container px-5 py-3.5 font-label-lg text-label-lg text-on-primary disabled:opacity-70 cursor-pointer"
          >
            {isConnecting ? <Spinner size="sm" color="current" /> : <PlugConnection className="h-4 w-4" />}
            {isConnecting ? "Connecting…" : "Connect to board"}
          </button>
        ) : (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-4 rounded-[2rem] bg-surface-container-low p-6 shadow-[12px_12px_28px_rgba(184,196,214,0.65),-12px_-12px_28px_rgba(255,255,255,0.95)]"
          >
            <div className="space-y-1.5">
              <label className="block font-label-md text-label-md text-on-surface font-semibold">
                Network name
              </label>
              <div className="relative flex items-center rounded-full bg-surface-container px-4 py-3">
                <Signal className="text-tertiary w-4 h-4 mr-2.5 shrink-0" />
                <input
                  type="text"
                  maxLength={32}
                  placeholder="Your WiFi name"
                  className="w-full bg-transparent font-body-md text-body-md text-on-surface placeholder:text-tertiary focus:outline-none"
                  {...register("ssid", { required: true })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block font-label-md text-label-md text-on-surface font-semibold">
                Password
              </label>
              <div className="relative flex items-center rounded-full bg-surface-container px-4 py-3">
                <Lock className="text-tertiary w-4 h-4 mr-2.5 shrink-0" />
                <input
                  type="password"
                  placeholder="Leave empty for open network"
                  className="w-full bg-transparent font-body-md text-body-md text-on-surface placeholder:text-tertiary focus:outline-none"
                  {...register("password")}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || status?.tone === "ok"}
              className={`flex items-center justify-center gap-2 rounded-full px-5 py-3.5 font-label-lg text-label-lg transition-colors cursor-pointer disabled:cursor-not-allowed ${
                status?.tone === "ok"
                  ? "bg-emerald-500 text-white disabled:opacity-100"
                  : "bg-primary-container text-on-primary disabled:opacity-70"
              }`}
            >
              {status?.tone === "ok" ? (
                <CircleCheck className="h-4 w-4" />
              ) : isSubmitting ? (
                <Spinner size="sm" color="current" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              {status?.tone === "ok" ? "Connected" : "Send to board"}
            </button>

            {status && (
              <div
                className={`rounded-2xl p-3 text-center font-body-sm text-body-sm ${
                  status.tone === "ok"
                    ? "bg-primary-fixed text-on-primary-fixed-variant"
                    : status.tone === "fault"
                    ? "bg-error-container text-on-error-container"
                    : "bg-surface-container text-on-surface-variant"
                }`}
              >
                {status.text}
              </div>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
