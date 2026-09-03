import Link from 'next/link';
import { KanbanSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  href?: string | null;
  showText?: boolean;
}

export function Logo({ className, href = '/', showText = true }: LogoProps) {
  const content = (
    <span className={cn('flex items-center gap-2 font-semibold tracking-tight', className)}>
      <KanbanSquare className="h-5 w-5" />
      {showText && <span>Kanban</span>}
    </span>
  );

  if (href === null) return content;
  return (
    <Link href={href} className="inline-flex">
      {content}
    </Link>
  );
}