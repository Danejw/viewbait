'use client';

import { type ReactNode, useRef, useState, type RefObject } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useOnClickOutside } from 'usehooks-ts';

type FloatingButtonProps = {
  className?: string;
  children: ReactNode;
  triggerContent: ReactNode;
};

type FloatingButtonItemProps = {
  children: ReactNode;
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

function FloatingButton({ className, children, triggerContent }: FloatingButtonProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  useOnClickOutside(ref as RefObject<HTMLElement>, () => setIsOpen(false));

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
            onClick={() => setIsOpen(!isOpen)}
          >
            {triggerContent}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function FloatingButtonItem({ children }: FloatingButtonItemProps) {
  return <motion.li variants={item}>{children}</motion.li>;
}

export { FloatingButton, FloatingButtonItem };
