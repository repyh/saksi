"use client";

import * as React from "react";
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";
import { cn } from "@/lib/utils";

function TooltipProvider({
  delay = 0,
  closeDelay = 0,
  timeout = 300,
  ...props
}: TooltipPrimitive.Provider.Props) {
  return (
    <TooltipPrimitive.Provider
      delay={delay}
      closeDelay={closeDelay}
      timeout={timeout}
      {...props}
    />
  );
}

function Tooltip({
  disableHoverablePopup = true,
  ...props
}: TooltipPrimitive.Root.Props) {
  return (
    <TooltipPrimitive.Root
      disableHoverablePopup={disableHoverablePopup}
      {...props}
    />
  );
}

const TooltipTrigger = TooltipPrimitive.Trigger;

interface TooltipContentProps extends TooltipPrimitive.Popup.Props {
  side?: TooltipPrimitive.Positioner.Props["side"];
  sideOffset?: TooltipPrimitive.Positioner.Props["sideOffset"];
  align?: TooltipPrimitive.Positioner.Props["align"];
}

function TooltipContent({
  className,
  children,
  side = "top",
  sideOffset = 8,
  align = "center",
  ...props
}: TooltipContentProps) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        className="pointer-events-none z-[1000] outline-none"
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            "relative origin-[var(--transform-origin)] rounded-sm bg-foreground px-2.5 py-1.5 font-sans text-xs font-semibold whitespace-nowrap text-white shadow-md transition-[opacity,transform] duration-150 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[side=top]:data-[starting-style]:translate-y-1 data-[side=bottom]:data-[starting-style]:-translate-y-1 data-[side=left]:data-[starting-style]:translate-x-1 data-[side=right]:data-[starting-style]:-translate-x-1 data-[instant]:transition-none data-[instant]:duration-0",
            className,
          )}
          {...props}
        >
          <TooltipPrimitive.Arrow className="size-2 rotate-45 bg-foreground data-[side=top]:-bottom-1 data-[side=bottom]:-top-1 data-[side=left]:-right-1 data-[side=right]:-left-1" />
          <span className="relative">{children}</span>
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
