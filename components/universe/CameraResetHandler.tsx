"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

interface CameraResetHandlerProps {
  onReset: () => void;
}

/** Double-click empty canvas to request a smooth return to the default view. */
export default function CameraResetHandler({ onReset }: CameraResetHandlerProps) {
  const { gl } = useThree();

  useEffect(() => {
    const canvas = gl.domElement;
    const handleDoubleClick = () => onReset();
    canvas.addEventListener("dblclick", handleDoubleClick);
    return () => canvas.removeEventListener("dblclick", handleDoubleClick);
  }, [gl, onReset]);

  return null;
}
