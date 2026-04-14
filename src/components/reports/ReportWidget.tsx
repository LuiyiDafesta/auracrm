import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GripVertical, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ReportWidgetProps {
  title: string;
  onRemove: () => void;
  children: React.ReactNode;
  dragHandleProps?: any;
}

export function ReportWidget({ title, onRemove, children, dragHandleProps }: ReportWidgetProps) {
  return (
    <Card className="report-widget">
      <CardHeader className="flex flex-row items-center justify-between pb-2 print:pb-1">
        <div className="flex items-center gap-2">
          <div {...dragHandleProps} className="cursor-grab text-muted-foreground hover:text-foreground print:hidden">
            <GripVertical className="h-4 w-4" />
          </div>
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 print:hidden" onClick={onRemove}>
          <X className="h-3 w-3" />
        </Button>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
