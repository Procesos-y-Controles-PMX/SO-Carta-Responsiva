"use client";

import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { useEffect, useRef, useState } from "react";

const SPRING = { stiffness: 280, damping: 32, mass: 0.5 };
type Dot = { id: string; x: number; y: number; opacity: number };

function makeDots(width: number, height: number): Dot[] {
  const result: Dot[] = [];
  const spacing = 22;
  const centerX = width / 2;
  const centerY = height / 2;
  const max = Math.hypot(centerX, centerY);
  for (let y = 0; y <= height; y += spacing) {
    for (let x = 0; x <= width; x += spacing) {
      const edge = Math.min(Math.hypot(x - centerX, y - centerY) / (max * 0.8), 1);
      if (Math.random() > edge * 0.68) continue;
      result.push({ id: `${x}-${y}`, x, y, opacity: 0.18 + edge * 0.32 });
    }
  }
  return result;
}

function CanvasDot({
  dot,
  mouseX,
  mouseY,
}: {
  dot: Dot;
  mouseX: ReturnType<typeof useMotionValue<number>>;
  mouseY: ReturnType<typeof useMotionValue<number>>;
}) {
  const repel = (axis: "x" | "y") => {
    const dx = dot.x - mouseX.get();
    const dy = dot.y - mouseY.get();
    const distance = Math.hypot(dx, dy);
    if (!Number.isFinite(distance) || distance >= 110) return 0;
    const force = (1 - distance / 110) * 20;
    const angle = Math.atan2(dy, dx);
    return axis === "x" ? Math.cos(angle) * force : Math.sin(angle) * force;
  };
  const rawX = useTransform([mouseX, mouseY], () => repel("x"));
  const rawY = useTransform([mouseX, mouseY], () => repel("y"));
  const x = useSpring(rawX, SPRING);
  const y = useSpring(rawY, SPRING);
  return (
    <motion.span
      className="absolute h-0.5 w-0.5 rounded-full bg-slate-400/55"
      style={{ left: dot.x, top: dot.y, opacity: dot.opacity, x, y }}
    />
  );
}

export default function AppCanvasMouseBackdrop() {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(Number.POSITIVE_INFINITY);
  const mouseY = useMotionValue(Number.POSITIVE_INFINITY);
  const [dots, setDots] = useState<Dot[]>([]);

  useEffect(() => {
    if (reduceMotion) return;
    const element = ref.current;
    if (!element) return;
    const update = () => {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) setDots(makeDots(rect.width, rect.height));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [reduceMotion]);

  useEffect(() => {
    if (reduceMotion) return;
    const move = (event: MouseEvent) => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      mouseX.set(event.clientX - rect.left);
      mouseY.set(event.clientY - rect.top);
    };
    window.addEventListener("mousemove", move, { passive: true });
    return () => window.removeEventListener("mousemove", move);
  }, [mouseX, mouseY, reduceMotion]);

  if (reduceMotion) {
    return <div aria-hidden className="app-canvas-dots pointer-events-none absolute inset-0 z-0" />;
  }
  return (
    <div ref={ref} aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {dots.map((dot) => (
        <CanvasDot key={dot.id} dot={dot} mouseX={mouseX} mouseY={mouseY} />
      ))}
    </div>
  );
}
