import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

interface Props {
  xml: string;
}

// Minimal mxGraph-free SVG renderer for draw.io XML.
// For full fidelity, load @maxgraph/core or the mxGraph viewer script.
// This component uses the draw.io embed iframe approach for offline use.
export default function DiagramViewer({ xml }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // We use a data URI iframe with the draw.io viewer script
    // For fully offline use the drawio-viewer.min.js can be self-hosted.
    // As a lightweight fallback we render a read-only embedded preview.
    const encoded = encodeURIComponent(xml);
    const viewerHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  body { margin:0; background:#fff; overflow:auto; }
  .viewer { width:100%; height:100%; }
</style>
</head>
<body>
<div class="mxgraph viewer" style="max-width:100%;border:0;" data-mxgraph='{"highlight":"#0000ff","nav":true,"resize":true,"toolbar":"zoom layers lightbox","edit":"_blank","xml":"${encoded.replace(/'/g, "&#39;")}"}'></div>
<script type="text/javascript" src="https://viewer.diagrams.net/js/viewer-static.min.js"></script>
</body>
</html>`;

    // Create a blob URL to avoid CSP issues with inline srcdoc
    const blob = new Blob([viewerHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);

    const iframe = document.createElement("iframe");
    iframe.src = url;
    iframe.style.cssText = "width:100%;height:600px;border:0;";
    iframe.title = "SOP-Diagramm";

    // Intercept navigation within the iframe for internal SOP links
    iframe.onload = () => {
      try {
        iframe.contentWindow?.addEventListener("click", (e: MouseEvent) => {
          const target = e.target as HTMLElement;
          const anchor = target.closest("a");
          if (anchor) {
            const href = anchor.getAttribute("href") || "";
            if (href.startsWith("/sop/")) {
              e.preventDefault();
              navigate(href);
            }
          }
        });
      } catch {
        // Cross-origin; link interception not available
      }
    };

    container.innerHTML = "";
    container.appendChild(iframe);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [xml, navigate]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-lg overflow-hidden border border-gray-200 bg-white"
    />
  );
}
