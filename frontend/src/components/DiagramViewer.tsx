import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Maximize2, Minimize2 } from "lucide-react";

interface Props {
  xml: string;
}

export default function DiagramViewer({ xml }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const mxgraphConfig = JSON.stringify({
      highlight: "#0000ff",
      nav: true,
      resize: true,
      toolbar: "zoom layers lightbox",
      edit: "_blank",
      xml: xml,
    })
      .replace(/&/g, "&amp;")
      .replace(/'/g, "&#39;");
    const viewerHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  body { margin:0; background:#fff; overflow:auto; }
</style>
</head>
<body>
<div class="mxgraph" style="max-width:100%;border:0;" data-mxgraph='${mxgraphConfig}'></div>
<script type="text/javascript" src="https://viewer.diagrams.net/js/viewer-static.min.js"></script>
</body>
</html>`;

    const blob = new Blob([viewerHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);

    const iframe = document.createElement("iframe");
    iframe.src = url;
    iframe.style.cssText = "width:100%;height:100%;border:0;display:block;";
    iframe.title = "SOP-Diagramm";

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
    <div className={fullscreen
      ? "fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-900"
      : "relative w-full rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700"
    }>
      {/* Fullscreen toggle */}
      <button
        onClick={() => setFullscreen((f) => !f)}
        title={fullscreen ? "Vollbild beenden" : "Vollbild"}
        className="absolute top-2 right-2 z-10 p-1.5 rounded-lg bg-white/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700 shadow-sm backdrop-blur-sm"
      >
        {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
      </button>

      <div
        ref={containerRef}
        className="w-full"
        style={{ height: fullscreen ? "100%" : "calc(100vh - 220px)", minHeight: "400px" }}
      />
    </div>
  );
}
