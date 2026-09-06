import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  href?: string | null;
  showText?: boolean;
}

export function Logo({ className, href = '/', showText = true }: LogoProps) {
  const content = (
    <span className={cn('flex items-center gap-2 font-semibold tracking-tight', className)}>
      <Image
        src="/logo.png"
        alt="Kanban logo"
        width={24}
        height={24}
        className="h-6 w-6 rounded-sm"
        priority
      />
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