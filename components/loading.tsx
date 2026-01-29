import { Card } from "@/components/ui/card";
import { ViewBaitLogo } from "@/components/ui/viewbait-logo";

export default function StudioLoading() {
  return (
    <div
      className="flex bg-background items-center justify-center"
      style={{
        height: "100dvh",
        width: "100vw",
      }}
    >
      <Card className="p-4">
        <div className="flex flex-col items-center gap-4 py-12">
          <ViewBaitLogo className="h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Loading studio...</p>
        </div>
      </Card>
    </div>
  );
}
