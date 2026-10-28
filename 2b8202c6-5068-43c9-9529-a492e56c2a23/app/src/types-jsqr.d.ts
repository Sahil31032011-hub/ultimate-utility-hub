declare module "jsqr" {
  interface QRCode { data: string; }
  interface QROptions { inversionAttempts?: "dontInvert" | "onlyInvert" | "attemptBoth" | "invertFirst"; }
  export default function jsQR(data: Uint8ClampedArray, width: number, height: number, options?: QROptions): QRCode | null;
}
