import { useEffect, useState } from "react";

export function ViewportMetrics() {
  const [size, setSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const update = () => {
      const viewport = window.visualViewport;
      setSize({
        width: Math.round(viewport?.width ?? window.innerWidth),
        height: Math.round(viewport?.height ?? window.innerHeight)
      });
    };
    update();
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div
      className="viewport-metrics"
      aria-label={`Размер viewport ${size.width} на ${size.height}`}
    >
      {size.width} × {size.height}
    </div>
  );
}
