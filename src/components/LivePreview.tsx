/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useLayoutEffect, forwardRef } from 'react';
import { createPortal } from 'react-dom';
import { Resume, ResumeSection } from '../types';
import { Mail, Phone, MapPin, Link as LinkIcon, Linkedin, Github, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

interface LivePreviewProps {
  resume: Resume;
}

interface RenderBlock {
  key: string;
  type: 'header' | 'section-heading' | 'summary' | 'skills-grid' | 'item' | 'qr-code';
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

export const LivePreview = forwardRef<HTMLDivElement, LivePreviewProps>(({ resume }, ref) => {
  const [zoom, setZoom] = useState(0.85);
  const [fullWidth, setFullWidth] = useState(false);
  const [pages, setPages] = useState<RenderBlock[][]>([]);
  const measuringRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Dynamic Auto-fit for smaller devices/viewports using ResizeObserver
  useLayoutEffect(() => {
    if (!containerRef.current) return;
    
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
  }, []);

  const styles = resume.styles;
  const primaryColor = styles.primaryColor;

  // Derive font family
  let fontClass = 'font-sans';
  if (styles.fontFamily === 'serif') fontClass = 'font-serif';
  if (styles.fontFamily === 'mono') fontClass = 'font-mono';

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

  const isTwoColumn = ['functional-two-col', 'creative-bento', 'designer-vintage'].includes(resume.templateId);

  // Helper to check if a block belongs in the sidebar partition (for two column layout templates)
  const isSidebarBlock = (block: RenderBlock): boolean => {
    if (!isTwoColumn) return false;
    const sec = resume.sections.find(s => s.id === block.sectionId);
    if (!sec) return false;
    return ['skills', 'languages', 'certifications', 'awards', 'references'].includes(sec.type);
  };

  // Description bullet formatting
  const renderDescription = (textVal: string) => {
    if (!textVal) return null;
    const lines = textVal.split('\n').filter(l => l.trim().length > 0);
    return (
      <ul className="list-disc pl-4 space-y-0.5 mt-1 text-slate-600">
        {lines.map((line, idx) => {
          const clean = line.replace(/^[\s·•\-*\d\.\)]+/, '').trim();
          return <li key={idx} className={currentBodySize}>{clean}</li>;
        })}
      </ul>
    );
  };

  // Specific single item visual structure
  const renderItemContent = (sectionId: string, item: any, sectionType: string) => {
    switch (sectionType) {
      case 'experience':
        if (resume.templateId === 'developer-terminal') {
          return (
            <div className="border-l-2 border-green-700 pl-3 py-0.5">
              <p className="font-mono text-xs font-bold text-green-400">
                {item.position} <span className="text-slate-400">@ {item.company}</span>
              </p>
              <p className="font-mono text-[9px] text-slate-500">
                [{item.startDate} - {item.current ? 'PRESENT' : item.endDate || ''}] {item.location && `| Loc: ${item.location}`}
              </p>
              {renderDescription(item.description)}
            </div>
          );
        }
        return (
          <div className="py-0.5">
            <div className="flex justify-between items-baseline flex-wrap gap-x-2">
              <h5 className="font-bold text-slate-800 text-[11px]">
                {item.position} <span className="text-slate-400 font-normal">at</span> {item.company}
              </h5>
              <span className="text-[9px] text-slate-400 font-semibold uppercase">
                {item.startDate} – {item.current ? 'Present' : item.endDate}
              </span>
            </div>
            {item.location && <p className="text-[9px] text-slate-405 italic ml-0.5">{item.location}</p>}
            {renderDescription(item.description)}
          </div>
        );

      case 'education':
        return (
          <div className="py-0.5">
            <div className="flex justify-between items-baseline flex-wrap gap-x-2">
              <h5 className="font-bold text-slate-800 text-[11px]">
                {item.degree} in {item.fieldOfStudy}
              </h5>
              <span className="text-[9px] text-slate-400 font-semibold">
                {item.startDate} – {item.current ? 'Present' : item.endDate}
              </span>
            </div>
            <div className="flex justify-between items-center text-[10px] text-slate-500">
              <p className="font-medium">{item.institution}</p>
              {item.grade && <span className="bg-slate-100 px-1 py-0.2 rounded text-[9px] font-mono font-bold uppercase">{item.grade}</span>}
            </div>
            {item.description && <p className="text-[10px] text-slate-500 mt-1 italic leading-relaxed">{item.description}</p>}
          </div>
        );

      case 'projects':
        return (
          <div className="py-0.5">
            <div className="flex justify-between items-baseline flex-wrap gap-x-2">
              <h5 className="font-bold text-slate-800 text-[11px] flex items-center gap-1">
                {item.name}
                {item.url && <span className="text-[9px] text-slate-400 font-normal italic">({item.url})</span>}
              </h5>
              <span className="text-[10px] text-slate-550 font-semibold">
                {item.role}
              </span>
            </div>
            {renderDescription(item.description)}
          </div>
        );

      case 'certifications':
        return (
          <div className="bg-slate-50/50 p-1.5 rounded-lg border border-slate-100/80">
            <p className="font-bold text-slate-700 text-[10px] leading-tight">{item.name}</p>
            <div className="flex justify-between items-center text-[9px] text-slate-400 mt-0.5">
              <span>{item.issuer}</span>
              <span>{item.date}</span>
            </div>
          </div>
        );

      case 'awards':
        return (
          <div className="py-0.5">
            <div className="flex justify-between items-baseline">
              <p className="font-bold text-slate-800 text-[10px]">{item.title}</p>
              <span className="text-[9px] text-slate-400 font-mono">{item.date}</span>
            </div>
            <p className="text-[9px] text-indigo-750 font-bold">{item.issuer}</p>
            {item.description && <p className="text-[9.5px] text-slate-500 mt-0.5">{item.description}</p>}
          </div>
        );

      case 'languages':
        return (
          <span className="bg-slate-100 text-slate-700 border border-slate-200/50 px-2 py-0.5 rounded text-[9px] font-bold shrink-0">
            {item.name} {item.proficiency && <span className="text-slate-400 font-normal">({item.proficiency})</span>}
          </span>
        );

      case 'volunteer':
        return (
          <div className="py-0.5">
            <div className="flex justify-between items-baseline">
              <p className="font-bold text-slate-800 text-[10px]">{item.role} at {item.organization}</p>
              <span className="text-[9px] text-slate-400">{item.startDate} - {item.current ? 'Present' : item.endDate}</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{item.description}</p>
          </div>
        );

      case 'publications':
        return (
          <div className="py-0.5">
            <div className="flex justify-between items-baseline">
              <p className="font-bold text-slate-800 text-[10px]">"{item.title}"</p>
              <span className="text-[9px] text-slate-400 font-mono">{item.date}</span>
            </div>
            <p className="text-[9px] text-slate-500">{item.publisher}</p>
            {item.description && <p className="text-[9px] text-slate-500 italic mt-0.5 leading-relaxed">{item.description}</p>}
          </div>
        );

      case 'references':
        return (
          <div className="p-1.5 border border-slate-100 rounded-lg">
            <p className="font-bold text-slate-800 text-[10px]">{item.name}</p>
            <p className="text-[9px] text-slate-500">{item.relationship} • {item.company}</p>
            <p className="text-[9px] text-indigo-600 mt-0.5 hover:underline select-all">{item.contact}</p>
          </div>
        );

      case 'custom':
        return (
          <div className="py-0.5">
            <div className="flex justify-between items-baseline">
              <p className="font-bold text-slate-800 text-[11px]">{item.title} {item.subtitle && <span className="font-normal text-slate-400">({item.subtitle})</span>}</p>
              <span className="text-[9px] text-slate-400">{item.date}</span>
            </div>
            {item.description && renderDescription(item.description)}
          </div>
        );

      default:
        return null;
    }
  };

  const renderSectionHeader = (sec: ResumeSection) => {
    let headingAlign = 'text-left';
    if (styles.sectionHeadingAlignment === 'center') headingAlign = 'text-center';
    else if (styles.sectionHeadingAlignment === 'right') headingAlign = 'text-right';

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
        <h4 className={`${currentTitleSize} font-bold tracking-tight uppercase leading-tight pb-0.5 ${borderBottomClass}`} style={{ borderColor: `${primaryColor}30` }}>
          {sec.name}
        </h4>
      </div>
    );
  };

  const renderHeaderLayout = () => {
    const personalSec = resume.sections.find(s => s.type === 'personal');
    const contact = personalSec?.items[0] || {};

    if (!personalSec || !personalSec.visible) return null;

    if (resume.templateId === 'developer-terminal') {
      return (
        <div className="font-mono mb-4 bg-slate-900 border border-slate-800 p-3 rounded text-green-400">
          <h1 className="text-base font-bold">&gt; JOBS_DB: {contact.fullName || 'UNTITLED_ENGINEER'}</h1>
          <p className="text-[10px] text-slate-400 uppercase mt-1">TITLE // {contact.jobTitle || 'CODER'}</p>
          <div className="mt-2 text-[9.5px] font-mono space-y-0.5 text-slate-300">
            {contact.email && <p># MAIL: {contact.email}</p>}
            {contact.phone && <p># PHONE: {contact.phone}</p>}
            {contact.location && <p># COORDS: {contact.location}</p>}
            <p># CHANNELS: {[contact.github, contact.linkedin, contact.website].filter(Boolean).join(' // ')}</p>
          </div>
        </div>
      );
    }

    if (resume.templateId === 'corporate-navy') {
      return (
        <div className="bg-indigo-950 text-white p-5 -mx-8 -mt-8 mb-5 relative overflow-hidden">
          <div className="relative z-10 text-left">
            <h1 className="text-lg font-extrabold tracking-tight uppercase">{contact.fullName || 'Untitled Applicant'}</h1>
            <p className="text-[10px] uppercase tracking-widest text-indigo-300 font-bold mt-1">{contact.jobTitle}</p>
            <div className="mt-3 pt-3 border-t border-indigo-900/60 grid grid-cols-2 gap-y-1 text-[9.5px] text-indigo-100">
              {contact.email && <div className="flex items-center gap-1.5"><Mail size={10} /><span>{contact.email}</span></div>}
              {contact.phone && <div className="flex items-center gap-1.5"><Phone size={10} /><span>{contact.phone}</span></div>}
              {contact.location && <div className="flex items-center gap-1.5"><MapPin size={10} /><span>{contact.location}</span></div>}
              {contact.website && <div className="flex items-center gap-1.5"><LinkIcon size={10} /><span>{contact.website}</span></div>}
              {contact.linkedin && <div className="flex items-center gap-1.5"><Linkedin size={10} /><span>{contact.linkedin}</span></div>}
              {contact.github && <div className="flex items-center gap-1.5"><Github size={10} /><span>{contact.github}</span></div>}
            </div>
          </div>
          <div className="absolute -bottom-16 -right-16 w-36 h-36 bg-indigo-600/20 rounded-full blur-2xl animate-pulse" />
        </div>
      );
    }

    if (resume.templateId === 'executive-classic') {
      return (
        <div className="text-center mb-5">
          <h1 className="font-serif text-xl font-extrabold tracking-tight text-slate-800">{contact.fullName}</h1>
          <p className="text-[10px] tracking-widest uppercase text-slate-500 font-serif font-semibold italic mt-0.5">{contact.jobTitle}</p>
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[9.5px] text-slate-600 mt-2 font-mono">
            {contact.email && <span>{contact.email}</span>}
            {contact.phone && <span>{contact.phone}</span>}
            {contact.location && <span>{contact.location}</span>}
            {contact.website && <span className="underline">{contact.website}</span>}
            {contact.linkedin && <span>{contact.linkedin}</span>}
          </div>
          <div className="h-[2px] bg-slate-800 w-full mt-3" />
        </div>
      );
    }

    return (
      <div className="mb-4 flex justify-between items-start flex-wrap gap-3 border-b border-slate-100 pb-4">
        <div className="text-left">
          <h1 className="text-xl font-black tracking-tight text-slate-800" style={{ color: primaryColor }}>
            {contact.fullName || 'Your Full Name'}
          </h1>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">
            {contact.jobTitle || 'Desired Position Title'}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-y-0.5 text-[9.5px] text-slate-600 max-w-sm text-left">
          {contact.email && <div className="flex items-center gap-1.5"><Mail size={10} /><span>{contact.email}</span></div>}
          {contact.phone && <div className="flex items-center gap-1.5"><Phone size={10} /><span>{contact.phone}</span></div>}
          {contact.location && <div className="flex items-center gap-1.5"><MapPin size={10} /><span>{contact.location}</span></div>}
          {contact.website && <div className="flex items-center gap-1.5"><LinkIcon size={10} /><span>{contact.website}</span></div>}
          {contact.linkedin && <div className="flex items-center gap-1.5"><Linkedin size={10} /><span>{contact.linkedin}</span></div>}
          {contact.github && <div className="flex items-center gap-1.5"><Github size={10} /><span>{contact.github}</span></div>}
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
      list.push({ key: `sh-${sec.id}`, type: 'section-heading', sectionId: sec.id });

      if (sec.type === 'summary') {
        list.push({ key: `sm-${sec.id}`, type: 'summary', sectionId: sec.id, data: sec.items[0] });
      } else if (sec.type === 'skills') {
        list.push({ key: `sk-${sec.id}`, type: 'skills-grid', sectionId: sec.id, data: sec.items });
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
          <p key={block.key} className={`text-slate-600 font-sans text-left mt-1 ${currentBodySize}`}>
            {block.data}
          </p>
        );
      case 'skills-grid':
        return (
          <div key={block.key} className="flex flex-wrap gap-1 mt-1 pb-1">
            {block.data.map((sk: any, idx: number) => (
              <span
                key={sk.id || idx}
                style={{ borderColor: `${primaryColor}20` }}
                className="bg-slate-50 text-slate-800 border px-1.5 py-0.5 rounded text-[8.5px] font-medium leading-none"
              >
                {sk.name} {sk.level && <span className="text-slate-400 font-normal">({sk.level})</span>}
              </span>
            ))}
          </div>
        );
      case 'item':
        return sec ? <div key={block.key}>{renderItemContent(block.sectionId!, block.data, sec.type)}</div> : null;
      case 'qr-code':
        return (
          <div key={block.key} className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-left text-[9px] text-slate-400 select-none">
            <div>
              <p className="font-bold text-slate-500">Scan Digital Interactive Profile</p>
              <p>Verifiable Offline Portfolio Page</p>
            </div>
            <SVGQRCode value={`https://aistudio.build/portfolio/${resume.id}`} />
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
      <div className="bg-white border border-slate-200/60 rounded-xl px-4 py-2.5 shadow-xxs flex items-center justify-between w-full no-print">
        <span className="text-xxs font-bold text-slate-500 font-sans uppercase tracking-wider flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
          WYSIWYG Multi-page Preview ({renderPagesList.length} {renderPagesList.length === 1 ? 'Page' : 'Pages'})
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom(prev => Math.max(0.6, prev - 0.05))}
            className="p-1.5 text-slate-550 hover:bg-slate-50 rounded border border-slate-150 transition-all font-semibold hover:text-slate-800"
            title="Zoom Out"
          >
            <ZoomOut size={12} />
          </button>
          <span className="text-xxxxs font-mono font-extrabold text-slate-500 w-10 text-center select-none">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(prev => Math.min(1.2, prev + 0.05))}
            className="p-1.5 text-slate-550 hover:bg-slate-50 rounded border border-slate-150 transition-all font-semibold hover:text-slate-800"
            title="Zoom In"
          >
            <ZoomIn size={12} />
          </button>
 
          <div className="h-4 w-[1px] bg-slate-200 mx-1" />
 
          <button
            onClick={() => setFullWidth(prev => !prev)}
            className={`p-1.5 rounded border transition-all ${
              fullWidth
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold'
                : 'bg-white border-slate-200 text-slate-550 hover:bg-slate-50'
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
          pointerEvents: 'none',
          visibility: 'hidden',
        }}
        className={`${fontClass} ${paddingClass} leading-snug flex flex-col`}
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
            <div className="col-span-1 border-l border-slate-150/50 pl-5 space-y-3">
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
        className={`w-full overflow-y-auto overflow-x-auto p-6 rounded-xl relative bg-slate-150/70 border border-slate-200/50 flex flex-col items-center gap-6 select-none ${
          fullWidth ? 'max-w-none' : 'max-w-3xl'
        }`}
      >
        {/* Scale constraints layout Wrapper: prevents absolute scaling from breaking container bounds */}
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
              }}
              className={`a4-page shadow-xl border border-slate-200/60 text-left shrink-0 select-text overflow-hidden relative flex flex-col justify-between ${fontClass} ${paddingClass}`}
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
                <div className="w-full flex justify-between items-center text-[8.5px] text-slate-450 border-t border-slate-100/40 pt-1 mt-4 select-none uppercase font-mono tracking-wider">
                  <span className="font-semibold">{resume.title || 'Draft Resume'}</span>
                  <span className="font-bold">Page {pageIdx + 1} of {renderPagesList.length}</span>
                </div>
              )}
            </div>
          ))}
          </div>
        </div>
      </div>
      
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
              }}
              className={`a4-page select-text overflow-hidden relative flex flex-col justify-between ${fontClass} ${paddingClass}`}
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
                <div className="w-full flex justify-between items-center text-[8.5px] text-slate-450 border-t border-slate-100/40 pt-1 mt-4 select-none uppercase font-mono tracking-wider font-sans">
                  <span className="font-semibold">{resume.title || 'Draft Resume'}</span>
                  <span className="font-bold">Page {pageIdx + 1} of {renderPagesList.length}</span>
                </div>
              )}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
});

LivePreview.displayName = 'LivePreview';
