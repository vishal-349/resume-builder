/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useLayoutEffect, useEffect, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { Resume, ResumeSection } from '../types';
import { Mail, Phone, MapPin, Link as LinkIcon, Linkedin, Github, ZoomIn, ZoomOut, Maximize2, Bold, Italic, Underline, Type, Sparkles, Paintbrush, X, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, IndentIncrease, IndentDecrease } from 'lucide-react';
import { store } from '../store';
import { resolveFontStack, FONT_OPTIONS } from '../fonts';

interface LivePreviewProps {
  resume: Resume;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

interface RenderBlock {
  key: string;
  type: 'header' | 'section-heading' | 'summary' | 'skills-grid' | 'item' | 'item-grid' | 'qr-code';
  sectionId?: string;
  itemId?: string;
  data?: any;
}

function SVGQRCode({ value }: { value: string }) {
  return (
    <svg width="55" height="55" viewBox="0 0 29 29" className="text-slate-800" referrerPolicy="no-referrer">
      <path fill="currentColor" d="M0 0h9v9H0zm1 1v7h7V1zm2 2h3v3H3zm7-3h1v1h-1zm1 1h1v1h-1zm-1 1h1v1h-1zm2-2h1v1h-1zm1 1h1v1h-1zm-2 2h1v1h-1zm3-3h9v9h-9zm1 1v7h7V1zm2 2h3v3h-3zm-13 6h1v1h-1zm1 1h1v1h-1zm-1 1h1v1h-1zm2-2h1v1h-1zm1 1h1v1h-1zm-2 2h1v1h-1zm4-3h1v1h-1zm1 1h1v1h-1zm1-1h1v1h-1zm1 1h1v1h-1zm-3 2h1v1h-1zm2 1h1v1h-1zm2-1h1v1h-1zm1 1h1v1h-1zm-16 4h9v9H0zm1 1v7h7v-7zm2 2h3v3H3zm7-3h1v1h-1zm1 1h1v1h-1zm-1 1h1v1h-1zm2-2h1v1h-1zm1 1h1v1h-1zm-2 2h1v1h-1zm3-3h1v1h-1zm1 1h1v1h-1zm1-1h1v1h-1zm1 1h1v1h-1zm-3 2h1v1h-1zm2 1h1v1h-1zm2-1h1v1h-1zm1 1h1v1h-1zm1-3h1v1h-1zm1 1h1v1h-1zm-1 1h1v1h-1zm2-2h1v1h-1zm1 1h1v1h-1zm-2 2h1v1h-1z" />
    </svg>
  );
}

// Inline Editable Rich Text block element
const EditableText = React.memo(({
  sectionId,
  itemId = '',
  fieldName,
  value = '',
  placeholder = '',
  className = '',
  style = {},
  tagName = 'span'
}: {
  sectionId: string;
  itemId?: string;
  fieldName: string;
  value: string;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  tagName?: string;
}) => {
  const elementRef = useRef<HTMLElement>(null);

  // The element is intentionally uncontrolled: we never call setState while the
  // user types, so React never rewrites the DOM mid-edit and the caret stays put.
  // We only push the prop value into the DOM for *external* changes (undo/redo,
  // template switches) and only when the element is not currently focused.
  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;
    if (document.activeElement === el) return; // don't clobber the caret while editing
    const incoming = value || '';
    if (el.innerHTML !== incoming) {
      el.innerHTML = incoming;
    }
  }, [value]);

  const commit = () => {
    if (!elementRef.current) return;
    const currentHtml = elementRef.current.innerHTML;
    // Treat a lone <br> (left behind after deleting everything) as empty.
    const cleanValue = currentHtml === '<br>' ? '' : currentHtml;

    if (cleanValue !== value) {
      if (fieldName === 'sectionHeader') {
        store.updateSectionHeader(sectionId, cleanValue);
      } else if (fieldName === 'summary') {
        store.updateSectionItem(sectionId, '', cleanValue);
      } else if (sectionId === 'personal') {
        store.updateSectionItem('personal', '', { [fieldName]: cleanValue });
      } else {
        store.updateSectionItem(sectionId, itemId, { [fieldName]: cleanValue });
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !['description', 'summary'].includes(fieldName)) {
      e.preventDefault();
      elementRef.current?.blur();
    }
  };

  const wrapperProps = {
    ref: elementRef as any,
    contentEditable: true,
    suppressContentEditableWarning: true,
    // Native browser spell-checking: red underlines on misspellings + a
    // right-click context menu with suggestions that replace the word on click.
    // Fully client-side, no backend, and independent of React renders.
    spellCheck: true,
    onBlur: commit,
    onKeyDown: handleKeyDown,
    className: `${className} editable-field select-text outline-hidden focus:ring-1 focus:ring-indigo-400 focus:bg-indigo-50/10 hover:bg-slate-100/10 transition-all rounded-sm px-0.5 inline-block min-w-[20px]`,
    style,
    'data-editable-field': 'true',
    'data-section-id': sectionId,
    'data-item-id': itemId,
    'data-field-name': fieldName,
    // Placeholder is rendered via CSS (::before) from this attribute, so it is
    // never part of the element's real content and never appears in exports/print.
    'data-placeholder': placeholder || '',
    // Initial DOM content only. Memo below prevents prop-driven re-renders during
    // typing, so this never clobbers the caret.
    dangerouslySetInnerHTML: { __html: value || '' }
  };

  return React.createElement(tagName, wrapperProps);
}, (prevProps, nextProps) => {
  // While THIS exact field is the one currently focused/being edited, never
  // re-render it. A re-render re-applies dangerouslySetInnerHTML which rewrites
  // the node's HTML and destroys the live caret AND text selection. By skipping
  // the render we let formatting (bold/italic/font/color) apply in-place while
  // the user's selection is preserved — matching Google Docs / Word behavior.
  if (typeof document !== 'undefined') {
    const a = document.activeElement as HTMLElement | null;
    if (
      a &&
      a.getAttribute('data-editable-field') === 'true' &&
      a.getAttribute('data-section-id') === nextProps.sectionId &&
      a.getAttribute('data-item-id') === (nextProps.itemId || '') &&
      a.getAttribute('data-field-name') === nextProps.fieldName
    ) {
      return true;
    }
  }
  return (
    prevProps.value === nextProps.value &&
    prevProps.sectionId === nextProps.sectionId &&
    prevProps.itemId === nextProps.itemId &&
    prevProps.fieldName === nextProps.fieldName &&
    prevProps.placeholder === nextProps.placeholder &&
    prevProps.className === nextProps.className &&
    prevProps.tagName === nextProps.tagName &&
    JSON.stringify(prevProps.style) === JSON.stringify(nextProps.style)
  );
});

export const LivePreview = forwardRef<HTMLDivElement, LivePreviewProps>(({ resume, isExpanded, onToggleExpand }, ref) => {
  const [zoom, setZoom] = useState(0.85);
  const [isAutoFit, setIsAutoFit] = useState(true);
  const [fullWidth, setFullWidth] = useState(false);
  const [pages, setPages] = useState<RenderBlock[][]>([]);
  const measuringRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Remembers the last text selection made inside an editable field, so that
  // formatting triggered from a toolbar control (which can steal focus, e.g. the
  // font <select>) can restore it before applying the command.
  const savedRangeRef = useRef<Range | null>(null);
  const savedEditableRef = useRef<HTMLElement | null>(null);

  // States for Selection Floating formatting panel
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 });

  // Dynamic Auto-fit for smaller devices/viewports using ResizeObserver
  useLayoutEffect(() => {
    if (!containerRef.current || !isAutoFit) return;
    
    const container = containerRef.current;
    const handleResize = (entries: ResizeObserverEntry[]) => {
      if (!entries || entries.length === 0) return;
      const width = entries[0].contentRect.width;
      if (width > 0) {
        // Leave 48px for layout padding (24px on each side)
        const fitScale = Math.min(1.0, (width - 48) / 794);
        setZoom(Math.max(0.35, Number(fitScale.toFixed(2))));
      }
    };
    
    const observer = new ResizeObserver(handleResize);
    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, [isAutoFit]);

  // Support Ctrl + Mouse Scroll to zoom in & out smoothly
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setIsAutoFit(false);
        const delta = -e.deltaY;
        setZoom(prev => {
          const factor = delta > 0 ? 0.05 : -0.05;
          return Math.max(0.25, Math.min(2.0, Number((prev + factor).toFixed(2))));
        });
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Sync state when elements change
  const triggerActiveElementChange = () => {
    setTimeout(() => {
      const activeEl = document.activeElement;
      if (activeEl instanceof HTMLElement && activeEl.hasAttribute('data-editable-field')) {
        const secId = activeEl.getAttribute('data-section-id') || '';
        const itId = activeEl.getAttribute('data-item-id') || '';
        const fldName = activeEl.getAttribute('data-field-name') || '';
        const innerH = activeEl.innerHTML;
        
        if (fldName === 'sectionHeader') {
          store.updateSectionHeader(secId, innerH);
        } else if (fldName === 'summary') {
          store.updateSectionItem(secId, '', innerH);
        } else if (secId === 'personal') {
          store.updateSectionItem('personal', '', { [fldName]: innerH });
        } else if (secId) {
          store.updateSectionItem(secId, itId, { [fldName]: innerH });
        }
      }
    }, 50);
  };

  // Setup Hotkeys shortcuts, selection tracker palette positioning
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !selection.toString().trim()) {
        setShowToolbar(false);
        return;
      }

      // Check if selection falls within an editable text node of LivePreview
      let node: Node | null = selection.anchorNode;
      let isInPreview = false;
      let editableEl: HTMLElement | null = null;
      while (node) {
        if (node instanceof HTMLElement && node.hasAttribute('data-editable-field')) {
          isInPreview = true;
          editableEl = node;
          break;
        }
        node = node.parentNode;
      }

      if (!isInPreview) {
        setShowToolbar(false);
        return;
      }

      try {
        const range = selection.getRangeAt(0);
        // Remember this selection so toolbar actions can restore it if focus moves.
        savedRangeRef.current = range.cloneRange();
        savedEditableRef.current = editableEl;
        const rect = range.getBoundingClientRect();
        
        // Offset 48px above selection bounds safely using viewport coords
        setToolbarPosition({
          top: window.scrollY + rect.top - 54,
          left: window.scrollX + rect.left + rect.width / 2,
        });
        setShowToolbar(true);
      } catch (err) {
        console.warn('Error fetching selection bounding offset:', err);
      }
    };

    const handleShortcuts = (e: KeyboardEvent) => {
      const isCmd = e.ctrlKey || e.metaKey;
      if (!isCmd) return;

      const key = e.key.toLowerCase();
      if (key === 'b') {
        e.preventDefault();
        runFormat('bold');
      } else if (key === 'i') {
        e.preventDefault();
        runFormat('italic');
      } else if (key === 'u') {
        e.preventDefault();
        runFormat('underline');
      } else if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          store.redo();
        } else {
          store.undo();
        }
      } else if (key === 'y') {
        e.preventDefault();
        store.redo();
      }
    };

    // Global listener for pointerup to re-evaluate text selections instantly 
    const handlePointerUp = () => {
      setTimeout(handleSelectionChange, 10);
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('keydown', handleShortcuts);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('keydown', handleShortcuts);
    };
  }, []);

  const runFormat = (command: string, value: string = '') => {
    // If focus moved to a toolbar control (e.g. the font dropdown) the live
    // selection may be gone — restore the remembered range first so the command
    // targets the text the user actually selected.
    const el = savedEditableRef.current;
    const range = savedRangeRef.current;
    const sel = typeof window !== 'undefined' ? window.getSelection() : null;
    const selectionLost = !sel || sel.rangeCount === 0 || document.activeElement !== el;
    if (el && range && selectionLost) {
      el.focus();
      sel?.removeAllRanges();
      try { sel?.addRange(range); } catch { /* range may be stale */ }
    }

    document.execCommand(command, false, value);

    // Re-capture the (possibly shifted) selection so chained formatting and the
    // floating toolbar keep working on the same text.
    const sel2 = typeof window !== 'undefined' ? window.getSelection() : null;
    if (sel2 && sel2.rangeCount > 0) {
      savedRangeRef.current = sel2.getRangeAt(0).cloneRange();
    }
    triggerActiveElementChange();
  };

  const styles = resume.styles;
  const primaryColor = styles.primaryColor;

  // Returns 'hidden' when every value is empty so the element is fully removed
  // from both the on-screen preview and the printed/exported resume — no empty
  // rows, icons, separators, or placeholder hints for blank fields.
  const hideIfEmpty = (...vals: any[]) => (vals.some((v) => v && String(v).replace(/<[^>]*>/g, '').trim()) ? '' : 'hidden');

  const personalSec = resume.sections.find(s => s.type === 'personal');
  const contact = personalSec?.items[0] || {};

  // Derive font family — resolves both legacy tokens (sans/serif/mono) and any
  // real font name chosen from the Typography dropdown into a full CSS stack.
  const fontStack = resolveFontStack(styles.fontFamily);

  // Line spacing applied to prose (summary + item descriptions).
  const lineHeightValue = styles.lineSpacing === 'tight' ? 1.3 : styles.lineSpacing === 'relaxed' ? 1.9 : 1.55;

  // Density padding styles
  let sectionSpacingClass = 'space-y-4';
  let itemSpacingClass = 'space-y-2';
  let paddingClass = 'p-8';
  if (styles.spacing === 'compact') {
    sectionSpacingClass = 'space-y-2';
    itemSpacingClass = 'space-y-0.5';
    paddingClass = 'p-5';
  } else if (styles.spacing === 'relaxed') {
    sectionSpacingClass = 'space-y-5';
    itemSpacingClass = 'space-y-3';
    paddingClass = 'p-10';
  }

  // Divider styling
  let borderBottomClass = 'border-b';
  if (styles.dividerStyle === 'none') borderBottomClass = '';
  else if (styles.dividerStyle === 'dashed') borderBottomClass = 'border-b border-dashed';
  else if (styles.dividerStyle === 'double') borderBottomClass = 'border-b-4 border-double';
  else if (styles.dividerStyle === 'thick') borderBottomClass = 'border-b-2';

  // Sizing definitions
  const bodyTextSizes = {
    sm: 'text-[10px] leading-snug',
    md: 'text-[11px] leading-relaxed',
    lg: 'text-[12px] leading-relaxed'
  };

  const titleTextSizes = {
    sm: 'text-xs font-bold',
    md: 'text-sm font-bold',
    lg: 'text-base font-bold'
  };

  const currentBodySize = bodyTextSizes[styles.fontSize] || bodyTextSizes.md;
  const currentTitleSize = titleTextSizes[styles.sectionHeadingSize] || titleTextSizes.md;

  const isTwoColumn = ['functional-two-col', 'creative-bento', 'designer-vintage', 'consultant-bento', 'cohesive-portfolio'].includes(resume.templateId);

  // Helper to check if a block belongs in the sidebar partition (for two column layout templates)
  const isSidebarBlock = (block: RenderBlock): boolean => {
    if (!isTwoColumn) return false;
    const sec = resume.sections.find(s => s.id === block.sectionId);
    if (!sec) return false;
    return ['skills', 'languages', 'certifications', 'awards', 'references'].includes(sec.type);
  };

  // Description bullet formatting
  const renderDescription = (sectionId: string, itemId: string, textVal: string) => {
    return (
      <div className="mt-1 text-slate-600 border-l border-slate-100/60 pl-2 whitespace-pre-line text-left" style={{ lineHeight: lineHeightValue }}>
        <EditableText
          sectionId={sectionId}
          itemId={itemId}
          fieldName="description"
          value={textVal || ''}
          placeholder="E.g. Accomplished team targets, raised compute performance, authored test coverage..."
          tagName="div"
          className={currentBodySize}
          style={{ lineHeight: lineHeightValue }}
        />
      </div>
    );
  };

  // Specific single item visual structure
  const renderItemContent = (sectionId: string, item: any, sectionType: string) => {
    switch (sectionType) {
      case 'experience':
        if (resume.templateId === 'developer-terminal') {
          return (
            <div className="border-l-2 border-green-700 pl-3 py-0.5 select-text">
              <p className="font-mono text-xs font-bold text-green-400">
                <EditableText sectionId={sectionId} itemId={item.id} fieldName="position" value={item.position} placeholder="Position" />
                <span className="text-slate-400"> @ </span>
                <EditableText sectionId={sectionId} itemId={item.id} fieldName="company" value={item.company} placeholder="Company" />
              </p>
              <p className="font-mono text-[9px] text-slate-505">
                [<EditableText sectionId={sectionId} itemId={item.id} fieldName="startDate" value={item.startDate} placeholder="Start" /> - {item.current ? 'PRESENT' : <EditableText sectionId={sectionId} itemId={item.id} fieldName="endDate" value={item.endDate} placeholder="End" />}] {item.location && <>| Loc: <EditableText sectionId={sectionId} itemId={item.id} fieldName="location" value={item.location} placeholder="Location" /></>}
              </p>
              {renderDescription(sectionId, item.id, item.description)}
            </div>
          );
        }
        return (
          <div className="py-0.5 select-text">
            <div className="flex justify-between items-baseline flex-wrap gap-x-2">
              <h5 className="font-bold text-slate-800 text-[11px]">
                <EditableText sectionId={sectionId} itemId={item.id} fieldName="position" value={item.position} placeholder="Position Title" /> <span className="text-slate-400 font-normal">at</span> <EditableText sectionId={sectionId} itemId={item.id} fieldName="company" value={item.company} placeholder="Company Name" />
              </h5>
              <div className={`text-[9px] text-slate-400 font-semibold uppercase flex items-center gap-1 shrink-0 ${hideIfEmpty(item.startDate, item.endDate, item.current)}`}>
                <EditableText sectionId={sectionId} itemId={item.id} fieldName="startDate" value={item.startDate} placeholder="Start" />
                <span>–</span>
                {item.current ? <span>Present</span> : <EditableText sectionId={sectionId} itemId={item.id} fieldName="endDate" value={item.endDate} placeholder="End" />}
              </div>
            </div>
            {item.location && (
              <p className="text-[9px] text-slate-400 italic ml-0.5">
                <EditableText sectionId={sectionId} itemId={item.id} fieldName="location" value={item.location} placeholder="City, State" />
              </p>
            )}
            {renderDescription(sectionId, item.id, item.description)}
          </div>
        );

      case 'education':
        return (
          <div className="py-0.5 select-text">
            <div className="flex justify-between items-baseline flex-wrap gap-x-2">
              <h5 className="font-bold text-slate-800 text-[11px]">
                <EditableText sectionId={sectionId} itemId={item.id} fieldName="degree" value={item.degree} placeholder="Degree" /> <span className="text-slate-400 font-normal">in</span> <EditableText sectionId={sectionId} itemId={item.id} fieldName="fieldOfStudy" value={item.fieldOfStudy} placeholder="Field of Study" />
              </h5>
              <div className={`text-[9px] text-slate-400 font-semibold flex items-center gap-1 uppercase shrink-0 ${hideIfEmpty(item.startDate, item.endDate, item.current)}`}>
                <EditableText sectionId={sectionId} itemId={item.id} fieldName="startDate" value={item.startDate} placeholder="Start Date" />
                <span>–</span>
                {item.current ? <span>Present</span> : <EditableText sectionId={sectionId} itemId={item.id} fieldName="endDate" value={item.endDate} placeholder="End Date" />}
              </div>
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-500 mt-0.5">
              <p className="font-medium"><EditableText sectionId={sectionId} itemId={item.id} fieldName="institution" value={item.institution} placeholder="Institution Name" /></p>
              {item.grade && <span className="bg-slate-100 px-1 py-0.2 rounded text-[9px] font-mono font-bold uppercase shrink-0"><EditableText sectionId={sectionId} itemId={item.id} fieldName="grade" value={item.grade} placeholder="GPA" /></span>}
            </div>
            {renderDescription(sectionId, item.id, item.description)}
          </div>
        );

      case 'projects':
        return (
          <div className="py-0.5 select-text">
            <div className="flex justify-between items-baseline flex-wrap gap-x-2">
              <h5 className="font-bold text-slate-800 text-[11px] flex gap-1.5 items-center">
                <EditableText sectionId={sectionId} itemId={item.id} fieldName="name" value={item.name} placeholder="Project Title" />
                {item.role && <><span className="text-slate-300"> - </span><EditableText sectionId={sectionId} itemId={item.id} fieldName="role" value={item.role} placeholder="Role" className="text-slate-500 font-medium" /></>}
              </h5>
              <div className={`text-[9px] text-slate-400 font-semibold uppercase flex items-center gap-1 shrink-0 ${hideIfEmpty(item.startDate, item.endDate, item.current)}`}>
                <EditableText sectionId={sectionId} itemId={item.id} fieldName="startDate" value={item.startDate} placeholder="Start Date" />
                <span>–</span>
                {item.current ? <span>Present</span> : <EditableText sectionId={sectionId} itemId={item.id} fieldName="endDate" value={item.endDate} placeholder="End Date" />}
              </div>
            </div>
            {item.url && (
              <p className="text-[9px] text-indigo-600 underline">
                <EditableText sectionId={sectionId} itemId={item.id} fieldName="url" value={item.url} placeholder="Project URL Link" />
              </p>
            )}
            {renderDescription(sectionId, item.id, item.description)}
          </div>
        );

      case 'certifications':
        return (
          <div className="py-0.5 select-text">
            <div className="flex justify-between items-baseline gap-2">
              <p className="font-bold text-slate-800 text-[10px] leading-tight">
                <EditableText sectionId={sectionId} itemId={item.id} fieldName="name" value={item.name} placeholder="Certificate Title" />
              </p>
              {item.date && <span className="text-[8.5px] text-slate-400 font-mono font-bold shrink-0"><EditableText sectionId={sectionId} itemId={item.id} fieldName="date" value={item.date} placeholder="Date" /></span>}
            </div>
            {item.issuer && (
              <p className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold leading-none mt-0.5">
                <EditableText sectionId={sectionId} itemId={item.id} fieldName="issuer" value={item.issuer} placeholder="Issuing Authority" />
              </p>
            )}
          </div>
        );

      case 'awards':
        return (
          <div className="py-0.5 select-text">
            <div className="flex justify-between items-baseline gap-2">
              <p className="font-bold text-slate-800 text-[10px]">
                <EditableText sectionId={sectionId} itemId={item.id} fieldName="title" value={item.title} placeholder="Award Title" />
              </p>
              {item.date && <span className="text-[8.5px] text-slate-400 font-mono font-bold shrink-0"><EditableText sectionId={sectionId} itemId={item.id} fieldName="date" value={item.date} placeholder="Date Received" /></span>}
            </div>
            {item.issuer && (
              <p className="text-[9px] text-slate-500 font-medium">
                <EditableText sectionId={sectionId} itemId={item.id} fieldName="issuer" value={item.issuer} placeholder="Issuer" />
              </p>
            )}
            {renderDescription(sectionId, item.id, item.description)}
          </div>
        );

      case 'languages':
        return (
          <div className="py-0.5 flex items-center justify-between text-left text-[9.5px] select-text">
            <span className="font-bold text-slate-800"><EditableText sectionId={sectionId} itemId={item.id} fieldName="name" value={item.name} placeholder="Language Name" /></span>
            <span className="text-slate-400 italic font-medium"><EditableText sectionId={sectionId} itemId={item.id} fieldName="proficiency" value={item.proficiency} placeholder="Proficiency level" /></span>
          </div>
        );

      case 'volunteer':
        return (
          <div className="py-0.5 select-text">
            <div className="flex justify-between items-baseline gap-2 flex-wrap">
              <h5 className="font-bold text-slate-800 text-[11px]">
                <EditableText sectionId={sectionId} itemId={item.id} fieldName="role" value={item.role} placeholder="Volunteer Role" /> <span className="text-slate-400 font-normal">at</span> <EditableText sectionId={sectionId} itemId={item.id} fieldName="organization" value={item.organization} placeholder="Organization Name" />
              </h5>
              <div className={`text-[9px] text-slate-400 font-semibold uppercase flex items-center gap-1 shrink-0 ${hideIfEmpty(item.startDate, item.endDate, item.current)}`}>
                <EditableText sectionId={sectionId} itemId={item.id} fieldName="startDate" value={item.startDate} placeholder="Start" />
                <span>–</span>
                {item.current ? <span>Present</span> : <EditableText sectionId={sectionId} itemId={item.id} fieldName="endDate" value={item.endDate} placeholder="End" />}
              </div>
            </div>
            {renderDescription(sectionId, item.id, item.description)}
          </div>
        );

      case 'publications':
        return (
          <div className="py-0.5 select-text">
            <div className="flex justify-between items-baseline gap-2">
              <h5 className="font-bold text-slate-800 text-[10.5px]">
                <EditableText sectionId={sectionId} itemId={item.id} fieldName="title" value={item.title} placeholder="Publication Title" />
              </h5>
              {item.date && <span className="text-[8.5px] text-slate-400 font-mono font-bold shrink-0"><EditableText sectionId={sectionId} itemId={item.id} fieldName="date" value={item.date} placeholder="Date" /></span>}
            </div>
            {item.publisher && (
              <p className="text-[9px] text-slate-500 font-medium">
                <EditableText sectionId={sectionId} itemId={item.id} fieldName="publisher" value={item.publisher} placeholder="Publisher Venue" />
              </p>
            )}
            {item.url && (
              <p className="text-[9px] text-indigo-600 truncate max-w-xs font-mono underline">
                <EditableText sectionId={sectionId} itemId={item.id} fieldName="url" value={item.url} placeholder="Reference URL Link" />
              </p>
            )}
            {renderDescription(sectionId, item.id, item.description)}
          </div>
        );

      case 'references':
        return (
          <div className="py-0.5 select-text text-[9.5px] leading-relaxed">
            <p className="font-bold text-slate-800 text-[10px]"><EditableText sectionId={sectionId} itemId={item.id} fieldName="name" value={item.name} placeholder="Reference Name" /></p>
            <p className="text-slate-500 font-medium">
              <EditableText sectionId={sectionId} itemId={item.id} fieldName="relationship" value={item.relationship} placeholder="Relationship" /> <span className="text-slate-400 font-normal">at</span> <EditableText sectionId={sectionId} itemId={item.id} fieldName="company" value={item.company} placeholder="Company Name" />
            </p>
            {item.contact && <p className="text-slate-400 font-mono text-[8.5px]"><EditableText sectionId={sectionId} itemId={item.id} fieldName="contact" value={item.contact} placeholder="Contact Email / Phone" /></p>}
          </div>
        );

      case 'custom':
        return (
          <div className="py-0.5 select-text">
            <div className="flex justify-between items-baseline gap-2 flex-wrap">
              <h5 className="font-bold text-slate-800 text-[10.5px]">
                <EditableText sectionId={sectionId} itemId={item.id} fieldName="title" value={item.title} placeholder="Custom Section Entry" />
                {item.subtitle && <><span className="text-slate-300"> - </span><EditableText sectionId={sectionId} itemId={item.id} fieldName="subtitle" value={item.subtitle} placeholder="Sponsor / Organization" className="text-slate-505" /></>}
              </h5>
              {item.date && <span className="text-[9px] text-slate-500 font-medium"><EditableText sectionId={sectionId} itemId={item.id} fieldName="date" value={item.date} placeholder="Timeline / Dates" /></span>}
            </div>
            {renderDescription(sectionId, item.id, item.description)}
          </div>
        );

      default:
        return null;
    }
  };

  // Per-section content alignment (falls back to left)
  const sectionAlign = (sec: ResumeSection): 'left' | 'center' | 'right' => sec.layout?.align || 'left';

  const renderSectionHeader = (sec: ResumeSection) => {
    // A per-section alignment override wins; otherwise use the global heading alignment.
    const effectiveAlign = sec.layout?.align || styles.sectionHeadingAlignment;
    let headingAlign = 'text-left';
    if (effectiveAlign === 'center') headingAlign = 'text-center';
    else if (effectiveAlign === 'right') headingAlign = 'text-right';

    if (resume.templateId === 'developer-terminal') {
      return (
        <div className="mb-2 mt-2 select-none">
          <p className="font-mono text-xs font-bold text-green-500 tracking-wider">
            &gt; $ cat {sec.id}.md
          </p>
          <div className="h-[1px] bg-slate-800 w-full mt-0.5" />
        </div>
      );
    }

    return (
      <div className={`mb-2 mt-3 ${headingAlign}`} style={{ color: primaryColor }}>
        <EditableText
          sectionId={sec.id}
          fieldName="sectionHeader"
          value={sec.name}
          placeholder="Section Title"
          tagName="h4"
          className={`${currentTitleSize} font-bold tracking-tight uppercase leading-tight pb-0.5 ${borderBottomClass}`}
          style={{ borderColor: `${primaryColor}30`, display: 'inline-block', width: '100%', textAlign: effectiveAlign }}
        />
      </div>
    );
  };

  // Generic, template-independent header used when the user explicitly chooses
  // where the contact details should sit (Visual Custom → Contact / Header layout).
  const renderGenericHeader = (layout: 'right' | 'horizontal' | 'stacked', contact: any) => {
    const contactFields = [
      { Icon: Mail, field: 'email', val: contact.email, ph: 'Email' },
      { Icon: Phone, field: 'phone', val: contact.phone, ph: 'Phone' },
      { Icon: MapPin, field: 'location', val: contact.location, ph: 'Location' },
      { Icon: LinkIcon, field: 'website', val: contact.website, ph: 'Website' },
      { Icon: Linkedin, field: 'linkedin', val: contact.linkedin, ph: 'LinkedIn' },
      { Icon: Github, field: 'github', val: contact.github, ph: 'GitHub' },
    ];

    const nameBlock = (alignClass: string) => (
      <div className={alignClass}>
        <h1 className="text-xl font-black tracking-tight" style={{ color: primaryColor }}>
          <EditableText sectionId="personal" fieldName="fullName" value={contact.fullName} placeholder="Your Full Name" />
        </h1>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
          <EditableText sectionId="personal" fieldName="jobTitle" value={contact.jobTitle} placeholder="Desired Position Title" />
        </p>
      </div>
    );

    const horizontalContacts = (justify: string) => (
      <div className={`flex flex-wrap ${justify} gap-x-3 gap-y-1 text-[9.5px] text-slate-600`}>
        {contactFields.map(({ Icon, field, val, ph }) => (
          <span key={field} className={`flex items-center gap-1 ${hideIfEmpty(val)}`}>
            <Icon size={10} /><EditableText sectionId="personal" fieldName={field} value={val} placeholder={ph} />
          </span>
        ))}
      </div>
    );

    const verticalContacts = (
      <div className="grid grid-cols-1 gap-y-0.5 text-[9.5px] text-slate-600 max-w-sm text-left">
        {contactFields.map(({ Icon, field, val, ph }) => (
          <div key={field} className={`flex items-center gap-1.5 ${hideIfEmpty(val)}`}>
            <Icon size={10} /><span><EditableText sectionId="personal" fieldName={field} value={val} placeholder={ph} /></span>
          </div>
        ))}
      </div>
    );

    if (layout === 'right') {
      return (
        <div className="mb-4 flex justify-between items-start flex-wrap gap-3 border-b border-slate-100 pb-4 select-text">
          {nameBlock('text-left')}
          {verticalContacts}
        </div>
      );
    }

    if (layout === 'horizontal') {
      // Contact details on a horizontal row directly below the name.
      return (
        <div className="mb-4 border-b border-slate-100 pb-4 select-text text-center space-y-2">
          {nameBlock('text-center')}
          {horizontalContacts('justify-center')}
        </div>
      );
    }

    // 'stacked' — everything left-aligned, contact row beneath the name.
    return (
      <div className="mb-4 border-b border-slate-100 pb-4 select-text text-left space-y-2">
        {nameBlock('text-left')}
        {horizontalContacts('justify-start')}
      </div>
    );
  };

  const renderHeaderLayout = () => {
    const personalSec = resume.sections.find(s => s.type === 'personal');
    const contact = personalSec?.items[0] || {};

    if (!personalSec || !personalSec.visible) return null;

    // A user-chosen contact/header layout overrides the template's own header.
    if (styles.headerLayout && styles.headerLayout !== 'template') {
      return renderGenericHeader(styles.headerLayout, contact);
    }

    if (resume.templateId === 'developer-terminal') {
      return (
        <div className="font-mono mb-4 bg-slate-900 border border-slate-800 p-3 rounded text-green-400 select-text text-left">
          <h1 className="text-base font-bold">&gt; JOBS_DB: <EditableText sectionId="personal" fieldName="fullName" value={contact.fullName} placeholder="FULL_NAME" /></h1>
          <p className="text-[10px] text-slate-400 uppercase mt-1">TITLE // <EditableText sectionId="personal" fieldName="jobTitle" value={contact.jobTitle} placeholder="ENGINEER_ROLE" /></p>
          <div className="mt-2 text-[9.5px] font-mono space-y-0.5 text-slate-300">
            <p className={hideIfEmpty(contact.email)}># MAIL: <EditableText sectionId="personal" fieldName="email" value={contact.email} placeholder="email@address" /></p>
            <p className={hideIfEmpty(contact.phone)}># PHONE: <EditableText sectionId="personal" fieldName="phone" value={contact.phone} placeholder="phone_number" /></p>
            <p className={hideIfEmpty(contact.location)}># COORDS: <EditableText sectionId="personal" fieldName="location" value={contact.location} placeholder="city_state_country" /></p>
            <p className={hideIfEmpty(contact.website)}># WEBSITE: <EditableText sectionId="personal" fieldName="website" value={contact.website} placeholder="mywebsite.dev" /></p>
            <div className="flex gap-2 items-center flex-wrap mt-1 opacity-80">
              <p className={hideIfEmpty(contact.linkedin)}># LINKEDIN: <EditableText sectionId="personal" fieldName="linkedin" value={contact.linkedin} placeholder="linkedin.com/in/user" /></p>
              <p className={hideIfEmpty(contact.github)}># GITHUB: <EditableText sectionId="personal" fieldName="github" value={contact.github} placeholder="github.com/user" /></p>
            </div>
          </div>
        </div>
      );
    }

    if (resume.templateId === 'corporate-navy') {
      return (
        <div className="bg-indigo-950 text-white p-5 -mx-8 -mt-8 mb-5 relative overflow-hidden select-text text-left">
          <div className="relative z-10 text-left">
            <h1 className="text-lg font-extrabold tracking-tight uppercase">
              <EditableText sectionId="personal" fieldName="fullName" value={contact.fullName} placeholder="Your Full Name" />
            </h1>
            <p className="text-[10px] uppercase tracking-widest text-[#a5b4fc] font-bold mt-1 font-sans">
              <EditableText sectionId="personal" fieldName="jobTitle" value={contact.jobTitle} placeholder="Your Profession" />
            </p>
            <div className="mt-3 pt-3 border-t border-indigo-900/60 grid grid-cols-2 gap-y-1 text-[9.5px] text-indigo-100">
              <div className={`flex items-center gap-1.5 ${hideIfEmpty(contact.email)}`}><Mail size={10} /><span><EditableText sectionId="personal" fieldName="email" value={contact.email} placeholder="Email" /></span></div>
              <div className={`flex items-center gap-1.5 ${hideIfEmpty(contact.phone)}`}><Phone size={10} /><span><EditableText sectionId="personal" fieldName="phone" value={contact.phone} placeholder="Phone" /></span></div>
              <div className={`flex items-center gap-1.5 ${hideIfEmpty(contact.location)}`}><MapPin size={10} /><span><EditableText sectionId="personal" fieldName="location" value={contact.location} placeholder="Location" /></span></div>
              <div className={`flex items-center gap-1.5 ${hideIfEmpty(contact.website)}`}><LinkIcon size={10} /><span><EditableText sectionId="personal" fieldName="website" value={contact.website} placeholder="Website" /></span></div>
              <div className={`flex items-center gap-1.5 ${hideIfEmpty(contact.linkedin)}`}><Linkedin size={10} /><span><EditableText sectionId="personal" fieldName="linkedin" value={contact.linkedin} placeholder="LinkedIn" /></span></div>
              <div className={`flex items-center gap-1.5 ${hideIfEmpty(contact.github)}`}><Github size={10} /><span><EditableText sectionId="personal" fieldName="github" value={contact.github} placeholder="GitHub" /></span></div>
            </div>
          </div>
          <div className="absolute -bottom-16 -right-16 w-36 h-36 bg-indigo-600/20 rounded-full blur-2xl animate-pulse" />
        </div>
      );
    }

    if (resume.templateId === 'executive-classic') {
      return (
        <div className="text-center mb-5 select-text">
          <h1 className="font-serif text-xl font-extrabold tracking-tight text-slate-800">
            <EditableText sectionId="personal" fieldName="fullName" value={contact.fullName} placeholder="Your Full Name" />
          </h1>
          <p className="text-[10px] tracking-widest uppercase text-slate-500 font-serif font-semibold italic mt-0.5">
            <EditableText sectionId="personal" fieldName="jobTitle" value={contact.jobTitle} placeholder="Desired Role / Custom Title" />
          </p>
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[9.5px] text-slate-600 mt-2 font-mono">
            <span className={hideIfEmpty(contact.email)}><EditableText sectionId="personal" fieldName="email" value={contact.email} placeholder="Email" /></span>
            <span className={hideIfEmpty(contact.phone)}><EditableText sectionId="personal" fieldName="phone" value={contact.phone} placeholder="Phone" /></span>
            <span className={hideIfEmpty(contact.location)}><EditableText sectionId="personal" fieldName="location" value={contact.location} placeholder="Location" /></span>
            <span className={hideIfEmpty(contact.website)}><EditableText sectionId="personal" fieldName="website" value={contact.website} placeholder="Website" /></span>
            <span className={hideIfEmpty(contact.linkedin)}><EditableText sectionId="personal" fieldName="linkedin" value={contact.linkedin} placeholder="LinkedIn" /></span>
          </div>
          <div className="h-[2px] bg-slate-800 w-full mt-3" />
        </div>
      );
    }

    return (
      <div className="mb-4 flex justify-between items-start flex-wrap gap-3 border-b border-slate-100 pb-4 select-text">
        <div className="text-left">
          <h1 className="text-xl font-black tracking-tight text-slate-800" style={{ color: primaryColor }}>
            <EditableText sectionId="personal" fieldName="fullName" value={contact.fullName} placeholder="Your Full Name" />
          </h1>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
            <EditableText sectionId="personal" fieldName="jobTitle" value={contact.jobTitle} placeholder="Desired Position Title" />
          </p>
        </div>

        <div className="grid grid-cols-1 gap-y-0.5 text-[9.5px] text-slate-600 max-w-sm text-left">
          <div className={`flex items-center gap-1.5 ${hideIfEmpty(contact.email)}`}><Mail size={10} /><span><EditableText sectionId="personal" fieldName="email" value={contact.email} placeholder="Email" /></span></div>
          <div className={`flex items-center gap-1.5 ${hideIfEmpty(contact.phone)}`}><Phone size={10} /><span><EditableText sectionId="personal" fieldName="phone" value={contact.phone} placeholder="Phone" /></span></div>
          <div className={`flex items-center gap-1.5 ${hideIfEmpty(contact.location)}`}><MapPin size={10} /><span><EditableText sectionId="personal" fieldName="location" value={contact.location} placeholder="Location" /></span></div>
          <div className={`flex items-center gap-1.5 ${hideIfEmpty(contact.website)}`}><LinkIcon size={10} /><span><EditableText sectionId="personal" fieldName="website" value={contact.website} placeholder="Website" /></span></div>
          <div className={`flex items-center gap-1.5 ${hideIfEmpty(contact.linkedin)}`}><Linkedin size={10} /><span><EditableText sectionId="personal" fieldName="linkedin" value={contact.linkedin} placeholder="LinkedIn" /></span></div>
          <div className={`flex items-center gap-1.5 ${hideIfEmpty(contact.github)}`}><Github size={10} /><span><EditableText sectionId="personal" fieldName="github" value={contact.github} placeholder="GitHub" /></span></div>
        </div>
      </div>
    );
  };

  // Compile raw flat blocks inside single pipeline
  const getRawBlocks = (): RenderBlock[] => {
    const list: RenderBlock[] = [];

    const personalSec = resume.sections.find(s => s.type === 'personal');
    if (personalSec && personalSec.visible) {
      list.push({ key: 'header', type: 'header' });
    }

    const activeSections = resume.sections.filter(s => s.visible && s.type !== 'personal' && s.items.length > 0);

    activeSections.forEach((sec) => {
      // Section title can be hidden per-section
      if (sec.layout?.showTitle !== false) {
        list.push({ key: `sh-${sec.id}`, type: 'section-heading', sectionId: sec.id });
      }

      const columns = sec.layout?.columns || 1;

      if (sec.type === 'summary') {
        list.push({ key: `sm-${sec.id}`, type: 'summary', sectionId: sec.id, data: sec.items[0] });
      } else if (sec.type === 'skills') {
        list.push({ key: `sk-${sec.id}`, type: 'skills-grid', sectionId: sec.id, data: sec.items });
      } else if (columns > 1) {
        // Render the whole section as one multi-column block (kept as a single
        // block so the pagination engine measures and places it as a unit).
        list.push({ key: `grid-${sec.id}`, type: 'item-grid', sectionId: sec.id, data: sec.items });
      } else {
        sec.items.forEach((item: any, idx) => {
          list.push({
            key: `item-${sec.id}-${item.id || idx}`,
            type: 'item',
            sectionId: sec.id,
            itemId: item.id || String(idx),
            data: item
          });
        });
      }
    });

    if (isTwoColumn) {
      list.push({ key: 'qr-code', type: 'qr-code' });
    }

    return list;
  };

  const renderBlockContent = (block: RenderBlock) => {
    const sec = resume.sections.find(s => s.id === block.sectionId);
    
    switch (block.type) {
      case 'header':
        return <div key={block.key}>{renderHeaderLayout()}</div>;
      case 'section-heading':
        return sec ? <div key={block.key}>{renderSectionHeader(sec)}</div> : null;
      case 'summary':
        return (
          <div key={block.key} className="py-0.5 select-text" style={{ textAlign: sectionAlign(sec!) }}>
            <EditableText
              sectionId={block.sectionId!}
              fieldName="summary"
              value={block.data || ''}
              placeholder="Write a brief, high-impact summary statement here..."
              tagName="p"
              className={`text-slate-600 font-sans mt-1 ${currentBodySize}`}
              style={{ lineHeight: lineHeightValue }}
            />
          </div>
        );
      case 'skills-grid': {
        const skillStyle = sec?.layout?.skillStyle || 'chips';
        const cols = sec?.layout?.columns || 1;
        const align = sectionAlign(sec!);
        const justify = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';

        // Comma-separated single line
        if (skillStyle === 'inline') {
          return (
            <div key={block.key} className="mt-1 pb-1 select-text text-[10px] text-slate-700 leading-relaxed" style={{ textAlign: align }}>
              {block.data.map((sk: any, idx: number) => (
                <span key={sk.id || idx}>
                  <EditableText sectionId={block.sectionId!} itemId={sk.id} fieldName="name" value={sk.name} placeholder="Skill" />
                  {sk.level && <span className="text-slate-400"> (<EditableText sectionId={block.sectionId!} itemId={sk.id} fieldName="level" value={sk.level} placeholder="Level" />)</span>}
                  {idx < block.data.length - 1 && <span className="text-slate-400 select-none"> &middot; </span>}
                </span>
              ))}
            </div>
          );
        }

        // Bulleted vertical list (optionally multi-column)
        if (skillStyle === 'list') {
          return (
            <ul
              key={block.key}
              className="mt-1 pb-1 select-text text-[10px] text-slate-700 leading-relaxed list-disc pl-4"
              style={{ columns: cols > 1 ? cols : undefined, textAlign: align }}
            >
              {block.data.map((sk: any, idx: number) => (
                <li key={sk.id || idx} className="ml-1">
                  <EditableText sectionId={block.sectionId!} itemId={sk.id} fieldName="name" value={sk.name} placeholder="Skill" />
                  {sk.level && <span className="text-slate-400 font-normal"> (<EditableText sectionId={block.sectionId!} itemId={sk.id} fieldName="level" value={sk.level} placeholder="Level" />)</span>}
                </li>
              ))}
            </ul>
          );
        }

        // Default: chips
        return (
          <div key={block.key} className="flex flex-wrap gap-1 mt-1 pb-1 select-text" style={{ justifyContent: justify }}>
            {block.data.map((sk: any, idx: number) => (
              <span
                key={sk.id || idx}
                style={{ borderColor: `${primaryColor}20` }}
                className="bg-slate-50 text-slate-800 border px-1.5 py-0.5 rounded text-[8.5px] font-medium leading-none flex items-center gap-0.5 shrink-0"
              >
                <EditableText sectionId={block.sectionId!} itemId={sk.id} fieldName="name" value={sk.name} placeholder="Skill" /> {sk.level && <span className="text-slate-400 font-normal select-none">(<EditableText sectionId={block.sectionId!} itemId={sk.id} fieldName="level" value={sk.level} placeholder="Level" />)</span>}
              </span>
            ))}
          </div>
        );
      }
      case 'item':
        return sec ? <div key={block.key} style={{ textAlign: sectionAlign(sec) }}>{renderItemContent(block.sectionId!, block.data, sec.type)}</div> : null;
      case 'item-grid':
        return sec ? (
          <div
            key={block.key}
            style={{ columns: (sec.layout?.columns || 1), textAlign: sectionAlign(sec) }}
            className="gap-x-5"
          >
            {block.data.map((item: any, idx: number) => (
              <div key={item.id || idx} className="break-inside-avoid mb-1.5">
                {renderItemContent(block.sectionId!, item, sec.type)}
              </div>
            ))}
          </div>
        ) : null;
      case 'qr-code':
        return (
          <div key={block.key} className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-left text-[9px] text-slate-400 select-none">
            <div>
              <p className="font-bold text-slate-500">Scan Digital Interactive Profile</p>
              <p>Verifiable Offline Portfolio Page</p>
            </div>
            <SVGQRCode value={`${typeof window !== 'undefined' ? window.location.origin : ''}/portfolio/${resume.id}`} />
          </div>
        );
      default:
        return null;
    }
  };

  // Re-calculate pages layout
  useLayoutEffect(() => {
    if (!measuringRef.current) return;

    // Measure height of all block nodes
    const query = measuringRef.current.querySelectorAll('[data-block-id]');
    const blockMap: Record<string, number> = {};
    
    query.forEach((el) => {
      const id = el.getAttribute('data-block-id');
      if (id) {
        // Use clientHeight or bounding client rect for extreme preciseness
        blockMap[id] = el.getBoundingClientRect().height;
      }
    });

    // Padding values offsets
    let pagePadding = 64; 
    if (styles.spacing === 'compact') pagePadding = 40; 
    if (styles.spacing === 'relaxed') pagePadding = 80; 

    // Total A4 page height is 1123px. Subtract top/bottom padding & slight header spacing buffer range
    const maxUsableHeight = 1123 - pagePadding - 28;

    const computedPages: RenderBlock[][] = [];
    const list = getRawBlocks();

    // Spacing gaps for calculations
    let blockGap = 16;
    if (styles.spacing === 'compact') blockGap = 8;
    if (styles.spacing === 'relaxed') blockGap = 20;

    const mainGap = 16;
    const sidebarGap = 12;

    if (isTwoColumn) {
      const mainBlocks = list.filter(b => !isSidebarBlock(b));
      const sidebarBlocks = list.filter(b => isSidebarBlock(b));

      // Paginate main column blocks
      const mainPages: RenderBlock[][] = [];
      let currentMainPage: RenderBlock[] = [];
      let currentMainHeight = 0;

      mainBlocks.forEach((block) => {
        const height = blockMap[block.key] || 0;
        const potentialHeight = currentMainHeight === 0 ? height : currentMainHeight + mainGap + height;
        if (potentialHeight > maxUsableHeight && currentMainPage.length > 0) {
          // Orphan heading protection: if the last item is a heading, move it to the page start
          const lastBlock = currentMainPage[currentMainPage.length - 1];
          if (lastBlock && lastBlock.type === 'section-heading') {
            currentMainPage.pop();
            mainPages.push(currentMainPage);
            currentMainPage = [lastBlock, block];
            const headingHeight = blockMap[lastBlock.key] || 0;
            currentMainHeight = headingHeight + mainGap + height;
          } else {
            mainPages.push(currentMainPage);
            currentMainPage = [block];
            currentMainHeight = height;
          }
        } else {
          currentMainPage.push(block);
          currentMainHeight = potentialHeight;
        }
      });
      if (currentMainPage.length > 0) {
        mainPages.push(currentMainPage);
      }

      // Paginate sidebar blocks
      const sidebarPages: RenderBlock[][] = [];
      let currentSidebarPage: RenderBlock[] = [];
      let currentSidebarHeight = 0;

      sidebarBlocks.forEach((block) => {
        const height = blockMap[block.key] || 0;
        const potentialHeight = currentSidebarHeight === 0 ? height : currentSidebarHeight + sidebarGap + height;
        if (potentialHeight > maxUsableHeight && currentSidebarPage.length > 0) {
          // Orphan heading protection for sidebar
          const lastBlock = currentSidebarPage[currentSidebarPage.length - 1];
          if (lastBlock && lastBlock.type === 'section-heading') {
            currentSidebarPage.pop();
            sidebarPages.push(currentSidebarPage);
            currentSidebarPage = [lastBlock, block];
            const headingHeight = blockMap[lastBlock.key] || 0;
            currentSidebarHeight = headingHeight + sidebarGap + height;
          } else {
            sidebarPages.push(currentSidebarPage);
            currentSidebarPage = [block];
            currentSidebarHeight = height;
          }
        } else {
          currentSidebarPage.push(block);
          currentSidebarHeight = potentialHeight;
        }
      });
      if (currentSidebarPage.length > 0) {
        sidebarPages.push(currentSidebarPage);
      }

      // Combine main and sidebar pages
      const totalPagesCount = Math.max(mainPages.length, sidebarPages.length);
      for (let p = 0; p < totalPagesCount; p++) {
         const pageCombine: RenderBlock[] = [];
         if (p < mainPages.length) {
           pageCombine.push(...mainPages[p]);
         }
         if (p < sidebarPages.length) {
           pageCombine.push(...sidebarPages[p]);
         }
         computedPages.push(pageCombine);
      }
    } else {
      // Single column pagination logic
      let currentPage: RenderBlock[] = [];
      let currentHeight = 0;

      list.forEach((block) => {
        const height = blockMap[block.key] || 0;
        const potentialHeight = currentHeight === 0 ? height : currentHeight + blockGap + height;
        if (potentialHeight > maxUsableHeight && currentPage.length > 0) {
          // Orphan heading protection for single column
          const lastBlock = currentPage[currentPage.length - 1];
          if (lastBlock && lastBlock.type === 'section-heading') {
            currentPage.pop();
            computedPages.push(currentPage);
            currentPage = [lastBlock, block];
            const headingHeight = blockMap[lastBlock.key] || 0;
            currentHeight = headingHeight + blockGap + height;
          } else {
            computedPages.push(currentPage);
            currentPage = [block];
            currentHeight = height;
          }
        } else {
          currentPage.push(block);
          currentHeight = potentialHeight;
        }
      });

      if (currentPage.length > 0) {
        computedPages.push(currentPage);
      }
    }

    setPages(computedPages);
  }, [resume, styles.spacing, styles.fontSize, styles.fontFamily, styles.sectionHeadingSize, isTwoColumn]);

  // Fallback blocks list before measuring completes
  const rawList = getRawBlocks();
  const renderPagesList = pages.length > 0 ? pages : [rawList];

  return (
    <div className="space-y-4 flex flex-col items-center h-full w-full no-print select-none">
      {/* Visual Workspace Controls */}
      <div className="bg-white border border-slate-200/60 rounded-xl px-4 py-2.5 shadow-xs flex items-center justify-between w-full no-print">
        <span className="text-xxs font-bold text-slate-500 font-sans uppercase tracking-wider flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
          WYSIWYG Multi-page Preview ({renderPagesList.length} {renderPagesList.length === 1 ? 'Page' : 'Pages'})
        </span>
        <div className="flex items-center gap-2">
          {/* Auto Fit toggle control */}
          <button
            onClick={() => {
              setIsAutoFit(prev => {
                const next = !prev;
                if (next && containerRef.current) {
                  const width = containerRef.current.clientWidth || containerRef.current.getBoundingClientRect().width;
                  if (width > 0) {
                    const fitScale = Math.min(1.0, (width - 48) / 794);
                    setZoom(Math.max(0.35, Number(fitScale.toFixed(2))));
                  }
                }
                return next;
              });
            }}
            className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
              isAutoFit
                ? 'bg-indigo-50 border-indigo-200 text-indigo-755 font-sans'
                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50 font-sans'
            }`}
            title="Toggle automatic layout fit to container width"
          >
            Auto Fit: {isAutoFit ? 'ON' : 'OFF'}
          </button>

          <div className="h-4 w-[1px] bg-slate-200 mx-0.5" />

          {/* Zoom Out Button */}
          <button
            onClick={() => {
              setIsAutoFit(false);
              setZoom(prev => Math.max(0.25, prev - 0.05));
            }}
            className="p-1.5 text-slate-500 hover:bg-slate-50 rounded border border-slate-200 transition-all font-semibold hover:text-slate-850 cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut size={12} />
          </button>

          {/* Quick Click reset to 100% */}
          <button
            onClick={() => {
              setIsAutoFit(false);
              setZoom(1.00);
            }}
            className="text-[10.5px] font-mono font-extrabold text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/20 px-2 py-0.5 rounded transition-all select-none cursor-pointer"
            title="Quick reset to 100% size"
          >
            {Math.round(zoom * 100)}%
          </button>

          {/* Zoom In Button */}
          <button
            onClick={() => {
              setIsAutoFit(false);
              setZoom(prev => Math.min(2.0, prev + 0.05));
            }}
            className="p-1.5 text-slate-500 hover:bg-slate-50 rounded border border-slate-200 transition-all font-semibold hover:text-slate-850 cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn size={12} />
          </button>
 
          <div className="h-4 w-[1px] bg-slate-200 mx-1" />
 
          <button
            onClick={() => {
              if (onToggleExpand) {
                onToggleExpand();
              } else {
                setFullWidth(prev => !prev);
              }
            }}
            className={`p-1.5 rounded border transition-all cursor-pointer ${
              (isExpanded !== undefined ? isExpanded : fullWidth)
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-black scale-105'
                : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
            }`}
            title="Toggle wide workspace layout"
          >
            <Maximize2 size={12} />
          </button>
        </div>
      </div>
 
      {/* Hidden Unpaginated Off-screen Measurer */}
      <div 
        ref={measuringRef}
        id="resume-measuring-container"
        style={{
          position: 'absolute',
          left: '-9999px',
          top: '-9999px',
          width: '794px',
          backgroundColor: styles.backgroundColor,
          color: styles.textColor,
          fontFamily: fontStack,
          pointerEvents: 'none',
          visibility: 'hidden',
        }}
        className={`${paddingClass} leading-snug flex flex-col`}
      >
        {isTwoColumn ? (
          <div className="grid grid-cols-3 gap-5 w-full">
            {/* Main Timeline Column */}
            <div className="col-span-2 space-y-4">
              {rawList.filter(b => !isSidebarBlock(b)).map((block) => (
                <div key={block.key} data-block-id={block.key}>
                  {renderBlockContent(block)}
                </div>
              ))}
            </div>
            {/* Sidebar Stats Column */}
            <div className="col-span-1 border-l border-slate-200 pl-5 space-y-3">
              {rawList.filter(b => isSidebarBlock(b)).map((block) => (
                <div key={block.key} data-block-id={block.key}>
                  {renderBlockContent(block)}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className={sectionSpacingClass}>
            {rawList.map((block) => (
              <div key={block.key} data-block-id={block.key}>
                {renderBlockContent(block)}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Visually Scrollable A4 pages deck */}
      <div 
        ref={containerRef}
        className={`w-full overflow-y-auto overflow-x-auto p-6 rounded-xl relative bg-slate-100/50 border border-slate-200/40 flex flex-col items-center gap-6 select-none ${
          (isExpanded !== undefined ? isExpanded : fullWidth) ? 'max-w-none' : 'max-w-3xl'
        }`}
      >
        {/* Scale Wrapper */}
        <div
          style={{
            width: `${794 * zoom}px`,
            height: `${renderPagesList.length * 1123 * zoom + (renderPagesList.length - 1) * 24 * zoom}px`,
            position: 'relative',
          }}
          className="shrink-0 transition-all duration-150"
        >
          <div
            ref={ref}
            id="resume-pages-container"
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
              position: 'absolute',
              left: 0,
              top: 0,
              width: '794px',
            }}
            className="flex flex-col gap-6 origin-top-left"
          >
          {renderPagesList.map((pageBlocks, pageIdx) => (
            <div
              key={pageIdx}
              style={{
                width: '794px',
                height: '1123px',
                backgroundColor: styles.backgroundColor,
                color: styles.textColor,
                fontFamily: fontStack,
              }}
              className={`a4-page shadow-xl border border-slate-200/60 text-left shrink-0 select-text overflow-hidden relative flex flex-col justify-between ${paddingClass}`}
            >
              <div className="flex-1 w-full flex flex-col">
                {isTwoColumn ? (
                  <div className="grid grid-cols-3 gap-5 flex-1 w-full">
                    {/* Main Timeline Column */}
                    <div className="col-span-2 space-y-4">
                      {pageBlocks.filter(b => !isSidebarBlock(b)).map(b => renderBlockContent(b))}
                    </div>
                    {/* Sidebar Stats Column */}
                    <div className="col-span-1 border-l border-slate-200/50 pl-5 space-y-3">
                      {pageBlocks.filter(b => isSidebarBlock(b)).map(b => renderBlockContent(b))}
                    </div>
                  </div>
                ) : (
                  <div className={sectionSpacingClass}>
                    {pageBlocks.map(b => renderBlockContent(b))}
                  </div>
                )}
              </div>

              {/* Classic layout pagination footer tag */}
              {renderPagesList.length > 1 && (
                <div className="w-full flex justify-between items-center text-[8.5px] text-slate-400 border-t border-slate-100/40 pt-1 mt-4 select-none uppercase font-mono tracking-wider">
                  <span className="font-semibold">{contact.fullName?.replace(/<[^>]*>/g, '').trim() || resume.title || 'Draft Resume'}</span>
                  <span className="font-bold">Page {pageIdx + 1} of {renderPagesList.length}</span>
                </div>
              )}
            </div>
          ))}
          </div>
        </div>
      </div>
      
      {/* Print Frame Container */}
      {typeof document !== 'undefined' && createPortal(
        <div id="print-only-container" className="hidden print:block bg-white">
          {renderPagesList.map((pageBlocks, pageIdx) => (
            <div
              key={pageIdx}
              style={{
                width: '794px',
                height: '1123px',
                backgroundColor: styles.backgroundColor,
                color: styles.textColor,
                fontFamily: fontStack,
              }}
              className={`a4-page select-text overflow-hidden relative flex flex-col justify-between ${paddingClass}`}
            >
              <div className="flex-1 w-full flex flex-col">
                {isTwoColumn ? (
                  <div className="grid grid-cols-3 gap-5 flex-1 w-full">
                    {/* Main Timeline Column */}
                    <div className="col-span-2 space-y-4">
                      {pageBlocks.filter(b => !isSidebarBlock(b)).map(b => renderBlockContent(b))}
                    </div>
                    {/* Sidebar Stats Column */}
                    <div className="col-span-1 border-l border-slate-150/50 pl-5 space-y-3">
                      {pageBlocks.filter(b => isSidebarBlock(b)).map(b => renderBlockContent(b))}
                    </div>
                  </div>
                ) : (
                  <div className={sectionSpacingClass}>
                    {pageBlocks.map(b => renderBlockContent(b))}
                  </div>
                )}
              </div>

              {/* Classic layout pagination footer tag */}
              {renderPagesList.length > 1 && (
                <div className="w-full flex justify-between items-center text-[8.5px] text-slate-400 border-t border-slate-100/40 pt-1 mt-4 select-none uppercase font-mono tracking-wider">
                  <span className="font-semibold">{contact.fullName?.replace(/<[^>]*>/g, '').trim() || resume.title || 'Draft Resume'}</span>
                  <span className="font-bold">Page {pageIdx + 1} of {renderPagesList.length}</span>
                </div>
              )}
            </div>
          ))}
        </div>,
        document.body
      )}

      {/* Floating Selection Rich Formatting Toolbar Palette */}
      {showToolbar && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position: 'absolute',
            top: `${toolbarPosition.top}px`,
            left: `${toolbarPosition.left}px`,
            transform: 'translateX(-50%)',
            zIndex: 99999
          }}
          onMouseDown={(e) => {
            // Prevent clearing Selection focus
            e.preventDefault();
          }}
          className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 text-white rounded-xl px-2.5 py-1.5 shadow-2xl animate-in fade-in-50 zoom-in-95 duration-100 shrink-0 select-none no-print border-indigo-950/40"
        >
          {/* Font Family Command Selector — full dropdown applied to the selection */}
          <div className="flex items-center gap-1 shrink-0">
            <select
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => {
                if (e.target.value) runFormat('fontName', e.target.value);
                e.target.selectedIndex = 0;
              }}
              defaultValue=""
              title="Apply font family to the selected text"
              className="text-[9.5px] font-sans font-bold bg-slate-800 text-slate-200 rounded px-1.5 py-0.5 outline-hidden cursor-pointer hover:bg-slate-700 transition-all max-w-[92px]"
            >
              <option value="" disabled>Font</option>
              {FONT_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>

          <div className="h-4.5 w-[1px] bg-slate-800 shrink-0" />

          {/* Font Size Selector from 1 to 7 */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={() => runFormat('fontSize', '1')}
              className="text-[9.5px] font-mono leading-none hover:bg-slate-800 px-1 py-0.5 rounded text-slate-400 hover:text-white transition-all cursor-pointer"
              title="Font Size Small"
            >
              sm
            </button>
            <button
              onClick={() => runFormat('fontSize', '3')}
              className="text-[9.5px] font-mono leading-none hover:bg-slate-800 px-1 py-0.5 rounded text-slate-400 hover:text-white transition-all cursor-pointer"
              title="Font Size Medium"
            >
              md
            </button>
            <button
              onClick={() => runFormat('fontSize', '5')}
              className="text-[9.5px] font-mono leading-none hover:bg-slate-800 px-1 py-0.5 rounded text-slate-405 hover:text-white transition-all cursor-pointer"
              title="Font Size Large"
            >
              lg
            </button>
          </div>

          <div className="h-4.5 w-[1px] bg-slate-800 shrink-0" />

          {/* Toggle buttons (Bold, Italic, Underline) */}
          <button
            onClick={() => runFormat('bold')}
            className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Bold (Ctrl+B)"
          >
            <Bold size={11} className="stroke-[2.5]" />
          </button>
          <button
            onClick={() => runFormat('italic')}
            className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Italic (Ctrl+I)"
          >
            <Italic size={11} className="stroke-[2.5]" />
          </button>
          <button
            onClick={() => runFormat('underline')}
            className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Underline (Ctrl+U)"
          >
            <Underline size={11} className="stroke-[2.5]" />
          </button>

          <div className="h-4.5 w-[1px] bg-slate-800 shrink-0" />

          {/* Lists (bulleted / numbered) */}
          <button
            onClick={() => runFormat('insertUnorderedList')}
            className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Bulleted List"
          >
            <List size={11} className="stroke-[2.5]" />
          </button>
          <button
            onClick={() => runFormat('insertOrderedList')}
            className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Numbered List"
          >
            <ListOrdered size={11} className="stroke-[2.5]" />
          </button>

          <div className="h-4.5 w-[1px] bg-slate-800 shrink-0" />

          {/* Text alignment controls */}
          <button
            onClick={() => runFormat('justifyLeft')}
            className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Align Left"
          >
            <AlignLeft size={11} className="stroke-[2.5]" />
          </button>
          <button
            onClick={() => runFormat('justifyCenter')}
            className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Align Center"
          >
            <AlignCenter size={11} className="stroke-[2.5]" />
          </button>
          <button
            onClick={() => runFormat('justifyRight')}
            className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Align Right"
          >
            <AlignRight size={11} className="stroke-[2.5]" />
          </button>

          <div className="h-4.5 w-[1px] bg-slate-800 shrink-0" />

          {/* Indentation */}
          <button
            onClick={() => runFormat('outdent')}
            className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Decrease Indent"
          >
            <IndentDecrease size={11} className="stroke-[2.5]" />
          </button>
          <button
            onClick={() => runFormat('indent')}
            className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Increase Indent"
          >
            <IndentIncrease size={11} className="stroke-[2.5]" />
          </button>

          <div className="h-4.5 w-[1px] bg-slate-800 shrink-0" />

          {/* Text Color palette selection */}
          <div className="flex gap-1 shrink-0">
            <button
              onClick={() => runFormat('foreColor', '#1e293b')}
              style={{ backgroundColor: '#1e293b' }}
              className="w-2.5 h-2.5 rounded-full border border-slate-700 hover:ring-1 hover:ring-white transition-all cursor-pointer"
              title="#1e293b Slate"
            />
            <button
              onClick={() => runFormat('foreColor', '#dc2626')}
              style={{ backgroundColor: '#dc2626' }}
              className="w-2.5 h-2.5 rounded-full border border-slate-700 hover:ring-1 hover:ring-white transition-all cursor-pointer"
              title="#dc2626 Red"
            />
            <button
              onClick={() => runFormat('foreColor', '#2563eb')}
              style={{ backgroundColor: '#2563eb' }}
              className="w-2.5 h-2.5 rounded-full border border-slate-700 hover:ring-1 hover:ring-white transition-all cursor-pointer"
              title="#2563eb Blue"
            />
            <button
              onClick={() => runFormat('foreColor', '#16a34a')}
              style={{ backgroundColor: '#16a34a' }}
              className="w-2.5 h-2.5 rounded-full border border-slate-700 hover:ring-1 hover:ring-white transition-all cursor-pointer"
              title="#16a34a Green"
            />
            <button
              onClick={() => runFormat('foreColor', '#d97706')}
              style={{ backgroundColor: '#d97706' }}
              className="w-2.5 h-2.5 rounded-full border border-slate-700 hover:ring-1 hover:ring-white transition-all cursor-pointer"
              title="#d97706 Amber"
            />
          </div>

          <div className="h-4.5 w-[1px] bg-slate-800 shrink-0" />

          {/* Helper functions (remove formatting) */}
          <button
            onClick={() => runFormat('removeFormat')}
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
            title="Clear All Text Formatting"
          >
            <Paintbrush size={11} />
          </button>
        </div>,
        document.body
      )}
    </div>
  );
});

LivePreview.displayName = 'LivePreview';
