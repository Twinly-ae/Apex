import { Flashlight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface Props {
  onDetected: (code: string) => void;
  onClose: () => void;
}

// The torch capability isn't in the standard DOM types yet.
type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };
type TorchConstraint = MediaTrackConstraintSet & { torch?: boolean };

/**
 * Full-screen live barcode scanner. Streams the rear camera and decodes
 * continuously via ZXing (loaded on demand), stopping on the first valid read.
 * The camera stream is always released on close/unmount. A torch toggle appears
 * only where the device/browser actually supports it (Android; not iOS Safari).
 */
export function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;
  const [error, setError] = useState<string | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  useEffect(() => {
    let controls: { stop: () => void } | undefined;
    let stopped = false;

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: "environment" } },
          videoRef.current as HTMLVideoElement,
          (result, _err, ctrl) => {
            if (!result || stopped) return;
            const digits = result.getText().replace(/\D/g, "");
            if (digits.length < 6) return;
            stopped = true;
            ctrl?.stop();
            onDetectedRef.current(digits);
          },
        );
        if (stopped) controls.stop();
      } catch (err) {
        const denied =
          err instanceof DOMException &&
          (err.name === "NotAllowedError" || err.name === "SecurityError");
        setError(
          denied
            ? "Camera access was denied. Allow it in your browser, or type the number."
            : "Couldn't start the camera. Type the number instead.",
        );
      }
    })();

    return () => {
      stopped = true;
      controls?.stop();
    };
  }, []);

  function activeTrack(): MediaStreamTrack | null {
    const stream = videoRef.current?.srcObject;
    return stream instanceof MediaStream
      ? (stream.getVideoTracks()[0] ?? null)
      : null;
  }

  function checkTorch() {
    const track = activeTrack();
    const caps = track?.getCapabilities?.() as TorchCapabilities | undefined;
    if (caps?.torch) setTorchSupported(true);
  }

  async function toggleTorch() {
    const track = activeTrack();
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as TorchConstraint],
      });
      setTorchOn(next);
    } catch {
      setTorchSupported(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black">
      <video
        ref={videoRef}
        onLoadedMetadata={checkTorch}
        className="h-full w-full object-cover"
        playsInline
        muted
        autoPlay
      />

      {/* Scan reticle */}
      {!error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-36 w-72 rounded-2xl border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
        </div>
      )}

      {/* Top bar */}
      <div className="safe-top absolute inset-x-0 top-0 flex items-center justify-between p-4">
        <span className="rounded-full bg-black/40 px-3 py-1 text-sm font-medium text-white">
          Point at a barcode
        </span>
        <button
          onClick={onClose}
          aria-label="Close scanner"
          className="rounded-full bg-black/40 p-2 text-white active:opacity-80"
        >
          <X className="h-5 w-5" strokeWidth={2} />
        </button>
      </div>

      {/* Torch toggle (only where supported) */}
      {torchSupported && !error && (
        <div className="safe-bottom absolute inset-x-0 bottom-0 flex justify-center p-8">
          <button
            onClick={toggleTorch}
            aria-label={torchOn ? "Turn off flashlight" : "Turn on flashlight"}
            aria-pressed={torchOn}
            className={`rounded-full p-4 active:opacity-80 ${
              torchOn ? "bg-white text-black" : "bg-black/40 text-white"
            }`}
          >
            <Flashlight className="h-6 w-6" strokeWidth={2} />
          </button>
        </div>
      )}

      {error && (
        <div className="safe-bottom absolute inset-x-0 bottom-0 p-6">
          <p className="rounded-xl bg-surface p-3 text-center text-sm text-bad">
            {error}
          </p>
          <button
            onClick={onClose}
            className="mt-3 w-full rounded-xl bg-surface-2 py-3 font-medium text-text active:opacity-80"
          >
            Back
          </button>
        </div>
      )}
    </div>
  );
}
