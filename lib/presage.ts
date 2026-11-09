import type { SignalHandlers, SignalProvider } from "@/types/signals";

// The key is read from the .env.local file (see the setup steps).
export const PRESAGE_API_KEY = process.env.NEXT_PUBLIC_PRESAGE_API_KEY ?? "";

// The small part of the SDK's answer that we read.
type Detection = { detected?: boolean; timestamp?: number };
type Reading = { value?: number; timestamp?: number };
type DecodedMetrics = {
  breathing?: { rate?: Reading[] };
  face?: { blinking?: Detection[]; talking?: Detection[] };
};

export const MISSING_KEY = "MISSING_KEY";

// Turns any error into a short, plain message for the screen.
export function friendlyError(err: unknown): string {
  const text =
    err instanceof Error ? `${err.name} ${err.message}` : String(err);
  if (text.includes(MISSING_KEY)) {
    return "Your Presage API key is missing. Add it to the .env.local file and restart the app.";
  }
  if (/NotAllowed|Permission|denied/i.test(text)) {
    return "Please allow camera access to use this feature.";
  }
  if (/NotFound|Devices|input.?unavailable/i.test(text)) {
    return "We could not find a camera. Please connect one and try again.";
  }
  if (/Authentication/i.test(text)) {
    return "Presage did not accept the API key. Please check it and try again.";
  }
  return "We couldn't start your session. Please try again.";
}

// Connects the app to Presage SmartSpectra. This is the ONLY file that
// knows about the SDK. Face + breathing readings are requested.
export function createPresageProvider(
  handlers: SignalHandlers,
): SignalProvider {
  let sdk: import("@smartspectra/node-sdk/renderer").SmartSpectraSDK | null =
    null;

  async function build() {
    if (!PRESAGE_API_KEY) throw new Error(MISSING_KEY);

    // Loaded here (not at the top) so the page can still be built
    // without a camera or the SDK being available.
    const renderer = await import("@smartspectra/node-sdk/renderer");
    const messages = await import("@smartspectra/node-sdk/messages");

    const instance = new renderer.SmartSpectraSDK({
      apiKey: PRESAGE_API_KEY,
      requestedMetrics: [...renderer.breathingMetrics, ...renderer.faceMetrics],
      enableAccumulatedOutput: false,
      enableTelemetry: false, // no usage data is sent to Presage
    });

    instance.on("streamAvailable", (stream) => handlers.onStream?.(stream));

    instance.on("validationStatus", (_code, _ts, hint) => {
      if (hint) handlers.onHint?.(hint);
    });

    instance.on("metrics", (buf) => {
      let metrics: DecodedMetrics;
      try {
        metrics = messages.decodeMetrics(buf as Buffer) as DecodedMetrics;
      } catch {
        return;
      }
      const talking = metrics.face?.talking?.at(-1);
      if (talking && typeof talking.detected === "boolean") {
        handlers.onTalkingDetected?.(
          talking.detected,
          Number(talking.timestamp ?? 0),
        );
      }
      const blinking = metrics.face?.blinking?.at(-1);
      if (blinking && typeof blinking.detected === "boolean") {
        handlers.onBlinkDetected?.(
          blinking.detected,
          Number(blinking.timestamp ?? 0),
        );
      }
      const breathing = metrics.breathing?.rate?.at(-1);
      if (breathing && typeof breathing.value === "number") {
        handlers.onBreathingRateReceived?.(
          breathing.value,
          Number(breathing.timestamp ?? 0),
        );
      }
    });

    instance.on("error", (code, message) => {
      console.error("[presage]", code, message);
      handlers.onError?.(friendlyError(`${code} ${message}`));
    });

    return instance;
  }

  return {
    async start() {
      if (!sdk) sdk = await build();
      await sdk.start();
    },
    async stop() {
      if (sdk) await sdk.stop();
      handlers.onStream?.(null);
    },
    destroy() {
      try {
        sdk?.destroy();
      } catch {
        // already closed
      }
      sdk = null;
      handlers.onStream?.(null);
    },
  };
}
