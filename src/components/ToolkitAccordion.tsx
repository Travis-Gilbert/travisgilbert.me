'use client';

import * as Accordion from '@radix-ui/react-accordion';
import { NavArrowDown } from 'iconoir-react';
import RoughBox from './rough/RoughBox';

interface ToolkitItem {
  slug: string;
  title: string;
  html: string;
}

interface ToolkitAccordionProps {
  items: ToolkitItem[];
}

/**
 * Radix Accordion wrapper for toolkit items.
 * HTML content comes from the local markdown pipeline (gray-matter + remark),
 * never from user input or external sources, so dangerouslySetInnerHTML is safe here.
 */
export default function ToolkitAccordion({ items }: ToolkitAccordionProps) {
  return (
    <Accordion.Root type="multiple" className="space-y-4">
      {items.map((item) => (
        <Accordion.Item key={item.slug} value={item.slug}>
          <RoughBox padding={0} tint="terracotta">
            <Accordion.Header asChild>
              <h3 className="m-0">
                <Accordion.Trigger className="group flex w-full items-center justify-between gap-3 bg-transparent border-none cursor-pointer p-6 text-left font-title text-lg font-bold text-ink hover:text-terracotta transition-colors">
                  <span>{item.title}</span>
                  <NavArrowDown
                    width={18}
                    height={18}
                    strokeWidth={2.5}
                    className="text-ink-muted flex-shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180"
                  />
                </Accordion.Trigger>
              </h3>
            </Accordion.Header>
            <Accordion.Content className="overflow-hidden data-[state=open]:animate-[slideDown_200ms_ease-out] data-[state=closed]:animate-[slideUp_200ms_ease-out]">
              <div className="px-6 pb-6">
                {/* Content sourced from local markdown files, not user input */}
                <div
                  className="prose prose-toolkit"
                  dangerouslySetInnerHTML={{ __html: item.html }}
                />
              </div>
            </Accordion.Content>
          </RoughBox>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
