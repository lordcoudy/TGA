"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function TooltipPortal({
	content,
	anchorRect,
	visible,
}: {
	content: React.ReactNode;
	anchorRect: DOMRect | null | undefined;
	visible: boolean;
}) {
	const [mounted, setMounted] = useState(false);
	const tooltipRef = useRef<HTMLDivElement | null>(null);
	const [pos, setPos] = useState<{ left: number; top: number; transform: string } | null>(null);

	useEffect(() => {
		setMounted(true);
	}, []);

	useLayoutEffect(() => {
		if (!mounted || !visible || !anchorRect || !tooltipRef.current) return;

		const tooltipEl = tooltipRef.current;
		const { width: tw, height: th } = tooltipEl.getBoundingClientRect();
		const anchorCenterX = anchorRect.left + anchorRect.width / 2;
		const spaceAbove = anchorRect.top;
		const spaceBelow = window.innerHeight - anchorRect.bottom;
		const margin = 8;

		// Clamp horizontal position so tooltip stays within viewport (with margin)
		let left = anchorCenterX;
		const minLeft = margin + tw / 2;
		const maxLeft = window.innerWidth - margin - tw / 2;
		if (left < minLeft) left = minLeft;
		if (left > maxLeft) left = maxLeft;

		// Decide placement: prefer above, otherwise below, otherwise choose the side with more space
		let top: number;
		let transform: string;

		if (spaceAbove >= th + margin) {
			// place above
			top = anchorRect.top - margin;
			transform = "translateX(-50%) translateY(-100%)";
		} else if (spaceBelow >= th + margin) {
			// place below
			top = anchorRect.bottom + margin;
			transform = "translateX(-50%) translateY(0)";
		} else if (spaceBelow >= spaceAbove) {
			// not enough room but more space below: place below and clamp if needed
			top = Math.min(window.innerHeight - margin, anchorRect.bottom + margin);
			transform = "translateX(-50%) translateY(0)";
		} else {
			// more space above: place above
			top = Math.max(margin + th, anchorRect.top - margin);
			transform = "translateX(-50%) translateY(-100%)";
		}

		setPos({ left, top, transform });
	}, [mounted, visible, anchorRect, content]);

	if (!mounted || !visible || !anchorRect || typeof document === "undefined") return null;

	const defaultStyle: React.CSSProperties = {
		position: "fixed",
		left: anchorRect.left + anchorRect.width / 2,
		top: anchorRect.top - 8,
		transform: "translateX(-50%) translateY(-100%)",
		zIndex: 9999,
		pointerEvents: "none",
		visibility: pos ? undefined : "hidden",
	};

	const style: React.CSSProperties = pos
		? { position: "fixed", left: pos.left, top: pos.top, transform: pos.transform, zIndex: 9999, pointerEvents: "none" as any }
		: defaultStyle;

	const tooltip = (
		<div ref={tooltipRef} style={style}>			<div className="bg-slate-800 text-white text-sm px-2 py-1 rounded-md shadow-lg whitespace-nowrap">
			{content}
		</div>
		</div>
	);

	return createPortal(tooltip, document.body);
}