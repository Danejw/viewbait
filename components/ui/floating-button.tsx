'use client';

import { type ReactNode, useRef, useState, type RefObject } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useOnClickOutside } from 'usehooks-ts';

type FloatingButtonProps = {
  className?: string;
  children: ReactNode;
  triggerContent: ReactNode;
  /** Called when the menu open state changes (for overlays, e.g. gradient backdrop). */
  onOpenChange?: (open: boolean) => void;
};

type FloatingButtonItemProps = {
  children: ReactNode;
  /** Always-visible label shown to the right of the button (for touch/mobile where hover tooltips don’t apply). */
  label?: string;
};

const list = {
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      staggerDirection: -1
    }
  },
  hidden: {
    opacity: 0,
    transition: {
      when: 'afterChildren',
      staggerChildren: 0.1
    }
  }
};

const item = {
  visible: { opacity: 1, y: 0 },
  hidden: { opacity: 0, y: 5 }
};

const btn = {
  visible: { rotate: '45deg' },
  hidden: { rotate: 0 }
};

function FloatingButton({ className, children, triggerContent, onOpenChange }: FloatingButtonProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const setOpen = (open: boolean) => {
    setIsOpen(open);
    onOpenChange?.(open);
  };

  useOnClickOutside(ref as RefObject<HTMLElement>, () => setOpen(false));

  return (
    <div className={className}>
      <div className="flex flex-col items-center relative">
        <AnimatePresence>
          <motion.ul
            className="flex flex-col items-center absolute bottom-14 gap-2 list-none p-0 m-0"
            initial="hidden"
            animate={isOpen ? 'visible' : 'hidden'}
            variants={list}
          >
            {children}
          </motion.ul>
          <motion.div
            variants={btn}
            animate={isOpen ? 'visible' : 'hidden'}
            ref={ref}
            onClick={() => setOpen(!isOpen)}
          >
            {triggerContent}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function FloatingButtonItem({ children, label }: FloatingButtonItemProps) {
  return (
    <motion.li variants={item} className="relative">
      {children}
      {label != null && label !== "" && (
        <span
          className="absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md px-3 py-1.5 text-xs bg-popover text-popover-foreground border border-border shadow-md pointer-events-none z-10"
          aria-hidden
        >
          {label}
        </span>
      )}
    </motion.li>
  );
}

export { FloatingButton, FloatingButtonItem };
