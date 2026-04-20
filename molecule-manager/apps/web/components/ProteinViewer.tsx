"use client";

import { useEffect, useRef } from "react";

type DisplayMode = "cartoon" | "surface" | "stick";

interface ProteinViewerProps {
  pdbText: string;
  displayMode?: DisplayMode;
}

export default function ProteinViewer({
  pdbText,
  displayMode = "cartoon",
}: ProteinViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const $3DmolRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    import("3dmol").then(($3Dmol) => {
      if (!containerRef.current) return;

      $3DmolRef.current = $3Dmol;
      const viewer = $3Dmol.createViewer(containerRef.current, {
        backgroundColor: "white",
      });

      viewer.addModel(pdbText, "pdb");

      if (displayMode === "cartoon") {
        viewer.setStyle({}, { cartoon: { color: "spectrum" } });
      } else if (displayMode === "surface") {
        viewer.setStyle({}, { stick: { radius: 0.1, colorscheme: "Jmol" } });
        viewer.addSurface($3Dmol.SurfaceType?.VDW ?? 1, {
          opacity: 0.85,
          color: "white",
        });
      } else {
        viewer.setStyle({}, { stick: { colorscheme: "Jmol" } });
      }

      viewer.zoomTo();
      viewer.render();
      viewerRef.current = viewer;
    });

    return () => {
      if (viewerRef.current) {
        viewerRef.current.clear();
        viewerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdbText]);

  useEffect(() => {
    const viewer = viewerRef.current;
    const $3Dmol = $3DmolRef.current;
    if (!viewer || !$3Dmol) return;

    viewer.removeAllSurfaces();
    viewer.removeAllModels();
    viewer.addModel(pdbText, "pdb");
    viewer.setStyle({}, {});

    if (displayMode === "cartoon") {
      viewer.setStyle({}, { cartoon: { color: "spectrum" } });
    } else if (displayMode === "surface") {
      viewer.setStyle({}, { stick: { radius: 0.1, colorscheme: "Jmol" } });
      viewer.addSurface($3Dmol.SurfaceType?.VDW ?? 1, {
        opacity: 0.85,
        color: "white",
      });
    } else {
      viewer.setStyle({}, { stick: { colorscheme: "Jmol" } });
    }

    viewer.zoomTo();
    viewer.render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayMode]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      style={{ position: "relative" }}
    />
  );
}
