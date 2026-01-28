import GalleryIcon from "@/components/GalleryIcon";
import { Card } from "@/components/ui/card";

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
          <GalleryIcon size={32} loading={true} />
          <p className="text-muted-foreground">Loading studio...</p>
        </div>  
      </Card>
    </div>
  );
}
