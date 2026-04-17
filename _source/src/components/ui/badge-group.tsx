import * as React from "react"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export interface BadgeItem {
  id: string;
  name: string;
  color?: string;
  icon?: React.ReactNode;
}

interface BadgeGroupProps {
  items: BadgeItem[];
  maxVisible?: number;
  className?: string;
}

export function BadgeGroup({ items, maxVisible = 2, className }: BadgeGroupProps) {
  if (!items || items.length === 0) return <span className="text-xs text-muted-foreground">—</span>;

  const visibleItems = items.slice(0, maxVisible);
  const hiddenItems = items.slice(maxVisible);

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className || ''}`}>
      {visibleItems.map(item => (
        <Badge
          key={item.id}
          variant="outline"
          className="text-[11px] h-6 px-2 whitespace-nowrap transition-shadow hover:shadow-sm"
          style={
            item.color
              ? {
                  backgroundColor: `${item.color}15`,
                  color: item.color,
                  borderColor: `${item.color}30`,
                }
              : {
                  backgroundColor: 'rgba(0,0,0,0.02)',
                  color: 'inherit'
                }
          }
        >
          {item.icon && <span className="mr-1">{item.icon}</span>}
          {item.name}
        </Badge>
      ))}

      {hiddenItems.length > 0 && (
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="secondary"
                className="text-[11px] h-6 cursor-pointer bg-muted hover:bg-muted/80 text-muted-foreground px-2"
              >
                +{hiddenItems.length}
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" align="center" className="max-w-[280px] p-3 bg-background/95 backdrop-blur-sm border shadow-lg">
              <div className="flex flex-wrap gap-2">
                {hiddenItems.map(item => (
                  <Badge
                    key={item.id}
                    variant="outline"
                    className="text-[11px] h-6 px-2"
                    style={
                      item.color
                        ? {
                            backgroundColor: `${item.color}15`,
                            color: item.color,
                            borderColor: `${item.color}30`,
                          }
                        : undefined
                    }
                  >
                    {item.name}
                  </Badge>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  )
}
