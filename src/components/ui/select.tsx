"use client";

import * as React from "react";
import { Select as SelectPrimitive } from "@base-ui/react/select";
import { FiCheck, FiChevronDown } from "react-icons/fi";
import { cn } from "@/lib/utils";

const Select = SelectPrimitive.Root;

function SelectTrigger({
  className,
  children,
  ...props
}: SelectPrimitive.Trigger.Props) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "group flex h-8 min-w-[175px] cursor-pointer items-center justify-between gap-2 rounded-xs border border-border bg-white px-3 py-1 font-sans text-xs font-semibold text-foreground outline-none select-none hover:border-primary/60 hover:bg-primary/10 hover:text-primary focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 data-[popup-open]:border-primary data-[popup-open]:bg-primary/10 data-[popup-open]:text-primary",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon className="flex items-center text-muted-foreground group-hover:text-primary group-data-[popup-open]:text-primary">
        <FiChevronDown className="size-3.5 transition-transform duration-150 group-data-[popup-open]:rotate-180" aria-hidden="true" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("truncate", className)}
      {...props}
    />
  );
}

function SelectContent({
  className,
  children,
  ...props
}: SelectPrimitive.Popup.Props) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        sideOffset={4}
        alignItemWithTrigger={false}
        className="z-[1000] outline-none"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            "max-h-72 min-w-[190px] overflow-y-auto rounded-xs border border-border bg-white p-1 text-foreground shadow-lg outline-none",
            className
          )}
          {...props}
        >
          {children}
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  );
}

function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex w-full cursor-pointer items-center justify-between gap-2 rounded-xs px-2.5 py-1.5 font-sans text-xs font-medium text-foreground outline-none select-none data-[highlighted]:bg-primary data-[highlighted]:text-white data-[selected]:font-bold",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="flex items-center">
        <FiCheck className="size-3.5" aria-hidden="true" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem };
