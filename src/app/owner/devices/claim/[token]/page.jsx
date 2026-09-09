"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import {
  Server,
  Boxes3,
  Signal,
  Lock,
  ArrowRight,
  TriangleExclamation,
  PlugConnection,
} from "@gravity-ui/icons";
import { toast, Spinner } from "@heroui/react";

// Same Nordic UART Service UUIDs proven against real ESP32 firmware for
// WiFi setup — reused here since claiming a device now folds that same
// step into the claim flow itself.
const SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const CHARACTERISTIC_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"; // write
const NOTIFY_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"; // notify

export default function ClaimDevicePage() {
  const { token } = useParams();
  const router = useRouter();
  const [device, setDevice] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // "wifi" (must connect + configure first) → "name" (final step)
  const [step, setStep] = useState("wifi");
  const [isSupported, setIsSupported] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [wifiIp, setWifiIp] = useState(null);
  const [status, setStatus] = useState(null); // { tone, text }
  const charRef = useRef(null);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm({ defaultValues: { name: "" } });

  const {
    register: registerWifi,
    handleSubmit: handleWifiSubmit,
    formState: { isSubmitting: isSendingWifi },
  } = useForm({ defaultValues: { ssid: "", password: "" } });

  useEffect(() => {
    setIsSupported(typeof navigator !== "undefined" && !!navigator.bluetooth);
  }, []);

  useEffect(() => {
    fetch(`/api/proxy/devices/by-token/${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else if (data.ownerId) {
          setError("This device has already been claimed.");
        } else {
          setDevice(data);
        }
      })
      .catch((err) => {
        console.log(err);
        setError("Something went wrong.");
      })
      .finally(() => setIsLoading(false));
  }, [token]);

  const handleNotify = (event) => {
    const text = new TextDecoder().decode(event.target.value);
    if (text === "CONNECTING") {
      setStatus({ tone: "wait", text: "Connecting to WiFi…" });
    } else if (text.startsWith("CONNECTED,")) {
      const ip = text.slice("CONNECTED,".length);
      setStatus({ tone: "ok", text: `Connected! IP: ${ip}` });
      setWifiIp(ip);
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

  const onWifiSubmit = async (data) => {
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

  const onNameSubmit = async (data) => {
    try {
      const claimRes = await fetch(`/api/proxy/devices/${device._id}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.name }),
      });
      const claimed = await claimRes.json();
      if (!claimRes.ok) {
        toast.danger("Couldn't claim device", { description: claimed.error || "Please try again." });
        return;
      }

      // Only now does this account actually own the device, so recording
      // WiFi status (which requires ownership) has to happen after claim,
      // not before.
      if (wifiIp) {
        await fetch(`/api/proxy/devices/${device._id}/wifi-status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ip: wifiIp }),
        });
      }

      toast.success("Device claimed", { description: `${claimed.name} is ready to stock.` });
      router.push(`/owner/catalog?device=${device._id}`);
    } catch (err) {
      console.log(err);
      toast.danger("Couldn't claim device", { description: "Something went wrong." });
    }
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-surface">
        <p className="font-body-md text-body-md text-on-surface-variant">Checking this device…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-6 text-center">
        <TriangleExclamation className="h-8 w-8 text-error mb-3" />
        <p className="font-headline-sm text-headline-sm text-on-surface">{error}</p>
        <button
          onClick={() => router.push("/owner/devices")}
          className="mt-4 rounded-full bg-primary-container px-5 py-2.5 font-label-lg text-label-lg text-on-primary cursor-pointer"
        >
          Back to my devices
        </button>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-md rounded-[2.5rem] bg-surface-container-low p-8 shadow-[12px_12px_28px_rgba(184,196,214,0.65),-12px_-12px_28px_rgba(255,255,255,0.95)]">
        {step === "wifi" ? (
          <>
            <h1 className="font-headline-lg text-headline-lg text-on-surface text-center mb-1">
              Connect this machine
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant text-center mb-6">
              First, get it online — connect over Bluetooth and send its WiFi details.
            </p>

            {!isSupported ? (
              <div className="flex items-center gap-2 rounded-2xl bg-error-container p-4">
                <TriangleExclamation className="h-4 w-4 text-on-error-container shrink-0" />
                <p className="font-body-sm text-body-sm text-on-error-container">
                  This browser can't do Bluetooth setup. Use Chrome or Edge.
                </p>
              </div>
            ) : !isConnected ? (
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-primary-container px-5 py-3.5 font-label-lg text-label-lg text-on-primary disabled:opacity-70 cursor-pointer"
              >
                {isConnecting ? <Spinner size="sm" color="current" /> : <PlugConnection className="h-4 w-4" />}
                {isConnecting ? "Connecting…" : "Connect to board"}
              </button>
            ) : (
              <form onSubmit={handleWifiSubmit(onWifiSubmit)} className="flex flex-col gap-4">
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
                      {...registerWifi("ssid", { required: true })}
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
                      {...registerWifi("password")}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSendingWifi}
                  className="flex items-center justify-center gap-2 rounded-full bg-primary-container px-5 py-3.5 font-label-lg text-label-lg text-on-primary disabled:opacity-70 cursor-pointer"
                >
                  {isSendingWifi ? <Spinner size="sm" color="current" /> : <ArrowRight className="h-4 w-4" />}
                  Send to board
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

                {status?.tone === "ok" && (
                  <button
                    type="button"
                    onClick={() => setStep("name")}
                    className="flex items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 py-3.5 font-label-lg text-label-lg text-white cursor-pointer"
                  >
                    <ArrowRight className="h-4 w-4" />
                    Continue
                  </button>
                )}
              </form>
            )}
          </>
        ) : (
          <>
            <h1 className="font-headline-lg text-headline-lg text-on-surface text-center mb-1">
              Name this machine
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant text-center mb-6">
              It's online — last step before you can start stocking it.
            </p>

            <div className="mb-4 flex items-center justify-center gap-1.5 rounded-full bg-surface px-4 py-2">
              <Boxes3 className="h-4 w-4 text-tertiary" />
              <span className="font-label-md text-label-md text-on-surface-variant">
                This device has {device?.slotCount} slots
              </span>
            </div>

            <form onSubmit={handleSubmit(onNameSubmit)} className="flex flex-col gap-4">
              <div className="space-y-1.5">
                <label className="block font-label-md text-label-md text-on-surface font-semibold">
                  Name this machine
                </label>
                <div className="relative flex items-center rounded-full bg-surface px-4 py-3 shadow-[inset_3px_3px_6px_rgba(184,196,214,0.5)]">
                  <Server className="text-tertiary w-4 h-4 mr-2.5 shrink-0" />
                  <input
                    type="text"
                    placeholder="Library 2nd Floor"
                    className="w-full bg-transparent font-body-md text-body-md text-on-surface focus:outline-none"
                    {...register("name", { required: true })}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 flex items-center justify-center gap-2 rounded-full bg-primary-container px-5 py-3.5 font-label-lg text-label-lg text-on-primary disabled:opacity-70 cursor-pointer"
              >
                {isSubmitting ? <Spinner size="sm" color="current" /> : <ArrowRight className="h-4 w-4" />}
                {isSubmitting ? "Saving…" : "Save and start stocking"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
