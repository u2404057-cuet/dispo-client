"use client";

import { Capacitor } from "@capacitor/core";
import { BleClient } from "@capacitor-community/bluetooth-le";

// Same Nordic UART Service UUIDs proven against real ESP32 firmware —
// shared by every BLE-using page in the app, native or browser.
export const SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
export const WRITE_CHAR_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e"; // write
export const NOTIFY_CHAR_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"; // notify

export const isNativePlatform = () => Capacitor.isNativePlatform();

/**
 * Connects to the board and returns a small, platform-agnostic handle:
 * { write(text), disconnect() }. Every calling page uses this same shape
 * regardless of whether it's running inside the native app (real
 * CoreBluetooth/Android Bluetooth via @capacitor-community/bluetooth-le)
 * or a plain browser (Web Bluetooth via navigator.bluetooth).
 *
 * onNotify receives each notification already decoded to a string, so
 * calling pages parse "CONNECTED,<ip>" / "DEVICEID_SET" / etc. the exact
 * same way on both platforms.
 */
export async function connectToBoard({ onNotify, onDisconnect } = {}) {
  if (isNativePlatform()) {
    // androidNeverForLocation: true matches the AndroidManifest.xml
    // change already made, so scanning doesn't require location
    // permission on Android 12+.
    await BleClient.initialize({ androidNeverForLocation: true });

    // Android can prompt the user to turn Bluetooth on with a native
    // system dialog, so they don't have to leave the app first. iOS
    // deliberately has no equivalent — Apple never lets apps
    // programmatically enable Bluetooth, only the user can.
    if (Capacitor.getPlatform() === "android") {
      const enabled = await BleClient.isEnabled();
      if (!enabled) {
        await BleClient.requestEnable();
      }
    }

    const device = await BleClient.requestDevice({
      services: [SERVICE_UUID],
    });

    await BleClient.connect(device.deviceId, () => {
      onDisconnect?.();
    });

    if (onNotify) {
      await BleClient.startNotifications(
        device.deviceId,
        SERVICE_UUID,
        NOTIFY_CHAR_UUID,
        (value) => {
          onNotify(new TextDecoder().decode(value));
        }
      );
    }

    return {
      write: async (text) => {
        const bytes = new TextEncoder().encode(text);
        await BleClient.writeWithoutResponse(
          device.deviceId,
          SERVICE_UUID,
          WRITE_CHAR_UUID,
          new DataView(bytes.buffer)
        );
      },
      disconnect: async () => {
        await BleClient.disconnect(device.deviceId);
      },
    };
  }

  // Browser path — unchanged from what's already proven against real hardware.
  const btDevice = await navigator.bluetooth.requestDevice({
    filters: [{ services: [SERVICE_UUID] }],
    optionalServices: [SERVICE_UUID],
  });

  if (onDisconnect) {
    btDevice.addEventListener("gattserverdisconnected", () => onDisconnect());
  }

  const server = await btDevice.gatt.connect();
  const service = await server.getPrimaryService(SERVICE_UUID);
  const writeChar = await service.getCharacteristic(WRITE_CHAR_UUID);

  if (onNotify) {
    const notifyChar = await service.getCharacteristic(NOTIFY_CHAR_UUID);
    await notifyChar.startNotifications();
    notifyChar.addEventListener("characteristicvaluechanged", (e) => {
      onNotify(new TextDecoder().decode(e.target.value));
    });
  }

  return {
    write: async (text) => {
      const bytes = new TextEncoder().encode(text);
      await writeChar.writeValueWithoutResponse(bytes);
    },
    disconnect: async () => {
      btDevice.gatt.disconnect();
    },
  };
}

// Camera/QR support check — real on every platform except, notably,
// iOS Safari specifically requires HTTPS (already true for both the
// deployed site and the native app's own security context).
export function isBluetoothSupported() {
  if (isNativePlatform()) return true; // native plugin always available once installed
  return typeof navigator !== "undefined" && !!navigator.bluetooth;
}
