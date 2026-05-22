import { cn, getInitials } from '@/lib/utils';

interface AvatarProps {
  name?: string | null;
  phone: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const COLORS = [
  'bg-violet-500', 'bg-blue-500', 'bg-green-500', 'bg-orange-500',
  'bg-pink-500', 'bg-teal-500', 'bg-red-500', 'bg-indigo-500',
];

function colorFromPhone(phone: string): string {
  const sum = phone.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return COLORS[sum % COLORS.length]!;
}

export function Avatar({ name, phone, size = 'md', className }: AvatarProps) {
  const sizes = { sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-12 h-12 text-base' };
  return (
    <div className={cn('rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0', sizes[size], colorFromPhone(phone), className)}>
      {getInitials(name, phone)}
    </div>
  );
}
