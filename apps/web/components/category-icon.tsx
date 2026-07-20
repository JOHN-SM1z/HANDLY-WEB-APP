import {
  BoltIcon,
  DropletIcon,
  SnowflakeIcon,
  SparkleIcon,
  ToolsIcon,
  WallIcon,
} from '@/components/ui/icons';

const ICONS: Record<string, typeof BoltIcon> = {
  droplet: DropletIcon,
  bolt: BoltIcon,
  snowflake: SnowflakeIcon,
  sparkles: SparkleIcon,
  tools: ToolsIcon,
  wall: WallIcon,
};

export function CategoryIcon({
  iconKey,
  className,
}: {
  iconKey: string | null;
  className?: string;
}) {
  const Icon = (iconKey && ICONS[iconKey]) || ToolsIcon;
  return <Icon width={18} height={18} className={className} />;
}
